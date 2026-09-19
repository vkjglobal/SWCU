import "server-only";

import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMediaObjectKey } from "@/lib/media";
import { uploadMediaObject } from "@/lib/r2";
import type { ResolvedTenant } from "@/lib/tenant";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const imageMime = z.enum(["image/jpeg", "image/png", "image/webp"]);

type PreparedMedia = {
  bytes: Buffer; mimeType: string; extension: string; width: number; height: number;
};

async function prepareImage(file: File): Promise<PreparedMedia> {
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) throw new Error("Image must be between 1 byte and 10 MB.");
  if (!imageMime.safeParse(file.type).success) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  const source = Buffer.from(await file.arrayBuffer());
  const image = sharp(source, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error("The uploaded file is not a valid image.");
  const keepPng = metadata.format === "png" && Boolean(metadata.hasAlpha);
  const bytes = keepPng
    ? await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
    : await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const output = await sharp(bytes).metadata();
  return { bytes, mimeType: keepPng ? "image/png" : "image/webp", extension: keepPng ? "png" : "webp", width: output.width ?? metadata.width, height: output.height ?? metadata.height };
}

async function preparePdf(file: File): Promise<PreparedMedia> {
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) throw new Error("PDF must be between 1 byte and 10 MB.");
  if (file.type !== "application/pdf") throw new Error("Only PDF documents are supported.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The uploaded file is not a valid PDF.");
  if (!bytes.includes(Buffer.from("%%EOF"))) throw new Error("The PDF appears incomplete.");
  return { bytes, mimeType: "application/pdf", extension: "pdf", width: 0, height: 0 };
}

async function createRecord(input: { tenant: ResolvedTenant; actorUserId: string; file: File; purpose: string; altText?: string; document?: boolean }) {
  const prepared = input.document ? await preparePdf(input.file) : await prepareImage(input.file);
  const category = input.document ? "documents/forms" : `images/${input.purpose}`;
  const objectKey = createMediaObjectKey({ tenantSlug: input.tenant.slug, category, extension: prepared.extension });
  await uploadMediaObject(objectKey, prepared.bytes, prepared.mimeType);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const record = await tx.mediaAsset.create({ data: {
      tenantId: input.tenant.id, objectKey, originalFilename: input.file.name.slice(0, 255),
      mimeType: prepared.mimeType, purpose: input.purpose, byteSize: prepared.bytes.byteLength,
      width: prepared.width, height: prepared.height, altText: input.altText, createdBy: input.actorUserId,
    }});
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_UPLOAD", targetType: "MediaAsset", targetId: record.id, changeMetadata: { after: { purpose: input.purpose, mimeType: prepared.mimeType, byteSize: prepared.bytes.byteLength } } } });
    return record;
  });
}

export async function uploadMedia(input: { tenant: ResolvedTenant; actorUserId: string; file: File; purpose: "hero" | "news" | "general" | "contact-map"; altText?: string }) {
  return createRecord(input);
}

export async function uploadDocument(input: { tenant: ResolvedTenant; actorUserId: string; file: File; altText?: string }) {
  return createRecord({ ...input, purpose: "forms", document: true });
}

export async function replaceMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string; file: File; altText?: string }) {
  const existing = await db.mediaAsset.findFirst({ where: { id: input.mediaId, tenantId: input.tenant.id, retiredAt: null } });
  if (!existing) throw new Error("Media asset not found.");
  if (existing.purpose === "contact-map") throw new Error("Contact Map assets must use the dedicated Contact Map workflow.");
  const isPdf = existing.mimeType === "application/pdf";
  const prepared = isPdf ? await preparePdf(input.file) : await prepareImage(input.file);
  const objectKey = createMediaObjectKey({ tenantSlug: input.tenant.slug, category: isPdf ? "documents/forms" : `images/${existing.purpose}`, extension: prepared.extension });
  await uploadMediaObject(objectKey, prepared.bytes, prepared.mimeType);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const replacement = await tx.mediaAsset.create({ data: { tenantId: input.tenant.id, objectKey, originalFilename: input.file.name.slice(0, 255), mimeType: prepared.mimeType, purpose: existing.purpose, byteSize: prepared.bytes.byteLength, width: prepared.width, height: prepared.height, altText: input.altText ?? existing.altText, createdBy: input.actorUserId } });
    const heroRefs = await tx.homeHeroSlide.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
    const formRefs = await tx.formDocument.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
     const contactMapRefs = await tx.contactSettings.updateMany({ where: { tenantId: input.tenant.id, contactMapMediaAssetId: existing.id }, data: { contactMapMediaAssetId: replacement.id } });
    await tx.mediaAsset.update({ where: { id: existing.id }, data: { retiredAt: new Date(), replacedById: replacement.id } });
     await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_REPLACE", targetType: "MediaAsset", targetId: existing.id, changeMetadata: { before: { mediaId: existing.id, objectKey: existing.objectKey }, after: { mediaId: replacement.id, objectKey, heroReferences: heroRefs.count, formReferences: formRefs.count, contactMapReferences: contactMapRefs.count } } } });
    return replacement;
  });
}

export async function retireMedia(tenant: ResolvedTenant, actorUserId: string, mediaId: string) {
  const existing = await db.mediaAsset.findFirst({ where: { id: mediaId, tenantId: tenant.id, retiredAt: null } });
  if (!existing) throw new Error("Media asset not found.");
  if (existing.purpose === "contact-map") throw new Error("Contact Map assets must use the dedicated Contact Map workflow.");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenant.id}, 0))`;
    const activeHeroRefs = await tx.homeHeroSlide.count({ where: { tenantId: tenant.id, mediaAssetId: existing.id, isEnabled: true } });
    const activeHeroCount = await tx.homeHeroSlide.count({ where: { tenantId: tenant.id, isEnabled: true } });
    if (activeHeroRefs > 0 && activeHeroCount - activeHeroRefs < 1) throw new Error("Keep at least one active hero slide.");
    const heroRefs = await tx.homeHeroSlide.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null, isEnabled: false } });
    const formRefs = await tx.formDocument.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null } });
    const contactMapRefs = await tx.contactSettings.updateMany({ where: { tenantId: tenant.id, contactMapMediaAssetId: existing.id }, data: { contactMapMediaAssetId: null } });
    const retired = await tx.mediaAsset.update({ where: { id: existing.id }, data: { retiredAt: new Date() } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId, action: "MEDIA_RETIRE", targetType: "MediaAsset", targetId: existing.id, changeMetadata: { before: { mediaId: existing.id }, after: { detachedHeroReferences: heroRefs.count, detachedFormReferences: formRefs.count, detachedContactMapReferences: contactMapRefs.count } } } });
    return retired;
  });
}

type ContactMapSlotOperation = "UPLOAD" | "REPLACE";

/**
 * Atomically advances the single Contact Map generation. The caller must upload
 * the new object first; this transaction is the authoritative slot transition.
 * A stale writer's uploaded row is retired outside the transaction.
 */
export async function attachContactMapGeneration(input: {
  tenant: ResolvedTenant;
  actorUserId: string;
  uploadedMediaId: string;
  expectedMediaId: string | null;
  operation: ContactMapSlotOperation;
}) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
      const settings = await tx.contactSettings.findUnique({ where: { tenantId: input.tenant.id }, select: { id: true, contactMapMediaAssetId: true } });
      if (!settings || settings.contactMapMediaAssetId !== input.expectedMediaId) {
        throw new Error("Contact Map changed while this operation was in progress. Please retry.");
      }
      const uploaded = await tx.mediaAsset.findFirst({ where: { id: input.uploadedMediaId, tenantId: input.tenant.id, retiredAt: null, purpose: "contact-map" }, select: { id: true } });
      if (!uploaded) throw new Error("Uploaded Contact Map media is unavailable.");
      const updated = await tx.contactSettings.updateMany({
        where: { id: settings.id, contactMapMediaAssetId: input.expectedMediaId },
        data: { contactMapMediaAssetId: input.uploadedMediaId },
      });
      if (updated.count !== 1) throw new Error("Contact Map changed while this operation was in progress. Please retry.");
      if (settings.contactMapMediaAssetId) {
        await tx.mediaAsset.updateMany({
          where: { id: settings.contactMapMediaAssetId, tenantId: input.tenant.id, retiredAt: null },
          data: { retiredAt: new Date(), replacedById: input.uploadedMediaId },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: input.tenant.id,
          actorUserId: input.actorUserId,
          action: input.operation === "REPLACE" ? "CONTACT_MAP_REPLACE" : "CONTACT_MAP_UPLOAD",
          targetType: "ContactSettings",
          targetId: settings.id,
          changeMetadata: { expectedMediaId: input.expectedMediaId, mediaAssetId: input.uploadedMediaId },
        },
      });
      return uploaded;
    });
  } catch (error) {
    await db.mediaAsset.updateMany({ where: { id: input.uploadedMediaId, tenantId: input.tenant.id, retiredAt: null }, data: { retiredAt: new Date() } });
    throw error;
  }
}

export async function removeContactMapGeneration(input: { tenant: ResolvedTenant; actorUserId: string; expectedMediaId: string }) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const settings = await tx.contactSettings.findUnique({ where: { tenantId: input.tenant.id }, select: { id: true, contactMapMediaAssetId: true } });
    if (!settings || settings.contactMapMediaAssetId !== input.expectedMediaId) throw new Error("Contact Map changed while this operation was in progress. Please retry.");
    const updated = await tx.contactSettings.updateMany({
      where: { id: settings.id, contactMapMediaAssetId: settings.contactMapMediaAssetId },
      data: { contactMapMediaAssetId: null },
    });
    if (updated.count !== 1) throw new Error("Contact Map changed while this operation was in progress. Please retry.");
    if (settings.contactMapMediaAssetId) {
      await tx.mediaAsset.updateMany({ where: { id: settings.contactMapMediaAssetId, tenantId: input.tenant.id, retiredAt: null }, data: { retiredAt: new Date() } });
    }
    await tx.auditLog.create({
      data: {
        tenantId: input.tenant.id,
        actorUserId: input.actorUserId,
        action: "CONTACT_MAP_REMOVE",
        targetType: "ContactSettings",
        targetId: settings.id,
        changeMetadata: { mediaAssetId: settings.contactMapMediaAssetId },
      },
    });
    return settings.contactMapMediaAssetId;
  });
}