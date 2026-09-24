import "server-only";

import sharp, { type Metadata } from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMediaObjectKey } from "@/lib/media";
import { deleteMediaObject, uploadMediaObject } from "@/lib/r2";
import type { ResolvedTenant } from "@/lib/tenant";
import { retireIfUnreferenced } from "@/lib/cms-workflow";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const imageMime = z.enum(["image/jpeg", "image/png", "image/webp"]);

type PreparedMedia = {
  bytes: Buffer; mimeType: string; extension: string; width: number; height: number;
};

async function prepareImage(file: File, maxDimension = 2000): Promise<PreparedMedia> {
  if (file.size <= 0) throw new Error("Choose an image to upload.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("This image is too large. Please choose an image smaller than 10 MB.");
  if (!imageMime.safeParse(file.type).success) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  const source = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(source, { failOn: "error" }).metadata();
  } catch {
    throw new Error("The uploaded file is not a valid JPEG, PNG, or WebP image.");
  }
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error("The uploaded file is not a valid image.");
  let bytes: Buffer;
  try {
    bytes = await sharp(source, { failOn: "error" }).rotate().resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 100 }).toBuffer();
  } catch {
    throw new Error("The uploaded file is not a valid JPEG, PNG, or WebP image.");
  }
  const output = await sharp(bytes).metadata();
  return { bytes, mimeType: "image/webp", extension: "webp", width: output.width ?? metadata.width, height: output.height ?? metadata.height };
}

async function preparePdf(file: File): Promise<PreparedMedia> {
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) throw new Error("PDF must be between 1 byte and 10 MB.");
  if (file.type !== "application/pdf") throw new Error("Only PDF documents are supported.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The uploaded file is not a valid PDF.");
  if (!bytes.includes(Buffer.from("%%EOF"))) throw new Error("The PDF appears incomplete.");
  return { bytes, mimeType: "application/pdf", extension: "pdf", width: 0, height: 0 };
}

async function createRecord(input: { tenant: ResolvedTenant; actorUserId: string; file: File; purpose: string; altText?: string; document?: boolean; maxDimension?: number; staged?: boolean; uploadClass?: string }) {
  const prepared = input.document ? await preparePdf(input.file) : await prepareImage(input.file, input.maxDimension);
  const category = input.document ? "documents/forms" : `images/${input.purpose}`;
  const objectKey = createMediaObjectKey({ tenantSlug: input.tenant.slug, category, extension: prepared.extension });
  await uploadMediaObject(objectKey, prepared.bytes, prepared.mimeType);
  try {
    return await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const record = await tx.mediaAsset.create({ data: {
      tenantId: input.tenant.id, objectKey, originalFilename: input.file.name.slice(0, 255),
      mimeType: prepared.mimeType, purpose: input.purpose, byteSize: prepared.bytes.byteLength,
      width: prepared.width, height: prepared.height, altText: input.altText, createdBy: input.actorUserId,
      stagedAt: input.staged ? new Date() : null,
      uploadClass: input.uploadClass ?? null,
    }});
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_UPLOAD", targetType: "MediaAsset", targetId: record.id, changeMetadata: { after: { purpose: input.purpose, mimeType: prepared.mimeType, byteSize: prepared.bytes.byteLength } } } });
      return record;
    });
  } catch (error) {
    await deleteMediaObject(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function uploadMedia(input: { tenant: ResolvedTenant; actorUserId: string; file: File; purpose: "hero" | "news" | "general" | "contact-map"; altText?: string; profile?: boolean; staged?: boolean; uploadClass?: string }) {
  return createRecord({ ...input, maxDimension: input.profile ? 1400 : 2000 });
}

export async function uploadDocument(input: { tenant: ResolvedTenant; actorUserId: string; file: File; altText?: string; staged?: boolean }) {
  return createRecord({ ...input, purpose: "forms", document: true, uploadClass: "document" });
}

export async function getUploadedMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string; purpose?: string; document?: boolean; uploadClass?: string }) {
  const media = await db.$transaction(async (tx) => {
    const staged = await tx.mediaAsset.updateMany({
      where: { id: input.mediaId, tenantId: input.tenant.id, createdBy: input.actorUserId, retiredAt: null, stagedAt: { not: null }, claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (staged.count === 1) return tx.mediaAsset.findUnique({ where: { id: input.mediaId } });
    return null;
  });
  if (!media) throw new Error("Uploaded media is unavailable.");
  if (input.document ? media.mimeType !== "application/pdf" : media.mimeType !== "image/webp") {
    await discardUploadedMedia({ tenant: input.tenant, actorUserId: input.actorUserId, mediaId: input.mediaId });
    throw new Error("Uploaded media has an invalid type.");
  }
  if (input.purpose && media.purpose !== input.purpose) {
    await discardUploadedMedia({ tenant: input.tenant, actorUserId: input.actorUserId, mediaId: input.mediaId });
    throw new Error("Uploaded media has an invalid purpose.");
  }
  if (input.uploadClass && media.uploadClass !== input.uploadClass) {
    await discardUploadedMedia({ tenant: input.tenant, actorUserId: input.actorUserId, mediaId: input.mediaId });
    throw new Error("Uploaded media has an invalid classification.");
  }
  return media;
}

export async function discardUploadedMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string }) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const row = await tx.mediaAsset.findFirst({ where: { id: input.mediaId, tenantId: input.tenant.id, createdBy: input.actorUserId, stagedAt: { not: null }, retiredAt: null }, select: { id: true, objectKey: true } });
    if (!row) return false;
    const [hero, forms, pages, leaders, maps, drafts] = await Promise.all([
      tx.homeHeroSlide.count({ where: { tenantId: input.tenant.id, mediaAssetId: row.id } }),
      tx.formDocument.count({ where: { tenantId: input.tenant.id, mediaAssetId: row.id } }),
      tx.pageContent.count({ where: { tenantId: input.tenant.id, mediaAssetId: row.id } }),
      tx.leadershipRecord.count({ where: { tenantId: input.tenant.id, mediaAssetId: row.id } }),
      tx.contactSettings.count({ where: { tenantId: input.tenant.id, contactMapMediaAssetId: row.id } }),
      tx.cmsDraft.count({ where: { tenantId: input.tenant.id, mediaAssetId: row.id, status: { in: ["DRAFT", "WAITING_FOR_APPROVAL", "RETURNED_FOR_CHANGES"] } } }),
    ]);
    if (hero + forms + pages + leaders + maps + drafts > 0) return false;
    await deleteMediaObject(row.objectKey);
    const retired = await tx.mediaAsset.updateMany({ where: { id: row.id, tenantId: input.tenant.id, createdBy: input.actorUserId, stagedAt: { not: null }, retiredAt: null }, data: { retiredAt: new Date() } });
    return retired.count === 1;
  });
}

export async function finalizeUploadedMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string }) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const result = await tx.mediaAsset.updateMany({ where: { id: input.mediaId, tenantId: input.tenant.id, createdBy: input.actorUserId, claimedAt: { not: null }, stagedAt: { not: null }, retiredAt: null }, data: { stagedAt: null } });
    if (!result.count) throw new Error("Uploaded media could not be finalized.");
  });
}

export async function replaceUploadedMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string; replacementId: string; expectedPurpose?: string; expectedUploadClass?: string }) {
  let replacement: Awaited<ReturnType<typeof getUploadedMedia>>;
  try {
    if (input.mediaId === input.replacementId) throw new Error("An asset cannot replace itself.");
    replacement = await getUploadedMedia({ tenant: input.tenant, actorUserId: input.actorUserId, mediaId: input.replacementId });
    const existing = await db.mediaAsset.findFirst({ where: { id: input.mediaId, tenantId: input.tenant.id, retiredAt: null } });
    if (!existing) throw new Error("Media asset not found.");
    if (existing.purpose === "contact-map") throw new Error("Contact Map assets must use the dedicated Contact Map workflow.");
    if (input.expectedPurpose && existing.purpose !== input.expectedPurpose) throw new Error("Replacement purpose does not match the target asset.");
    if (input.expectedUploadClass && replacement.uploadClass !== input.expectedUploadClass) throw new Error("Replacement classification does not match the target asset.");
    const imageTarget = existing.mimeType.startsWith("image/");
    if (replacement.purpose !== existing.purpose || (imageTarget ? replacement.mimeType !== "image/webp" : replacement.mimeType !== existing.mimeType)) throw new Error("Replacement media does not match the existing asset.");
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
      const lockedExisting = await tx.mediaAsset.findFirst({ where: { id: input.mediaId, tenantId: input.tenant.id, retiredAt: null } });
      const lockedReplacement = await tx.mediaAsset.findFirst({ where: { id: input.replacementId, tenantId: input.tenant.id, retiredAt: null } });
      if (!lockedExisting || !lockedReplacement) throw new Error("Media replacement is no longer available.");
      if (lockedExisting.id === lockedReplacement.id) throw new Error("An asset cannot replace itself.");
      const heroRefs = await tx.homeHeroSlide.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: lockedExisting.id }, data: { mediaAssetId: lockedReplacement.id } });
      const formRefs = await tx.formDocument.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: lockedExisting.id }, data: { mediaAssetId: lockedReplacement.id } });
      const pageRefs = await tx.pageContent.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: lockedExisting.id }, data: { mediaAssetId: lockedReplacement.id } });
      const leadershipRefs = await tx.leadershipRecord.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: lockedExisting.id }, data: { mediaAssetId: lockedReplacement.id } });
      const contactMapRefs = await tx.contactSettings.updateMany({ where: { tenantId: input.tenant.id, contactMapMediaAssetId: lockedExisting.id }, data: { contactMapMediaAssetId: lockedReplacement.id } });
      await tx.mediaAsset.updateMany({ where: { id: lockedReplacement.id, tenantId: input.tenant.id, stagedAt: { not: null }, claimedAt: { not: null } }, data: { stagedAt: null } });
    await retireIfUnreferenced(tx, input.tenant.id, lockedExisting.id, lockedReplacement.id);
      await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_REPLACE", targetType: "MediaAsset", targetId: lockedExisting.id, changeMetadata: { after: { mediaId: lockedReplacement.id, heroReferences: heroRefs.count, formReferences: formRefs.count, pageReferences: pageRefs.count, leadershipReferences: leadershipRefs.count, contactMapReferences: contactMapRefs.count } } } });
      return replacement;
    });
  } catch (error) {
    if (input.mediaId !== input.replacementId) {
      try {
        await discardUploadedMedia({ tenant: input.tenant, actorUserId: input.actorUserId, mediaId: input.replacementId });
      } catch (cleanupError) {
        throw new Error(`${error instanceof Error ? error.message : "Replacement failed."} Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    throw error;
  }
}

export async function replaceMedia(input: { tenant: ResolvedTenant; actorUserId: string; mediaId: string; file: File; altText?: string }) {
  const existing = await db.mediaAsset.findFirst({ where: { id: input.mediaId, tenantId: input.tenant.id, retiredAt: null } });
  if (!existing) throw new Error("Media asset not found.");
  if (existing.purpose === "contact-map") throw new Error("Contact Map assets must use the dedicated Contact Map workflow.");
  const isPdf = existing.mimeType === "application/pdf";
  const prepared = isPdf ? await preparePdf(input.file) : await prepareImage(input.file);
  const objectKey = createMediaObjectKey({ tenantSlug: input.tenant.slug, category: isPdf ? "documents/forms" : `images/${existing.purpose}`, extension: prepared.extension });
  await uploadMediaObject(objectKey, prepared.bytes, prepared.mimeType);
  try {
    return await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const replacement = await tx.mediaAsset.create({ data: { tenantId: input.tenant.id, objectKey, originalFilename: input.file.name.slice(0, 255), mimeType: prepared.mimeType, purpose: existing.purpose, byteSize: prepared.bytes.byteLength, width: prepared.width, height: prepared.height, altText: input.altText ?? existing.altText, createdBy: input.actorUserId } });
    const heroRefs = await tx.homeHeroSlide.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
    const formRefs = await tx.formDocument.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
    const pageRefs = await tx.pageContent.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
    const leadershipRefs = await tx.leadershipRecord.updateMany({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: replacement.id } });
     const contactMapRefs = await tx.contactSettings.updateMany({ where: { tenantId: input.tenant.id, contactMapMediaAssetId: existing.id }, data: { contactMapMediaAssetId: replacement.id } });
     await retireIfUnreferenced(tx, input.tenant.id, existing.id, replacement.id);
     await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "MEDIA_REPLACE", targetType: "MediaAsset", targetId: existing.id, changeMetadata: { before: { mediaId: existing.id, objectKey: existing.objectKey }, after: { mediaId: replacement.id, objectKey, heroReferences: heroRefs.count, formReferences: formRefs.count, pageReferences: pageRefs.count, leadershipReferences: leadershipRefs.count, contactMapReferences: contactMapRefs.count } } } });
      return replacement;
    });
  } catch (error) {
    await deleteMediaObject(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function retireMedia(tenant: ResolvedTenant, actorUserId: string, mediaId: string) {
  const existing = await db.mediaAsset.findFirst({ where: { id: mediaId, tenantId: tenant.id, retiredAt: null } });
  if (!existing) throw new Error("Media asset not found.");
  if (existing.purpose === "contact-map") throw new Error("Contact Map assets must use the dedicated Contact Map workflow.");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenant.id}, 0))`;
    // Retiring media removes the hero slot rather than leaving an unusable
    // null-media row that could be rendered or counted as a slide.
    const heroRefs = await tx.homeHeroSlide.deleteMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id } });
    const formRefs = await tx.formDocument.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null } });
    const pageRefs = await tx.pageContent.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null } });
    const leadershipRefs = await tx.leadershipRecord.updateMany({ where: { tenantId: tenant.id, mediaAssetId: existing.id }, data: { mediaAssetId: null } });
    const contactMapRefs = await tx.contactSettings.updateMany({ where: { tenantId: tenant.id, contactMapMediaAssetId: existing.id }, data: { contactMapMediaAssetId: null } });
     await retireIfUnreferenced(tx, tenant.id, existing.id);
     const retired = await tx.mediaAsset.findUniqueOrThrow({ where: { id: existing.id } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId, action: "MEDIA_RETIRE", targetType: "MediaAsset", targetId: existing.id, changeMetadata: { before: { mediaId: existing.id }, after: { detachedHeroReferences: heroRefs.count, detachedFormReferences: formRefs.count, detachedPageReferences: pageRefs.count, detachedLeadershipReferences: leadershipRefs.count, detachedContactMapReferences: contactMapRefs.count } } } });
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
      await tx.mediaAsset.updateMany({ where: { id: input.uploadedMediaId, tenantId: input.tenant.id, claimedAt: { not: null }, stagedAt: { not: null } }, data: { stagedAt: null } });
      if (settings.contactMapMediaAssetId) {
        await retireIfUnreferenced(tx, input.tenant.id, settings.contactMapMediaAssetId, input.uploadedMediaId);
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
    try {
      await discardUploadedMedia({ tenant: input.tenant, actorUserId: input.actorUserId, mediaId: input.uploadedMediaId });
    } catch (cleanupError) {
      throw new Error(`${error instanceof Error ? error.message : "Contact Map update failed."} Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
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
      await retireIfUnreferenced(tx, input.tenant.id, settings.contactMapMediaAssetId);
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