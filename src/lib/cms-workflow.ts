import "server-only";

import { db } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import {
  CmsDraftKind,
  CmsDraftOperation,
  CmsDraftStatus,
  Prisma,
} from "@/generated/prisma/client";

export type DraftPayload = Record<string, unknown>;

type DraftInput = {
  tenant: ResolvedTenant;
  actorUserId: string;
  kind: CmsDraftKind;
  operation: CmsDraftOperation;
  targetId?: string;
  payload: DraftPayload;
  mediaAssetId?: string;
};

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

export async function retireIfUnreferenced(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  tenantId: string,
  mediaAssetId: string,
  replacedById?: string,
) {
  await lockCmsTenant(tx, tenantId);
  const [heroRefs, formRefs] = await Promise.all([
    tx.homeHeroSlide.count({ where: { tenantId, mediaAssetId } }),
    tx.formDocument.count({ where: { tenantId, mediaAssetId } }),
  ]);
  if (heroRefs + formRefs === 0) {
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
  const role = await roleFor(input.tenant.id, input.actorUserId);
  return db.$transaction(async (tx) => {
    if (input.targetId) {
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
    const draft = await tx.cmsDraft.create({
      data: {
        tenantId: input.tenant.id,
        kind: input.kind,
        operation: input.operation,
        targetId: input.targetId,
        payload: json(input.payload),
        mediaAssetId: input.mediaAssetId,
        createdBy: input.actorUserId,
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
}) {
  const role = await roleFor(input.tenant.id, input.actorUserId);
  if (role !== "ADMINISTRATOR") {
    throw new Error("Only Administrators may publish drafts.");
  }

  return db.$transaction(async (tx) => {
    const draft = await tx.cmsDraft.findFirst({
      where: {
        id: input.draftId,
        tenantId: input.tenant.id,
        status: CmsDraftStatus.DRAFT,
      },
    });
    if (!draft) throw new Error("Draft not found or is no longer pending.");
    const payload = asPayload(draft.payload);
    const before: DraftPayload = {};
    const targetId = draft.targetId;

    if (draft.kind === CmsDraftKind.SITE_NOTICE) {
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

    const published = await tx.cmsDraft.update({
      where: { id: draft.id },
      data: {
        status: CmsDraftStatus.PUBLISHED,
        publishedBy: input.actorUserId,
        publishedAt: new Date(),
      },
    });
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
          before,
          after: payload,
        }),
      },
    });
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
    const draft = await tx.cmsDraft.updateMany({
      where: { id: input.draftId, tenantId: input.tenant.id, status: CmsDraftStatus.DRAFT },
      data: { status: CmsDraftStatus.ARCHIVED },
    });
    if (!draft.count) throw new Error("Draft not found or is no longer pending.");
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