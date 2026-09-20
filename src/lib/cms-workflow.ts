import "server-only";

import { db } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import {
  CmsDraftKind,
  CmsDraftOperation,
  CmsDraftStatus,
  Prisma,
} from "@/generated/prisma/client";
import { isUtilityPageSlot } from "@/lib/utility-pages";

export type DraftPayload = Record<string, unknown>;

type DraftInput = {
  tenant: ResolvedTenant;
  actorUserId: string;
  kind: CmsDraftKind;
  operation: CmsDraftOperation;
  targetId?: string;
  payload: DraftPayload;
  mediaAssetId?: string;
  expectedRevision?: number;
};

const OPEN_DRAFT_STATUSES = [
  CmsDraftStatus.DRAFT,
  CmsDraftStatus.WAITING_FOR_APPROVAL,
  CmsDraftStatus.RETURNED_FOR_CHANGES,
] as const;
const STALE_DRAFT_ERROR =
  "This draft has changed since you opened it. Please reload it before saving.";
const PUBLISHED_CHANGED_WARNING =
  "The published version has changed since this draft was started. Please review the current version before publishing.";
const RETIRED_TARGET_ERROR =
  "This item has since been retired. This draft cannot be published.";
export const PAGE_CONTENT_SLOTS = [
  "ABOUT_STORY", "ABOUT_VISION", "ABOUT_MISSION", "ABOUT_PURPOSE", "ABOUT_GOVERNANCE", "IMPORTANT_INFORMATION",
  "MEMBERSHIP_INTRO", "SAVINGS_INTRO", "LOANS_INTRO", "RETIREMENT_INTRO",
  "DEATH_BENEFIT_INTRO", "FORMS_INTRO", "CONTACT_INTRO", "PRIVACY",
  "TERMS_OF_USE", "ACCESSIBILITY",
] as const;

function json(payload: DraftPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

async function roleFor(tenantId: string, userId: string) {
  const membership = await db.staffMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!membership?.isActive) throw new Error("Active staff membership required.");
  return membership.role;
}

function asPayload(value: Prisma.JsonValue): DraftPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Draft payload must be an object.");
  }
  return value as DraftPayload;
}

function stringValue(payload: DraftPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function nullableStringValue(payload: DraftPayload, key: string) {
  if (payload[key] === null) return null;
  return stringValue(payload, key);
}

function booleanValue(payload: DraftPayload, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function numberValue(payload: DraftPayload, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

async function targetRecord(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  kind: CmsDraftKind,
  targetId?: string | null,
) {
  if (!targetId) return null;
  if (kind === CmsDraftKind.PAGE_CONTENT && targetId.includes(":page:")) {
    const slot = targetId.split(":page:")[1];
    return tx.pageContent.findFirst({ where: { tenantId, slot, isPublished: true }, select: { id: true, updatedAt: true, isPublished: true } });
  }
  if (kind === CmsDraftKind.NEWS) return tx.newsNotice.findFirst({ where: { id: targetId, tenantId, isPublished: true }, select: { id: true, updatedAt: true, isPublished: true } });
  if (kind === CmsDraftKind.FAQ) return tx.fAQ.findFirst({ where: { id: targetId, tenantId, isEnabled: true }, select: { id: true, updatedAt: true, isEnabled: true } });
  if (kind === CmsDraftKind.FORM_DOCUMENT) return tx.formDocument.findFirst({ where: { id: targetId, tenantId, isEnabled: true }, select: { id: true, updatedAt: true, isEnabled: true } });
  if (kind === CmsDraftKind.HERO) return tx.homeHeroSlide.findFirst({ where: { id: targetId, tenantId, isEnabled: true }, select: { id: true, updatedAt: true, isEnabled: true } });
  if (kind === CmsDraftKind.MEDIA) return tx.mediaAsset.findFirst({ where: { id: targetId, tenantId, retiredAt: null }, select: { id: true, updatedAt: true, retiredAt: true } });
  if (kind === CmsDraftKind.PAGE_CONTENT) return tx.pageContent.findFirst({ where: { id: targetId, tenantId, isPublished: true }, select: { id: true, updatedAt: true, isPublished: true } });
  return tx.siteNotice.findFirst({
    where: targetId === `${tenantId}:site-notice` ? { tenantId } : { id: targetId, tenantId },
    select: { id: true, updatedAt: true, isEnabled: true },
  });
}

function fingerprint(record: { updatedAt: Date } | null) {
  return record?.updatedAt.toISOString() ?? null;
}

export async function resolveCmsDraftTarget(tenant: ResolvedTenant, kind: CmsDraftKind, targetId?: string | null) {
  if (!targetId) return null;
  if (kind === CmsDraftKind.PAGE_CONTENT && targetId.startsWith(`${tenant.id}:page:`)) {
    const slot = targetId.split(":page:")[1];
    return (await db.pageContent.findFirst({ where: { tenantId: tenant.id, slot } })) ?? {
      id: targetId, tenantId: tenant.id, slot, updatedAt: new Date(0), isPublished: false,
    };
  }
  if (kind === CmsDraftKind.SITE_NOTICE && targetId === `${tenant.id}:site-notice`) {
    return (await db.siteNotice.findUnique({ where: { tenantId: tenant.id } })) ?? {
      id: `${tenant.id}:site-notice`,
      tenantId: tenant.id,
      updatedAt: new Date(0),
      isEnabled: false,
      message: "",
    };
  }
  if (kind === CmsDraftKind.NEWS) return db.newsNotice.findFirst({ where: { id: targetId, tenantId: tenant.id } });
  if (kind === CmsDraftKind.FAQ) return db.fAQ.findFirst({ where: { id: targetId, tenantId: tenant.id } });
  if (kind === CmsDraftKind.FORM_DOCUMENT) return db.formDocument.findFirst({ where: { id: targetId, tenantId: tenant.id } });
  if (kind === CmsDraftKind.HERO) return db.homeHeroSlide.findFirst({ where: { id: targetId, tenantId: tenant.id } });
  if (kind === CmsDraftKind.MEDIA) return db.mediaAsset.findFirst({ where: { id: targetId, tenantId: tenant.id, retiredAt: null } });
  if (kind === CmsDraftKind.PAGE_CONTENT) return db.pageContent.findFirst({ where: { id: targetId, tenantId: tenant.id, isPublished: true } });
  return db.siteNotice.findFirst({ where: { id: targetId, tenantId: tenant.id } });
}

export async function retireIfUnreferenced(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  mediaAssetId: string,
  replacedById?: string,
) {
  await lockCmsTenant(tx, tenantId);
  const [heroRefs, formRefs, draftRefs] = await Promise.all([
    tx.homeHeroSlide.count({ where: { tenantId, mediaAssetId } }),
    tx.formDocument.count({ where: { tenantId, mediaAssetId } }),
    tx.cmsDraft.count({ where: { tenantId, mediaAssetId, status: { in: [...OPEN_DRAFT_STATUSES] } } }),
  ]);
  if (heroRefs + formRefs + draftRefs === 0) {
    await tx.mediaAsset.update({
      where: { id: mediaAssetId },
      data: { retiredAt: new Date(), ...(replacedById ? { replacedById } : {}) },
    });
    return true;
  }
  return false;
}

export async function lockCmsTenant(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
}

export async function createCmsDraft(input: DraftInput) {
  if (input.kind === CmsDraftKind.PAGE_CONTENT) {
    const slot = stringValue(input.payload, "slot");
    if (!slot || !PAGE_CONTENT_SLOTS.includes(slot as (typeof PAGE_CONTENT_SLOTS)[number])) {
      throw new Error("Unknown fixed page content slot.");
    }
  }
  const role = await roleFor(input.tenant.id, input.actorUserId);
  if (role === "EDITOR" && input.kind === CmsDraftKind.PAGE_CONTENT && isUtilityPageSlot(stringValue(input.payload, "slot") ?? input.targetId?.split(":page:")[1] ?? "")) {
    throw new Error("Only Administrators may manage utility pages.");
  }
  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const effectiveTargetId = input.kind === CmsDraftKind.SITE_NOTICE
      ? (input.targetId ?? `${input.tenant.id}:site-notice`)
      : input.targetId;
    if (effectiveTargetId) {
      const existingDraft = await tx.cmsDraft.findFirst({
        where: { tenantId: input.tenant.id, kind: input.kind, targetId: effectiveTargetId, status: { in: [...OPEN_DRAFT_STATUSES] } },
        orderBy: { updatedAt: "desc" },
      });
      if (existingDraft) {
        if (existingDraft.status === CmsDraftStatus.WAITING_FOR_APPROVAL) throw new Error("This draft is waiting for approval. Save changes only before submitting.");
        if (existingDraft.createdBy !== input.actorUserId && existingDraft.assignedTo !== input.actorUserId && role === "EDITOR") throw new Error("An open draft already exists for this item.");
        if (input.expectedRevision === undefined) throw new Error(STALE_DRAFT_ERROR);
        const updated = await tx.cmsDraft.updateMany({
          where: { id: existingDraft.id, revision: input.expectedRevision, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.RETURNED_FOR_CHANGES] } },
          data: { payload: json(input.payload), operation: input.operation, mediaAssetId: input.mediaAssetId, revision: { increment: 1 }, updatedAt: new Date() },
        });
        if (!updated.count) throw new Error(STALE_DRAFT_ERROR);
        if (existingDraft.mediaAssetId && existingDraft.mediaAssetId !== input.mediaAssetId) {
          await retireIfUnreferenced(tx, input.tenant.id, existingDraft.mediaAssetId, input.mediaAssetId);
        }
        const revised = await tx.cmsDraft.findUniqueOrThrow({ where: { id: existingDraft.id } });
        await tx.auditLog.create({
          data: {
            tenantId: input.tenant.id,
            actorUserId: input.actorUserId,
            action: "CMS_DRAFT_REVISED",
            targetType: "CmsDraft",
            targetId: revised.id,
            changeMetadata: { revision: revised.revision, originalCreatorUserId: revised.createdBy },
          },
        });
        return revised;
      }
    }
    if (input.targetId && !(input.kind === CmsDraftKind.PAGE_CONTENT && input.targetId.startsWith(`${input.tenant.id}:page:`))) {
      const owned = input.kind === CmsDraftKind.NEWS
        ? await tx.newsNotice.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { id: true } })
        : input.kind === CmsDraftKind.FAQ
          ? await tx.fAQ.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { id: true } })
          : input.kind === CmsDraftKind.FORM_DOCUMENT
            ? await tx.formDocument.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { id: true } })
            : input.kind === CmsDraftKind.HERO
              ? await tx.homeHeroSlide.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { id: true } })
              : input.kind === CmsDraftKind.MEDIA
                ? await tx.mediaAsset.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { id: true } })
                : await tx.siteNotice.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { id: true } });
      if (!owned) throw new Error("Draft target does not belong to this tenant.");
      if (input.kind === CmsDraftKind.MEDIA) {
        const mediaTarget = await tx.mediaAsset.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { purpose: true } });
        if (mediaTarget?.purpose === "contact-map") throw new Error("Contact Map assets require the dedicated Contact Map workflow.");
      }
    }
    if (input.mediaAssetId) {
      const media = await tx.mediaAsset.findFirst({
        where: { id: input.mediaAssetId, tenantId: input.tenant.id, retiredAt: null },
        select: { id: true, mimeType: true },
      });
      const expectedMime = input.kind === CmsDraftKind.FORM_DOCUMENT ? "application/pdf" : input.kind === CmsDraftKind.HERO ? ["image/jpeg", "image/png", "image/webp"] : null;
      if (!media || (expectedMime && !expectedMime.includes(media.mimeType))) {
        throw new Error("Draft media asset does not belong to this tenant or has an invalid type.");
      }
      if (input.kind === CmsDraftKind.MEDIA && input.targetId) {
        const target = await tx.mediaAsset.findFirst({ where: { id: input.targetId, tenantId: input.tenant.id }, select: { mimeType: true } });
        if (!target || target.mimeType !== media.mimeType) throw new Error("Replacement media type does not match the tenant asset.");
      }
    }
    const target = await targetRecord(tx, input.tenant.id, input.kind, effectiveTargetId);
    const draft = await tx.cmsDraft.create({
      data: {
        tenantId: input.tenant.id,
        kind: input.kind,
        operation: input.operation,
        targetId: effectiveTargetId,
        payload: json(input.payload),
        mediaAssetId: input.mediaAssetId,
        createdBy: input.actorUserId,
        publishedBaseFingerprint: fingerprint(target),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenant.id,
        actorUserId: input.actorUserId,
        action: "CMS_DRAFT_CREATED",
        targetType: "CmsDraft",
        targetId: draft.id,
        changeMetadata: json({
          role,
          kind: input.kind,
          operation: input.operation,
          targetId: input.targetId ?? null,
          mediaAssetId: input.mediaAssetId ?? null,
          payload: input.payload,
        }),
      },
    });
    return draft;
  });
}

export async function getCmsDraftRevision(input: {
  tenant: ResolvedTenant; kind: CmsDraftKind; targetId?: string;
}) {
  const targetId = input.kind === CmsDraftKind.SITE_NOTICE
    ? (input.targetId ?? `${input.tenant.id}:site-notice`)
    : input.targetId;
  if (!targetId) return undefined;
  const draft = await db.cmsDraft.findFirst({
    where: { tenantId: input.tenant.id, kind: input.kind, targetId, status: { in: [...OPEN_DRAFT_STATUSES] } },
    select: { revision: true },
  });
  return draft?.revision;
}

export async function updateCmsDraft(input: {
  tenant: ResolvedTenant; actorUserId: string; draftId: string; payload: DraftPayload;
  revision: number; mediaAssetId?: string;
}) {
  await roleFor(input.tenant.id, input.actorUserId);
  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const existing = await tx.cmsDraft.findUnique({ where: { id: input.draftId }, select: { mediaAssetId: true } });
    const result = await tx.cmsDraft.updateMany({
      where: { id: input.draftId, tenantId: input.tenant.id, OR: [{ createdBy: input.actorUserId }, { assignedTo: input.actorUserId }],
        status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.RETURNED_FOR_CHANGES] }, revision: input.revision },
      data: { payload: json(input.payload), mediaAssetId: input.mediaAssetId, revision: { increment: 1 }, administratorNote: null },
    });
    if (!result.count) throw new Error(STALE_DRAFT_ERROR);
    if (existing?.mediaAssetId && existing.mediaAssetId !== input.mediaAssetId) {
      await retireIfUnreferenced(tx, input.tenant.id, existing.mediaAssetId, input.mediaAssetId);
    }
    const draft = await tx.cmsDraft.findUniqueOrThrow({ where: { id: input.draftId } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "CMS_DRAFT_REVISED", targetType: "CmsDraft", targetId: draft.id, changeMetadata: { revision: draft.revision } } });
    return draft;
  });
}

export async function submitCmsDraft(input: { tenant: ResolvedTenant; actorUserId: string; draftId: string }) {
  await roleFor(input.tenant.id, input.actorUserId);
  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const draft = await tx.cmsDraft.findFirst({ where: { id: input.draftId, tenantId: input.tenant.id, OR: [{ createdBy: input.actorUserId }, { assignedTo: input.actorUserId }], status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.RETURNED_FOR_CHANGES] } } });
    if (!draft) throw new Error("Draft not found or cannot be submitted.");
    const next = await tx.cmsDraft.update({ where: { id: draft.id }, data: { status: CmsDraftStatus.WAITING_FOR_APPROVAL, submittedAt: new Date(), administratorNote: null, revision: { increment: 1 } } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: draft.status === CmsDraftStatus.RETURNED_FOR_CHANGES ? "CMS_DRAFT_RESUBMITTED" : "CMS_DRAFT_SUBMITTED", targetType: "CmsDraft", targetId: draft.id, changeMetadata: { revision: next.revision } } });
    return next;
  });
}

export async function returnCmsDraft(input: { tenant: ResolvedTenant; actorUserId: string; draftId: string; note?: string }) {
  if (await roleFor(input.tenant.id, input.actorUserId) !== "ADMINISTRATOR") throw new Error("Only Administrators may return drafts for changes.");
  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const updated = await tx.cmsDraft.updateMany({ where: { id: input.draftId, tenantId: input.tenant.id, status: CmsDraftStatus.WAITING_FOR_APPROVAL }, data: { status: CmsDraftStatus.RETURNED_FOR_CHANGES, administratorNote: input.note?.trim().slice(0, 500) || null, returnedAt: new Date(), revision: { increment: 1 } } });
    if (!updated.count) throw new Error("Draft not found or is no longer awaiting approval.");
    const draft = await tx.cmsDraft.findUniqueOrThrow({ where: { id: input.draftId } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "CMS_DRAFT_RETURNED_FOR_CHANGES", targetType: "CmsDraft", targetId: draft.id, changeMetadata: { note: draft.administratorNote } } });
    if (draft.administratorNote) {
      await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "CMS_DRAFT_NOTE_ADDED", targetType: "CmsDraft", targetId: draft.id, changeMetadata: { note: draft.administratorNote } } });
    }
    return draft;
  });
}

export async function withdrawCmsDraft(input: { tenant: ResolvedTenant; actorUserId: string; draftId: string }) {
  await roleFor(input.tenant.id, input.actorUserId);
  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const updated = await tx.cmsDraft.updateMany({ where: { id: input.draftId, tenantId: input.tenant.id, OR: [{ createdBy: input.actorUserId }, { assignedTo: input.actorUserId }], status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] } }, data: { status: CmsDraftStatus.WITHDRAWN, withdrawnAt: new Date(), revision: { increment: 1 } } });
    if (!updated.count) throw new Error("Only your unpublished draft may be withdrawn.");
    const draft = await tx.cmsDraft.findUniqueOrThrow({ where: { id: input.draftId } });
    if (draft.mediaAssetId) await retireIfUnreferenced(tx, input.tenant.id, draft.mediaAssetId);
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "CMS_DRAFT_WITHDRAWN", targetType: "CmsDraft", targetId: draft.id } });
    return draft;
  });
}

export async function listPendingCmsDrafts(tenant: ResolvedTenant) {
  return db.cmsDraft.findMany({
    where: { tenantId: tenant.id, status: CmsDraftStatus.WAITING_FOR_APPROVAL },
    orderBy: { submittedAt: "asc" },
  });
}

export async function listMyCmsDrafts(tenant: ResolvedTenant, actorUserId: string) {
  return db.cmsDraft.findMany({
    where: { tenantId: tenant.id, OR: [{ createdBy: actorUserId }, { assignedTo: actorUserId }], status: { in: [...OPEN_DRAFT_STATUSES] } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function reassignCmsDraft(input: {
  tenant: ResolvedTenant; actorUserId: string; draftId: string; assigneeUserId: string;
}) {
  if (await roleFor(input.tenant.id, input.actorUserId) !== "ADMINISTRATOR") throw new Error("Only Administrators may reassign drafts.");
  return db.$transaction(async (tx) => {
    const assignee = await tx.staffMembership.findUnique({ where: { tenantId_userId: { tenantId: input.tenant.id, userId: input.assigneeUserId } } });
    if (!assignee?.isActive || assignee.role !== "EDITOR") throw new Error("Drafts may only be assigned to an active Editor.");
    const updated = await tx.cmsDraft.updateMany({
      where: { id: input.draftId, tenantId: input.tenant.id, status: { in: [...OPEN_DRAFT_STATUSES] } },
      data: { assignedTo: input.assigneeUserId, revision: { increment: 1 } },
    });
    if (!updated.count) throw new Error("Draft not found or is no longer open.");
    const draft = await tx.cmsDraft.findUniqueOrThrow({ where: { id: input.draftId } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "CMS_DRAFT_REASSIGNED", targetType: "CmsDraft", targetId: draft.id, changeMetadata: { assignedTo: input.assigneeUserId } } });
    return draft;
  });
}

async function assertHeroLimit(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  targetId: string | undefined,
  operation: CmsDraftOperation,
  enabled: boolean | undefined,
) {
  await lockCmsTenant(tx, tenantId);
  const active = await tx.homeHeroSlide.count({
    where: { tenantId, isEnabled: true },
  });
  const current = targetId
    ? await tx.homeHeroSlide.findFirst({ where: { id: targetId, tenantId } })
    : null;
  const adding = operation === CmsDraftOperation.CREATE && enabled !== false;
  const enabling =
    operation === CmsDraftOperation.TOGGLE &&
    enabled === true &&
    !current?.isEnabled;
  if ((adding || enabling) && active >= 4) {
    throw new Error("A maximum of four active hero slides is allowed.");
  }
  const disabling =
    (operation === CmsDraftOperation.TOGGLE ||
      operation === CmsDraftOperation.REMOVE) &&
    current?.isEnabled;
  if (disabling && active <= 1) {
    throw new Error("Keep at least one active hero slide.");
  }
}

export async function publishCmsDraft(input: {
  tenant: ResolvedTenant;
  actorUserId: string;
  draftId: string;
  confirmPublishedChange?: boolean;
}) {
  const role = await roleFor(input.tenant.id, input.actorUserId);
  if (role !== "ADMINISTRATOR") {
    throw new Error("Only Administrators may publish drafts.");
  }

  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const draft = await tx.cmsDraft.findFirst({
      where: {
        id: input.draftId,
        tenantId: input.tenant.id,
        status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL] },
      },
    });
    if (!draft) throw new Error("Draft not found or is no longer pending.");
    const currentTarget = await targetRecord(tx, input.tenant.id, draft.kind, draft.targetId);
    const canCreateFirstVersion = draft.kind === CmsDraftKind.SITE_NOTICE || draft.kind === CmsDraftKind.PAGE_CONTENT;
    if (draft.targetId && !currentTarget && !canCreateFirstVersion && draft.operation !== CmsDraftOperation.REMOVE) throw new Error(RETIRED_TARGET_ERROR);
    if (currentTarget && draft.publishedBaseFingerprint !== fingerprint(currentTarget) && !input.confirmPublishedChange) {
      throw new Error(PUBLISHED_CHANGED_WARNING);
    }
    const payload = asPayload(draft.payload);
    const before: DraftPayload = {};
    const targetId = draft.targetId;

    if (draft.kind === CmsDraftKind.PAGE_CONTENT) {
      const slot = targetId?.split(":page:")[1] ?? stringValue(payload, "slot");
      if (!slot) throw new Error("Page content slot is required.");
      const mediaAssetId = stringValue(payload, "mediaAssetId") ?? null;
      if (mediaAssetId) {
        const media = await tx.mediaAsset.findFirst({ where: { id: mediaAssetId, tenantId: input.tenant.id, retiredAt: null } });
        if (!media) throw new Error("Page content media is not a live tenant asset.");
      }
      const existing = await tx.pageContent.findFirst({ where: { tenantId: input.tenant.id, slot } });
      Object.assign(before, existing ?? {});
      await tx.pageContent.upsert({
        where: { tenantId_slot: { tenantId: input.tenant.id, slot } },
        update: {
          heading: nullableStringValue(payload, "heading") ?? null,
          body: nullableStringValue(payload, "body") ?? null,
          mediaAssetId,
          isPublished: true,
          publishedAt: new Date(),
        },
        create: {
          tenantId: input.tenant.id,
          slot,
          heading: nullableStringValue(payload, "heading") ?? null,
          body: nullableStringValue(payload, "body") ?? null,
          mediaAssetId,
          isPublished: true,
          publishedAt: new Date(),
        },
      });
    } else if (draft.kind === CmsDraftKind.SITE_NOTICE) {
      const existing = await tx.siteNotice.findUnique({
        where: { tenantId: input.tenant.id },
      });
      Object.assign(before, existing ?? {});
      const data = {
        message: stringValue(payload, "message") ?? "",
         actionText: nullableStringValue(payload, "actionText") ?? null,
         actionUrl: nullableStringValue(payload, "actionUrl") ?? null,
        isEnabled: booleanValue(payload, "isEnabled") ?? false,
        startsAt: payload.startsAt ? new Date(String(payload.startsAt)) : null,
        endsAt: payload.endsAt ? new Date(String(payload.endsAt)) : null,
      };
      await tx.siteNotice.upsert({
        where: { tenantId: input.tenant.id },
        update: data,
        create: { tenantId: input.tenant.id, ...data },
      });
    } else if (draft.kind === CmsDraftKind.NEWS) {
      if (draft.operation === CmsDraftOperation.REMOVE && targetId) {
        const existing = await tx.newsNotice.findFirst({
          where: { id: targetId, tenantId: input.tenant.id },
        });
        Object.assign(before, existing ?? {});
        if (!existing) throw new Error("News notice not found.");
        await tx.newsNotice.update({
          where: { id: existing.id },
          data: { isPublished: false },
        });
      } else {
        const existing = targetId
          ? await tx.newsNotice.findFirst({ where: { id: targetId, tenantId: input.tenant.id } })
          : null;
        const data = {
          title: stringValue(payload, "title") ?? "",
          summary: stringValue(payload, "summary") ?? "",
           publishedAt: payload.publishedAt
             ? new Date(String(payload.publishedAt))
             : (existing?.publishedAt ?? new Date()),
          isPublished: existing ? (existing.isPublished || booleanValue(payload, "isPublished") === true) : true,
        };
        Object.assign(before, existing ?? {});
        if (existing) await tx.newsNotice.update({ where: { id: existing.id }, data });
        else await tx.newsNotice.create({ data: { tenantId: input.tenant.id, ...data } });
      }
    } else if (draft.kind === CmsDraftKind.FAQ) {
      if (draft.operation === CmsDraftOperation.REMOVE && targetId) {
        const existing = await tx.fAQ.findFirst({
          where: { id: targetId, tenantId: input.tenant.id },
        });
        Object.assign(before, existing ?? {});
        if (!existing) throw new Error("FAQ not found.");
        await tx.fAQ.update({ where: { id: existing.id }, data: { isEnabled: false } });
      } else {
        const data = {
          question: stringValue(payload, "question") ?? "",
          answer: stringValue(payload, "answer") ?? "",
          sortOrder: numberValue(payload, "sortOrder") ?? 0,
          isEnabled: booleanValue(payload, "isEnabled") ?? false,
        };
        const existing = targetId
          ? await tx.fAQ.findFirst({ where: { id: targetId, tenantId: input.tenant.id } })
          : null;
        Object.assign(before, existing ?? {});
        if (existing) await tx.fAQ.update({ where: { id: existing.id }, data });
        else await tx.fAQ.create({ data: { tenantId: input.tenant.id, ...data } });
      }
    } else if (draft.kind === CmsDraftKind.FORM_DOCUMENT) {
      const mediaAssetId = stringValue(payload, "mediaAssetId") ?? draft.mediaAssetId ?? null;
      if (mediaAssetId) {
        const media = await tx.mediaAsset.findFirst({
          where: { id: mediaAssetId, tenantId: input.tenant.id, retiredAt: null, mimeType: "application/pdf" },
        });
        if (!media) throw new Error("Draft PDF is not a live tenant asset.");
      }
      if (draft.operation === CmsDraftOperation.REMOVE && targetId) {
        const existing = await tx.formDocument.findFirst({
          where: { id: targetId, tenantId: input.tenant.id },
        });
        Object.assign(before, existing ?? {});
        if (!existing) throw new Error("Form document not found.");
        await tx.formDocument.update({
          where: { id: existing.id },
          data: { isEnabled: false, mediaAssetId: null },
        });
      } else {
        const data = {
          title: stringValue(payload, "title") ?? "",
          description: stringValue(payload, "description"),
          mediaAssetId,
          sortOrder: numberValue(payload, "sortOrder") ?? 0,
          isEnabled: booleanValue(payload, "isEnabled") ?? false,
        };
        const existing = targetId
          ? await tx.formDocument.findFirst({
              where: { id: targetId, tenantId: input.tenant.id },
            })
          : null;
        Object.assign(before, existing ?? {});
        if (existing) {
          await lockCmsTenant(tx, input.tenant.id);
          await tx.formDocument.update({ where: { id: existing.id }, data });
        } else {
          await tx.formDocument.create({ data: { tenantId: input.tenant.id, ...data } });
        }
        if (existing && mediaAssetId && mediaAssetId !== existing.mediaAssetId) {
          if (existing.mediaAssetId) {
            await retireIfUnreferenced(tx, input.tenant.id, existing.mediaAssetId, mediaAssetId);
          }
        }
      }
    } else if (draft.kind === CmsDraftKind.HERO) {
      const enabled = booleanValue(payload, "isEnabled");
      await lockCmsTenant(tx, input.tenant.id);
      await assertHeroLimit(tx, input.tenant.id, targetId ?? undefined, draft.operation, enabled);
      const proposedMediaId = stringValue(payload, "mediaAssetId") ?? draft.mediaAssetId;
      if (proposedMediaId) {
        const proposedMedia = await tx.mediaAsset.findFirst({
          where: { id: proposedMediaId, tenantId: input.tenant.id, retiredAt: null },
          select: { mimeType: true },
        });
        if (!proposedMedia || !proposedMedia.mimeType.startsWith("image/")) throw new Error("Draft Hero media is not a live tenant image.");
      }
      if (draft.operation === CmsDraftOperation.CREATE) {
        await tx.homeHeroSlide.create({
          data: {
            tenantId: input.tenant.id,
            mediaAssetId: proposedMediaId,
            altText: stringValue(payload, "altText") ?? "",
            sortOrder: numberValue(payload, "sortOrder") ?? 0,
            isEnabled: enabled ?? false,
          },
        });
      } else if (targetId) {
        const existing = await tx.homeHeroSlide.findFirst({
          where: { id: targetId, tenantId: input.tenant.id },
        });
        if (!existing) throw new Error("Hero slide not found.");
        Object.assign(before, existing);
        const nextMediaId = proposedMediaId;
        await tx.homeHeroSlide.update({
          where: { id: existing.id },
          data: {
            mediaAssetId: draft.operation === CmsDraftOperation.REMOVE ? null : nextMediaId,
            altText: stringValue(payload, "altText"),
            sortOrder: numberValue(payload, "sortOrder"),
            isEnabled: draft.operation === CmsDraftOperation.REMOVE ? false : enabled,
          },
        });
        if (existing.mediaAssetId && (draft.operation === CmsDraftOperation.REMOVE || nextMediaId !== existing.mediaAssetId)) {
          await retireIfUnreferenced(tx, input.tenant.id, existing.mediaAssetId, nextMediaId ?? undefined);
        }
      }
    } else if (draft.kind === CmsDraftKind.MEDIA) {
      const mediaId = targetId ?? draft.mediaAssetId;
      if (!mediaId) throw new Error("Media draft has no target.");
      const existing = await tx.mediaAsset.findFirst({
        where: { id: mediaId, tenantId: input.tenant.id },
      });
      if (!existing) throw new Error("Media asset not found.");
      if (existing.purpose === "contact-map") throw new Error("Contact Map assets require the dedicated Contact Map workflow.");
      Object.assign(before, existing);
      if (draft.operation === CmsDraftOperation.REPLACE && draft.mediaAssetId) {
        const replacement = await tx.mediaAsset.findFirst({
          where: { id: draft.mediaAssetId, tenantId: input.tenant.id, retiredAt: null },
        });
        if (!replacement) throw new Error("Replacement media asset not found.");
        await tx.homeHeroSlide.updateMany({
          where: { tenantId: input.tenant.id, mediaAssetId: existing.id },
          data: { mediaAssetId: replacement.id },
        });
        await tx.formDocument.updateMany({
          where: { tenantId: input.tenant.id, mediaAssetId: existing.id },
          data: { mediaAssetId: replacement.id },
        });
        await tx.mediaAsset.update({
          where: { id: existing.id },
          data: { retiredAt: new Date(), replacedById: replacement.id },
        });
      } else if (draft.operation === CmsDraftOperation.RETIRE) {
        await lockCmsTenant(tx, input.tenant.id);
        const activeHeroRefs = await tx.homeHeroSlide.count({ where: { tenantId: input.tenant.id, mediaAssetId: existing.id, isEnabled: true } });
        const activeHeroCount = await tx.homeHeroSlide.count({ where: { tenantId: input.tenant.id, isEnabled: true } });
        if (activeHeroCount - activeHeroRefs < 1) throw new Error("Keep at least one active hero slide.");
        await tx.homeHeroSlide.updateMany({
          where: { tenantId: input.tenant.id, mediaAssetId: existing.id },
          data: { mediaAssetId: null, isEnabled: false },
        });
        await tx.formDocument.updateMany({
          where: { tenantId: input.tenant.id, mediaAssetId: existing.id },
          data: { mediaAssetId: null },
        });
        await tx.mediaAsset.update({
          where: { id: existing.id },
          data: { retiredAt: new Date() },
        });
      }
    }

    const claimed = await tx.cmsDraft.updateMany({
      where: { id: draft.id, tenantId: input.tenant.id, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL] } },
      data: {
        status: CmsDraftStatus.PUBLISHED,
        publishedBy: input.actorUserId,
        publishedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    if (!claimed.count) throw new Error("Draft was already processed by another Administrator.");
    const published = await tx.cmsDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenant.id,
        actorUserId: input.actorUserId,
        action: "CMS_DRAFT_PUBLISHED",
        targetType: draft.kind,
        targetId: draft.targetId,
        changeMetadata: json({
          role,
          draftId: draft.id,
          operation: draft.operation,
          publishedChangeConfirmation: input.confirmPublishedChange === true,
          before,
          after: payload,
        }),
      },
    });
    if (input.confirmPublishedChange) {
      await tx.auditLog.create({
        data: {
          tenantId: input.tenant.id,
          actorUserId: input.actorUserId,
          action: "CMS_DRAFT_STALE_VERSION_CONFIRMED",
          targetType: "CmsDraft",
          targetId: draft.id,
          changeMetadata: { confirmation: true, draftId: draft.id },
        },
      });
    }
    return published;
  });
}

export async function archiveCmsDraft(input: {
  tenant: ResolvedTenant;
  actorUserId: string;
  draftId: string;
}) {
  const role = await roleFor(input.tenant.id, input.actorUserId);
  if (role !== "ADMINISTRATOR") throw new Error("Only Administrators may archive drafts.");
  return db.$transaction(async (tx) => {
    await lockCmsTenant(tx, input.tenant.id);
    const draft = await tx.cmsDraft.updateMany({
      where: { id: input.draftId, tenantId: input.tenant.id, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] } },
      data: { status: CmsDraftStatus.ARCHIVED },
    });
    if (!draft.count) throw new Error("Draft not found or is no longer pending.");
    const archivedDraft = await tx.cmsDraft.findUniqueOrThrow({ where: { id: input.draftId } });
    if (archivedDraft.mediaAssetId) await retireIfUnreferenced(tx, input.tenant.id, archivedDraft.mediaAssetId);
    await tx.cmsDraft.update({ where: { id: input.draftId }, data: { archivedAt: new Date(), revision: { increment: 1 } } });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenant.id,
        actorUserId: input.actorUserId,
        action: "CMS_DRAFT_ARCHIVED",
        targetType: "CmsDraft",
        targetId: input.draftId,
        changeMetadata: { role, draftId: input.draftId },
      },
    });
    return draft;
  });
}