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
    const record = await tx.mediaAsset.create({ data: {
      tenantId: input.tenant.id, objectKey, originalFilename: input.file.name.slice(0, 255),
      mimeType: prepared.mimeType, purpose: input.purpose, byteSize: prepared.bytes.byteLength,
      width: prepared.width, height: prepared.height, altText: input.altText, createdBy: input.actorUserId,
    }});
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_UPLOAD", targetType: "MediaAsset", targetId: record.id, changeMetadata: { after: { purpose: input.purpose, mimeType: prepared.mimeType, byteSize: prepared.bytes.byteLength } } } });
    return record;
  });
}

export async function uploadMedia(input: { tenant: ResolvedTenant; actorUserId: string; file: File; purpose: "hero" | "news" | "general"; altText?: string }) {
  return createRecord(input);
}

export async function uploadDocument(input: { tenant: ResolvedTenant; actorUserId: string; file: File; altText?: string }) {
  return createRecord({ ...input, purpose: "forms", document: true });
}

export async function replaceMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string; file: File; altText?: string }) {
  const existing = await db.mediaAsset.findFirst({ where: { id: input.mediaId, tenantId: input.tenant.id, retiredAt: null } });
  if (!existing) throw new Error("Media asset not found.");
  const isPdf = existing.mimeType === "application/pdf";
  const prepared = isPdf ? await preparePdf(input.file) : await prepareImage(input.file);
  const objectKey = createMediaObjectKey({ tenantSlug: input.tenant.slug, category: isPdf ? "documents/forms" : `images/${existing.purpose}`, extension: prepared.extension });
  await uploadMediaObject(objectKey, prepared.bytes, prepared.mimeType);
  return db.$transaction(async (tx) => {
    const replacement = await tx.mediaAsset.create({ data: { tenantId: input.tenant.id, objectKey, originalFilename: input.file.name.slice(0, 255), mimeType: prepared.mimeType, purpose: existing.purpose, byteSize: prepared.bytes.byteLength, width: prepared.width, height: prepared.height, altText: input.altText ?? existing.altText, createdBy: input.actorUserId } });
    const heroRefs = await tx.homeHeroSlide.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
    const formRefs = await tx.formDocument.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
    await tx.mediaAsset.update({ where: { id: existing.id }, data: { retiredAt: new Date(), replacedById: replacement.id } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_REPLACE", targetType: "MediaAsset", targetId: existing.id, changeMetadata: { before: { mediaId: existing.id, objectKey: existing.objectKey }, after: { mediaId: replacement.id, objectKey, heroReferences: heroRefs.count, formReferences: formRefs.count } } } });
    return replacement;
  });
}

export async function retireMedia(tenant: ResolvedTenant, actorUserId: string, mediaId: string) {
  const existing = await db.mediaAsset.findFirst({ where: { id: mediaId, tenantId: tenant.id, retiredAt: null } });
  if (!existing) throw new Error("Media asset not found.");
  return db.$transaction(async (tx) => {
    const heroRefs = await tx.homeHeroSlide.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null, isEnabled: false } });
    const formRefs = await tx.formDocument.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null } });
    const retired = await tx.mediaAsset.update({ where: { id: existing.id }, data: { retiredAt: new Date() } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId, action: "MEDIA_RETIRE", targetType: "MediaAsset", targetId: existing.id, changeMetadata: { before: { mediaId: existing.id }, after: { detachedHeroReferences: heroRefs.count, detachedFormReferences: formRefs.count } } } });
    return retired;
  });
}