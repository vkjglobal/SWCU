"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { uploadMedia, uploadDocument, replaceMedia, retireMedia } from "@/lib/media-service";
import {
  createCmsDraft as createCmsDraftWorkflow,
  archiveCmsDraft as archiveCmsDraftWorkflow,
  publishCmsDraft as publishCmsDraftWorkflow,
  submitCmsDraft as submitCmsDraftWorkflow,
  returnCmsDraft as returnCmsDraftWorkflow,
  withdrawCmsDraft as withdrawCmsDraftWorkflow,
  retireIfUnreferenced,
  lockCmsTenant,
  PAGE_CONTENT_SLOTS,
} from "@/lib/cms-workflow";
import { CmsDraftKind, CmsDraftOperation } from "@/generated/prisma/client";

async function createCmsDraft(input: Parameters<typeof createCmsDraftWorkflow>[0]) {
  const expectedRevision = input.expectedRevision;
  return createCmsDraftWorkflow({ ...input, expectedRevision });
}
import { createStaffAccount, changeStaffRole, setStaffAccountActive, initiateStaffPasswordReset, disableEditorWithReassignment, completeStaffPasswordReset } from "@/lib/staff-accounts";
import { reassignCmsDraft } from "@/lib/cms-workflow";
import { updateContactStatus, openContactEnquiry, contactRecipientsSchema, parseContactRecipientsForm } from "@/lib/contact";

const idSchema = z.string().cuid();
const text = (max: number) => z.string().trim().min(1).max(max);
const dateOrNull = z.preprocess((v) => {
  if (v === "" || v == null) return null;
  return new Date(`${String(v)}:00+12:00`);
}, z.date().nullable());
const safeActionUrl = z.string().trim().max(500).refine((url) => url === "" || url.startsWith("/") || /^https?:\/\//i.test(url), "Use an internal path or http/https URL.");
const safeDestination = z.string().trim().max(200).refine((url) => url === "" || url.startsWith("/") || url.startsWith("#"), "Use an internal path or anchor.");

async function staff(roles?: ("ADMINISTRATOR" | "EDITOR")[]) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const access = await requireStaffMembership(tenant, roles);
  return { tenant, userId: access.session.user.id, role: access.membership.role };
}

function value(form: FormData, key: string) {
  return form.get(key)?.toString() ?? "";
}
function checkbox(form: FormData, key: string) {
  const raw = form.get(key);
  if (raw === null) return false;
  const value = raw.toString().toLowerCase();
  if (value === "on" || value === "true") return true;
  if (value === "off" || value === "false" || value === "") return false;
  throw new Error(`Invalid checkbox value for ${key}.`);
}

export async function saveSiteNotice(form: FormData) {
  const { tenant, userId, role } = await staff();
  const expectedRevision = form.get("revision") ? Number(form.get("revision")) : undefined;
  const input = z.object({
    message: text(280), actionText: z.string().trim().max(80).optional(), actionUrl: safeActionUrl.optional(),
    isEnabled: z.boolean(), startsAt: dateOrNull, endsAt: dateOrNull,
  }).parse({
    message: value(form, "message"), actionText: value(form, "actionText") || undefined, actionUrl: value(form, "actionUrl") || undefined,
    isEnabled: form.get("isEnabled") === "on", startsAt: value(form, "startsAt"), endsAt: value(form, "endsAt"),
  });
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new Error("End date must be after start date.");
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.SITE_NOTICE, operation: CmsDraftOperation.UPDATE, expectedRevision, payload: {
      ...input,
      startsAt: input.startsAt?.toISOString() ?? null,
      endsAt: input.endsAt?.toISOString() ?? null,
    } });
    return;
  }
  await db.$transaction(async (tx) => {
    const before = await tx.siteNotice.findUnique({ where: { tenantId: tenant.id } });
    const notice = await tx.siteNotice.upsert({
      where: { tenantId: tenant.id }, update: input, create: { tenantId: tenant.id, ...input },
    });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "SITE_NOTICE_UPDATE", targetType: "SiteNotice", targetId: notice.id, changeMetadata: { before: before ? { message: before.message, isEnabled: before.isEnabled, startsAt: before.startsAt?.toISOString(), endsAt: before.endsAt?.toISOString() } : null, after: { message: notice.message, isEnabled: notice.isEnabled, startsAt: notice.startsAt?.toISOString(), endsAt: notice.endsAt?.toISOString() } } } });
  });
  revalidatePath("/", "layout");
}

export async function submitCmsDraft(form: FormData) {
  const { tenant, userId } = await staff();
  await submitCmsDraftWorkflow({ tenant, actorUserId: userId, draftId: idSchema.parse(value(form, "draftId")) });
  revalidatePath("/admin");
}

export async function returnCmsDraft(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  await returnCmsDraftWorkflow({ tenant, actorUserId: userId, draftId: idSchema.parse(value(form, "draftId")), note: value(form, "note") || undefined });
  revalidatePath("/admin");
}

export async function withdrawCmsDraft(form: FormData) {
  const { tenant, userId } = await staff();
  await withdrawCmsDraftWorkflow({ tenant, actorUserId: userId, draftId: idSchema.parse(value(form, "draftId")) });
  revalidatePath("/admin");
}

export async function saveHighlight(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const input = z.object({ id: idSchema.optional(), value: text(80), label: text(120), sortOrder: z.coerce.number().int().min(0).max(100), isEnabled: z.boolean() }).parse({
    id: value(form, "id") || undefined, value: value(form, "value"), label: value(form, "label"),
    sortOrder: value(form, "sortOrder"), isEnabled: form.get("isEnabled") === "on",
  });
  await db.$transaction(async (tx) => {
    const before = input.id ? await tx.homeHighlight.findFirst({ where: { id: input.id, tenantId: tenant.id } }) : null;
    if (input.id && !before) throw new Error("Highlight not found.");
    const record = input.id
      ? await tx.homeHighlight.update({ where: { id: input.id }, data: { value: input.value, label: input.label, sortOrder: input.sortOrder, isEnabled: input.isEnabled } })
      : await tx.homeHighlight.create({ data: { tenantId: tenant.id, value: input.value, label: input.label, sortOrder: input.sortOrder, isEnabled: input.isEnabled } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "HIGHLIGHT_UPDATE", targetType: "HomeHighlight", targetId: record.id, changeMetadata: { before: before ? { value: before.value, label: before.label, sortOrder: before.sortOrder, isEnabled: before.isEnabled } : null, after: { value: record.value, label: record.label, sortOrder: record.sortOrder, isEnabled: record.isEnabled } } } });
    return record;
  });
  revalidatePath("/");
}

export async function saveService(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const input = z.object({ id: idSchema.optional(), title: text(120), description: text(500), icon: text(40), destination: safeDestination.optional(), sortOrder: z.coerce.number().int().min(0).max(100), isEnabled: z.boolean() }).parse({
    id: value(form, "id") || undefined, title: value(form, "title"), description: value(form, "description"), icon: value(form, "icon") || "landmark",
    destination: value(form, "destination") || undefined, sortOrder: value(form, "sortOrder") || "0", isEnabled: form.get("isEnabled") === "on",
  });
  await db.$transaction(async (tx) => {
    let record;
    let before = null;
    if (input.id) {
      before = await tx.service.findFirst({ where: { id: input.id, tenantId: tenant.id } });
      if (!before) throw new Error("Service not found.");
      record = await tx.service.update({ where: { id: input.id }, data: input });
    } else {
      record = await tx.service.create({ data: { tenantId: tenant.id, ...input } });
    }
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "SERVICE_UPDATE", targetType: "Service", targetId: record.id, changeMetadata: { before: before ? { title: before.title, description: before.description, icon: before.icon, destination: before.destination, sortOrder: before.sortOrder, isEnabled: before.isEnabled } : null, after: { title: record.title, description: record.description, icon: record.icon, destination: record.destination, sortOrder: record.sortOrder, isEnabled: record.isEnabled } } } });
  });
  revalidatePath("/");
}

export async function removeHighlight(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.homeHighlight.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("Highlight not found.");
  await db.$transaction(async (tx) => {
    await tx.homeHighlight.update({ where: { id }, data: { isEnabled: false } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "HIGHLIGHT_REMOVE", targetType: "HomeHighlight", targetId: id, changeMetadata: { before: existing, after: { isEnabled: false } } } });
  });
  revalidatePath("/");
}

export async function removeService(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.service.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("Service not found.");
  await db.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { isEnabled: false } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "SERVICE_REMOVE", targetType: "Service", targetId: id, changeMetadata: { before: existing, after: { isEnabled: false } } } });
  });
  revalidatePath("/");
}

export async function toggleHeroSlide(form: FormData) {
  const { tenant, userId, role } = await staff();
  const id = idSchema.parse(value(form, "id"));
  const current = await db.homeHeroSlide.findFirst({ where: { id, tenantId: tenant.id } });
  if (!current) throw new Error("Hero slide not found.");
  const enabled = form.get("isEnabled") === "true";
  const expectedRevision = form.get("revision") ? Number(form.get("revision")) : undefined;
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.TOGGLE, targetId: id, expectedRevision, payload: { isEnabled: enabled } });
    return;
  }
  await db.$transaction(async (tx) => {
    await lockCmsTenant(tx, tenant.id);
    const activeCount = await tx.homeHeroSlide.count({ where: { tenantId: tenant.id, isEnabled: true } });
    if (!enabled && current.isEnabled && activeCount <= 1) throw new Error("Keep at least one active hero slide.");
    if (enabled && !current.isEnabled && activeCount >= 4) throw new Error("A maximum of four active hero slides is allowed.");
    await tx.homeHeroSlide.update({ where: { id }, data: { isEnabled: enabled } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: enabled ? "HERO_PUBLISH" : "HERO_UNPUBLISH", targetType: "HomeHeroSlide", targetId: id, changeMetadata: { before: { isEnabled: current.isEnabled }, after: { isEnabled: enabled } } } });
  });
  revalidatePath("/");
}

export async function uploadHeroSlide(form: FormData) {
  const { tenant, userId, role } = await staff();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose an image to upload.");
  const altText = text(200).parse(value(form, "altText"));
  if (role === "EDITOR") {
    const media = await uploadMedia({ tenant, actorUserId: userId, file, purpose: "hero", altText });
    try {
      await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.CREATE, mediaAssetId: media.id, payload: { mediaAssetId: media.id, altText, sortOrder: 0, isEnabled: true } });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
      throw error;
    }
    return;
  }
  const media = await uploadMedia({ tenant, actorUserId: userId, file, purpose: "hero", altText });
  try {
    await db.$transaction(async (tx) => {
      await lockCmsTenant(tx, tenant.id);
      const activeCount = await tx.homeHeroSlide.count({ where: { tenantId: tenant.id, isEnabled: true } });
      const created = await tx.homeHeroSlide.create({
        data: { tenantId: tenant.id, mediaAssetId: media.id, altText, sortOrder: await tx.homeHeroSlide.count({ where: { tenantId: tenant.id } }), isEnabled: activeCount < 4 },
      });
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "HERO_CREATE", targetType: "HomeHeroSlide", targetId: created.id, changeMetadata: { before: null, after: { mediaAssetId: media.id, altText, isEnabled: created.isEnabled, sortOrder: created.sortOrder } } } });
    });
  } catch (error) {
    await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
    throw error;
  }
  revalidatePath("/");
}

export async function replaceHeroSlide(form: FormData) {
  const { tenant, userId, role } = await staff();
  const slideId = idSchema.parse(value(form, "slideId"));
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose an image to upload.");
  const altText = text(200).parse(value(form, "altText"));
  const slide = await db.homeHeroSlide.findFirst({ where: { id: slideId, tenantId: tenant.id }, include: { mediaAsset: true } });
  if (!slide) throw new Error("Hero slide not found.");
  const media = await uploadMedia({ tenant, actorUserId: userId, file, purpose: "hero", altText });
  if (role === "EDITOR") {
    try {
      await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.REPLACE, targetId: slideId, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, mediaAssetId: media.id, payload: { mediaAssetId: media.id, altText } });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
      throw error;
    }
    return;
  }
  try {
    await db.$transaction(async (tx) => {
      await lockCmsTenant(tx, tenant.id);
      await tx.homeHeroSlide.update({ where: { id: slide.id }, data: { mediaAssetId: media.id, altText } });
       if (slide.mediaAsset) await retireIfUnreferenced(tx, tenant.id, slide.mediaAsset.id, media.id);
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "HERO_REPLACE", targetType: "HomeHeroSlide", targetId: slide.id, changeMetadata: { before: { mediaAssetId: slide.mediaAssetId, altText: slide.altText }, after: { mediaAssetId: media.id, altText } } } });
    });
  } catch (error) {
    await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
    throw error;
  }
  revalidatePath("/");
}

export async function removeHeroSlide(form: FormData) {
  const { tenant, userId, role } = await staff();
  const id = idSchema.parse(value(form, "id"));
  const slide = await db.homeHeroSlide.findFirst({ where: { id, tenantId: tenant.id }, include: { mediaAsset: true } });
  if (!slide) throw new Error("Hero slide not found.");
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.REMOVE, targetId: id, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, payload: {} });
    return;
  }
  await db.$transaction(async (tx) => {
    await lockCmsTenant(tx, tenant.id);
    const activeCount = await tx.homeHeroSlide.count({ where: { tenantId: tenant.id, isEnabled: true } });
    if (slide.isEnabled && activeCount <= 1) throw new Error("Keep at least one active hero slide.");
    await tx.homeHeroSlide.update({ where: { id }, data: { mediaAssetId: null, isEnabled: false } });
    if (slide.mediaAssetId) await retireIfUnreferenced(tx, tenant.id, slide.mediaAssetId);
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "HERO_REMOVE", targetType: "HomeHeroSlide", targetId: id, changeMetadata: { before: { mediaAssetId: slide.mediaAssetId, altText: slide.altText }, after: { removed: true } } } });
  });
  revalidatePath("/");
}

export async function reorderHeroSlide(form: FormData) {
  const { tenant, userId, role } = await staff();
  const id = idSchema.parse(value(form, "id"));
  const sortOrder = z.coerce.number().int().min(0).max(100).parse(value(form, "sortOrder"));
  const current = await db.homeHeroSlide.findFirst({ where: { id, tenantId: tenant.id } });
  if (!current) throw new Error("Hero slide not found.");
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.REORDER, targetId: id, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, payload: { sortOrder } });
    return;
  }
  await db.$transaction(async (tx) => {
    await tx.homeHeroSlide.update({ where: { id }, data: { sortOrder } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "HERO_REORDER", targetType: "HomeHeroSlide", targetId: id, changeMetadata: { before: { sortOrder: current.sortOrder }, after: { sortOrder } } } });
  });
  revalidatePath("/");
}

export async function saveFaq(form: FormData) {
  const { tenant, userId, role } = await staff();
  const input = z.object({ id: idSchema.optional(), question: text(240), answer: text(1200), sortOrder: z.coerce.number().int().min(0).max(100), isEnabled: z.boolean() }).parse({
    id: value(form, "id") || undefined, question: value(form, "question"), answer: value(form, "answer"), sortOrder: value(form, "sortOrder") || "0", isEnabled: form.get("isEnabled") === "on",
  });
  const expectedRevision = form.get("revision") ? Number(form.get("revision")) : undefined;
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.FAQ, operation: input.id ? CmsDraftOperation.UPDATE : CmsDraftOperation.CREATE, targetId: input.id, expectedRevision, payload: input });
    return;
  }
  await db.$transaction(async (tx) => {
    let record;
    let before = null;
    if (input.id) {
      before = await tx.fAQ.findFirst({ where: { id: input.id, tenantId: tenant.id } });
      if (!before) throw new Error("FAQ not found.");
      record = await tx.fAQ.update({ where: { id: input.id }, data: input });
    } else record = await tx.fAQ.create({ data: { tenantId: tenant.id, ...input } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "FAQ_UPDATE", targetType: "FAQ", targetId: record.id, changeMetadata: { before: before ? { question: before.question, answer: before.answer, sortOrder: before.sortOrder, isEnabled: before.isEnabled } : null, after: { question: record.question, answer: record.answer, sortOrder: record.sortOrder, isEnabled: record.isEnabled } } } });
  });
  revalidatePath("/");
}

export async function saveFormDocument(form: FormData) {
  const { tenant, userId, role } = await staff();
  const input = z.object({ id: idSchema.optional(), title: text(160), description: z.string().trim().max(500).optional(), mediaAssetId: idSchema.optional(), category: text(50), isAnnualReport: z.boolean(), sortOrder: z.coerce.number().int().min(0).max(100), isEnabled: z.boolean() }).parse({
    id: value(form, "id") || undefined, title: value(form, "title"), description: value(form, "description") || undefined,
    mediaAssetId: value(form, "mediaAssetId") || undefined, category: value(form, "category"), isAnnualReport: form.get("isAnnualReport") === "on", sortOrder: value(form, "sortOrder") || "0", isEnabled: form.get("isEnabled") === "on",
  });
  if (input.mediaAssetId && !(await db.mediaAsset.findFirst({ where: { id: input.mediaAssetId, tenantId: tenant.id, retiredAt: null, mimeType: "application/pdf" } }))) throw new Error("A live PDF media asset is required.");
  const expectedRevision = form.get("revision") ? Number(form.get("revision")) : undefined;
  if (role === "EDITOR") {
    if (input.isAnnualReport) throw new Error("Editors cannot release annual reports.");
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.FORM_DOCUMENT, operation: input.id ? CmsDraftOperation.UPDATE : CmsDraftOperation.CREATE, targetId: input.id, expectedRevision, mediaAssetId: input.mediaAssetId, payload: input });
    return;
  }
  await db.$transaction(async (tx) => {
    await lockCmsTenant(tx, tenant.id);
    let record;
    let before = null;
    if (input.id) {
      before = await tx.formDocument.findFirst({ where: { id: input.id, tenantId: tenant.id } });
      if (!before) throw new Error("Document not found.");
      record = await tx.formDocument.update({ where: { id: input.id }, data: { ...input, publicApprovedAt: null } });
    } else record = await tx.formDocument.create({ data: { tenantId: tenant.id, ...input } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "FORM_DOCUMENT_UPDATE", targetType: "FormDocument", targetId: record.id, changeMetadata: { before: before ? { title: before.title, mediaAssetId: before.mediaAssetId, sortOrder: before.sortOrder, isEnabled: before.isEnabled } : null, after: { title: record.title, mediaAssetId: record.mediaAssetId, sortOrder: record.sortOrder, isEnabled: record.isEnabled } } } });
  });
  revalidatePath("/");
}

export async function uploadFormDocument(form: FormData) {
  const { tenant, userId, role } = await staff();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose a PDF document.");
  const input = z.object({
    title: text(160),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.coerce.number().int().min(0).max(100),
    isEnabled: z.boolean(), category: text(50), isAnnualReport: z.boolean(),
  }).parse({
    title: value(form, "title"),
    description: value(form, "description") || undefined,
    sortOrder: value(form, "sortOrder") || "0",
    isEnabled: form.get("isEnabled") === "on",
    category: value(form, "category"), isAnnualReport: form.get("isAnnualReport") === "on",
  });
  if (role === "EDITOR" && input.isAnnualReport) throw new Error("Editors cannot release annual reports.");
  const media = await uploadDocument({ tenant, actorUserId: userId, file, altText: input.title });
  if (role === "EDITOR") {
    try {
      await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.FORM_DOCUMENT, operation: CmsDraftOperation.CREATE, mediaAssetId: media.id, payload: { ...input, mediaAssetId: media.id } });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
      throw error;
    }
    return;
  }
  try {
    await db.$transaction(async (tx) => {
      await lockCmsTenant(tx, tenant.id);
      const created = await tx.formDocument.create({ data: { tenantId: tenant.id, ...input, mediaAssetId: media.id } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "FORM_DOCUMENT_CREATE", targetType: "FormDocument", targetId: created.id, changeMetadata: { before: null, after: { title: input.title, description: input.description, sortOrder: input.sortOrder, isEnabled: input.isEnabled, mediaAssetId: media.id } } } });
    });
  } catch (error) {
    await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
    throw error;
  }
  revalidatePath("/");
}

export async function removeFormDocument(form: FormData) {
  const { tenant, userId, role } = await staff();
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.formDocument.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("Document not found.");
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.FORM_DOCUMENT, operation: CmsDraftOperation.REMOVE, targetId: id, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, payload: {} });
    return;
  }
  await db.$transaction(async (tx) => {
    await tx.formDocument.update({ where: { id }, data: { isEnabled: false, mediaAssetId: null } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "FORM_DOCUMENT_REMOVE", targetType: "FormDocument", targetId: id, changeMetadata: { before: { title: existing.title, mediaAssetId: existing.mediaAssetId }, after: { removed: true } } } });
  });
  revalidatePath("/");
}

export async function setFormPublicApproval(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  const approved = value(form, "approved") === "true";
  await db.$transaction(async (tx) => {
    await lockCmsTenant(tx, tenant.id);
    const before = await tx.formDocument.findFirstOrThrow({ where: { id, tenantId: tenant.id } });
    const record = await tx.formDocument.update({ where: { id }, data: { publicApprovedAt: approved ? new Date() : null, isEnabled: approved || !before.isAnnualReport ? before.isEnabled : false } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: approved ? "FORM_DOCUMENT_PUBLIC_APPROVED" : "FORM_DOCUMENT_PUBLIC_REVOKED", targetType: "FormDocument", targetId: id, changeMetadata: { before: { publicApprovedAt: before.publicApprovedAt?.toISOString() ?? null, isEnabled: before.isEnabled }, after: { publicApprovedAt: record.publicApprovedAt?.toISOString() ?? null, isEnabled: record.isEnabled } } } });
  });
  revalidatePath("/admin/forms");
  revalidatePath("/");
}

export async function saveNewsNotice(form: FormData) {
  const { tenant, userId, role } = await staff();
  const input = z.object({ id: idSchema.optional(), title: text(180), summary: text(600), publishedAt: dateOrNull, isPublished: z.boolean() }).parse({
    id: value(form, "id") || undefined, title: value(form, "title"), summary: value(form, "summary"),
    publishedAt: value(form, "publishedAt"), isPublished: form.get("isPublished") === "on",
  });
  const expectedRevision = form.get("revision") ? Number(form.get("revision")) : undefined;
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.NEWS, operation: input.id ? CmsDraftOperation.UPDATE : CmsDraftOperation.CREATE, targetId: input.id, expectedRevision, payload: { ...input, publishedAt: input.publishedAt?.toISOString() ?? null, isPublished: true } });
    return;
  }
  await db.$transaction(async (tx) => {
    let record;
    let before = null;
    if (input.id) {
      before = await tx.newsNotice.findFirst({ where: { id: input.id, tenantId: tenant.id } });
      if (!before) throw new Error("News notice not found.");
      record = await tx.newsNotice.update({ where: { id: input.id }, data: input });
    } else record = await tx.newsNotice.create({ data: { tenantId: tenant.id, ...input } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: input.isPublished ? "NEWS_PUBLISH" : "NEWS_UPDATE", targetType: "NewsNotice", targetId: record.id, changeMetadata: { before: before ? { title: before.title, publishedAt: before.publishedAt?.toISOString(), isPublished: before.isPublished } : null, after: { title: record.title, publishedAt: record.publishedAt?.toISOString(), isPublished: record.isPublished } } } });
  });
  revalidatePath("/");
}

export async function removeNewsNotice(form: FormData) {
  const { tenant, userId, role } = await staff();
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.newsNotice.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("News notice not found.");
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.REMOVE, targetId: id, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, payload: {} });
    return;
  }
  await db.$transaction(async (tx) => {
    await tx.newsNotice.update({ where: { id }, data: { isPublished: false } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "NEWS_UNPUBLISH", targetType: "NewsNotice", targetId: id, changeMetadata: { before: { isPublished: existing.isPublished }, after: { isPublished: false } } } });
  });
  revalidatePath("/");
}

export async function removeFaq(form: FormData) {
  const { tenant, userId, role } = await staff();
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.fAQ.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("FAQ not found.");
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.FAQ, operation: CmsDraftOperation.REMOVE, targetId: id, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, payload: {} });
    return;
  }
  await db.$transaction(async (tx) => {
    await tx.fAQ.update({ where: { id }, data: { isEnabled: false } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "FAQ_REMOVE", targetType: "FAQ", targetId: id, changeMetadata: { before: { isEnabled: existing.isEnabled }, after: { isEnabled: false } } } });
  });
  revalidatePath("/");
}

export async function saveContactSettings(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const input = z.object({ organisationName: text(160), streetAddress: text(240), postalAddress: text(240), telephone: text(80), publicEmail: z.string().email().max(160), officeHours: z.string().trim().max(300).optional(), directionsUrl: z.string().url().max(500).optional(), notificationRecipients: contactRecipientsSchema }).parse({
    organisationName: value(form, "organisationName"), streetAddress: value(form, "streetAddress"), postalAddress: value(form, "postalAddress"),
    telephone: value(form, "telephone"), publicEmail: value(form, "publicEmail"), officeHours: value(form, "officeHours") || undefined, directionsUrl: value(form, "directionsUrl") || undefined, notificationRecipients: parseContactRecipientsForm(form),
  });
  const recipients = input.notificationRecipients;
  if (recipients.length) {
    const admins = await db.user.findMany({ where: { email: { in: recipients }, memberships: { some: { tenantId: tenant.id, role: "ADMINISTRATOR", isActive: true } } }, select: { email: true } });
    if (admins.length !== recipients.length) throw new Error("Notification recipients must be active Administrators for this tenant.");
  }
  await db.$transaction(async (tx) => {
    const before = await tx.contactSettings.findUnique({ where: { tenantId: tenant.id } });
    const record = await tx.contactSettings.upsert({ where: { tenantId: tenant.id }, update: { ...input, notificationRecipients: recipients }, create: { tenantId: tenant.id, ...input, notificationRecipients: recipients } });
    await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "CONTACT_SETTINGS_UPDATE", targetType: "ContactSettings", targetId: record.id, changeMetadata: { before: before ? { organisationName: before.organisationName, telephone: before.telephone, publicEmail: before.publicEmail } : null, after: { organisationName: record.organisationName, telephone: record.telephone, publicEmail: record.publicEmail } } } });
  });
  revalidatePath("/", "layout");
}

export async function uploadImage(form: FormData) {
  const { tenant, userId, role } = await staff();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose an image to upload.");
  const purpose = z.enum(["hero", "news", "general"]).parse(value(form, "purpose"));
  const media = await uploadMedia({ tenant, actorUserId: userId, file, purpose, altText: value(form, "altText") || undefined });
  if (role === "EDITOR") {
    try {
      await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.MEDIA, operation: CmsDraftOperation.UPLOAD, mediaAssetId: media.id, payload: { mediaAssetId: media.id, purpose } });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
      throw error;
    }
  }
}

export async function replaceImage(form: FormData) {
  const { tenant, userId, role } = await staff();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose an image to upload.");
  const mediaId = idSchema.parse(value(form, "mediaId"));
  if (role === "EDITOR") {
    const media = await uploadMedia({ tenant, actorUserId: userId, file, purpose: "general", altText: value(form, "altText") || undefined });
    try {
      await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.MEDIA, operation: CmsDraftOperation.REPLACE, targetId: mediaId, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, mediaAssetId: media.id, payload: { mediaAssetId: media.id } });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
      throw error;
    }
    return;
  }
  await replaceMedia({ tenant, actorUserId: userId, mediaId, file, altText: value(form, "altText") || undefined });
}

export async function retireImage(form: FormData) {
  const { tenant, userId, role } = await staff();
  const mediaId = idSchema.parse(value(form, "mediaId"));
  if (role === "EDITOR") {
    await createCmsDraft({ tenant, actorUserId: userId, kind: CmsDraftKind.MEDIA, operation: CmsDraftOperation.RETIRE, targetId: mediaId, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined, payload: {} });
    return;
  }
  await retireMedia(tenant, userId, mediaId);
  revalidatePath("/admin");
}

export async function replaceFormDocument(form: FormData) {
  const { tenant, userId, role } = await staff();
  const documentId = idSchema.parse(value(form, "id"));
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose a PDF document.");
  const existing = await db.formDocument.findFirst({ where: { id: documentId, tenantId: tenant.id }, include: { mediaAsset: true } });
  if (!existing) throw new Error("Document not found.");
  const media = await uploadDocument({ tenant, actorUserId: userId, file, altText: existing.title });
  if (role === "EDITOR") {
    try {
      await createCmsDraft({
      tenant, actorUserId: userId, kind: CmsDraftKind.FORM_DOCUMENT,
      operation: CmsDraftOperation.REPLACE, targetId: documentId, expectedRevision: form.get("revision") ? Number(form.get("revision")) : undefined,
      mediaAssetId: media.id,
      payload: {
        title: existing.title,
        description: existing.description,
        mediaAssetId: media.id,
        sortOrder: existing.sortOrder,
        isEnabled: existing.isEnabled,
      },
      });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
      throw error;
    }
    return;
  }
  try {
    await db.$transaction(async (tx) => {
      await lockCmsTenant(tx, tenant.id);
      await tx.formDocument.update({ where: { id: documentId }, data: { mediaAssetId: media.id } });
      if (existing.mediaAssetId) await retireIfUnreferenced(tx, tenant.id, existing.mediaAssetId, media.id);
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "FORM_DOCUMENT_REPLACE", targetType: "FormDocument", targetId: documentId, changeMetadata: { before: { mediaAssetId: existing.mediaAssetId }, after: { mediaAssetId: media.id, role } } } });
    });
  } catch (error) {
    await db.mediaAsset.update({ where: { id: media.id }, data: { retiredAt: new Date() } });
    throw error;
  }
  revalidatePath("/");
}

export async function publishCmsDraft(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  await publishCmsDraftWorkflow({ tenant, actorUserId: userId, draftId: idSchema.parse(value(form, "draftId")), confirmPublishedChange: value(form, "confirmPublishedChange") === "true" });
  revalidatePath("/", "layout");
}

export async function archiveCmsDraft(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  await archiveCmsDraftWorkflow({ tenant, actorUserId: userId, draftId: idSchema.parse(value(form, "draftId")) });
  revalidatePath("/admin");
}

export async function createStaffAccountAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const name = value(form, "name");
  const email = value(form, "email");
  const password = value(form, "password");
  const role = value(form, "role") as "ADMINISTRATOR" | "EDITOR";
  if (!name || !email || password.length < 8 || !["ADMINISTRATOR", "EDITOR"].includes(role)) throw new Error("Enter a name, a valid email, a supported setup password and a role.");
  await createStaffAccount({ tenant, actorUserId: userId, name, email, password, role });
  revalidatePath("/admin/staff");
}

export async function changeStaffRoleAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  await changeStaffRole({ tenant, actorUserId: userId, membershipId: value(form, "membershipId"), role: value(form, "role") as "ADMINISTRATOR" | "EDITOR" });
  revalidatePath("/admin/staff");
}

export async function setStaffActiveAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  await setStaffAccountActive({ tenant, actorUserId: userId, membershipId: value(form, "membershipId"), isActive: value(form, "isActive") === "true" });
  revalidatePath("/admin/staff");
}

export async function initiateStaffPasswordResetAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ?? requestHeaders.get("host");
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error("A validated tenant origin is unavailable.");
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() === "https" ? "https" : "http";
  const result = await initiateStaffPasswordReset({ tenant, actorUserId: userId, membershipId: idSchema.parse(value(form, "membershipId")), baseUrl: `${proto}://${host}` });
  revalidatePath("/admin/staff");
  return result;
}

export async function initiateStaffPasswordResetFormAction(form: FormData) {
  await initiateStaffPasswordResetAction(form);
}

export async function completeStaffPasswordResetAction(form: FormData) {
  const membershipId = idSchema.parse(value(form, "membershipId"));
  const token = value(form, "token");
  const password = value(form, "password");
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) throw new Error("Use at least 12 characters with upper-case, lower-case and a number.");
  try {
    await completeStaffPasswordReset({ membershipId, token, password });
  } catch {
    throw new Error("This password reset link is invalid or expired.");
  }
}

export async function savePageContentDraft(form: FormData) {
  const { tenant, userId, role } = await staff();
  const slot = text(60).parse(value(form, "slot"));
  if (!PAGE_CONTENT_SLOTS.includes(slot as (typeof PAGE_CONTENT_SLOTS)[number])) throw new Error("Unknown fixed page content slot.");
  if (role === "EDITOR" && ["PRIVACY", "TERMS_OF_USE", "ACCESSIBILITY"].includes(slot)) throw new Error("Only Administrators may manage legal content.");
  const expectedRevision = form.get("revision") ? Number(form.get("revision")) : undefined;
  await createCmsDraft({
    tenant,
    actorUserId: userId,
    kind: CmsDraftKind.PAGE_CONTENT,
    operation: CmsDraftOperation.UPDATE,
    targetId: `${tenant.id}:page:${slot}`,
    expectedRevision,
    payload: {
      slot,
      heading: value(form, "heading") || null,
      body: value(form, "body") || null,
    },
  });
  revalidatePath("/admin");
}

export async function updateContactEnquiryAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  const status = z.enum(["NEW", "BEING_HANDLED", "CLOSED"]).parse(value(form, "status"));
  const note = z.string().trim().max(1000).parse(value(form, "note"));
  await updateContactStatus({ tenant, actorUserId: userId, id, status, note });
  revalidatePath("/admin/contact");
}

export async function openContactEnquiryAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  await openContactEnquiry({ tenant, actorUserId: userId, id });
  revalidatePath("/admin/contact");
}

export async function saveRateFeeAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const input = z.object({
    category: text(40), product: text(120), label: text(160), displayValue: text(120),
    note: z.string().trim().max(500).optional(), effectiveAt: dateOrNull, sortOrder: z.coerce.number().int().min(0).max(999), isEnabled: z.boolean(),
  }).parse({ category: value(form, "category"), product: value(form, "product"), label: value(form, "label"), displayValue: value(form, "displayValue"), note: value(form, "note") || undefined, effectiveAt: value(form, "effectiveAt"), sortOrder: value(form, "sortOrder") || 0, isEnabled: checkbox(form, "isEnabled") });
  const id = value(form, "id");
  if (id && !(await db.rateFee.findFirst({ where: { id, tenantId: tenant.id }, select: { id: true } }))) throw new Error("Rate does not belong to this tenant.");
  const record = await db.$transaction(async (tx) => {
    await lockCmsTenant(tx, tenant.id);
    return id ? tx.rateFee.update({ where: { id }, data: input }) : tx.rateFee.create({ data: { tenantId: tenant.id, ...input } });
  });
  await db.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "RATE_FEE_UPDATED", targetType: "RateFee", targetId: record.id, changeMetadata: { published: false } } });
  revalidatePath("/admin/rates");
}

export async function saveCalculatorSettingsAction() {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const record = await db.calculatorSettings.upsert({
    where: { tenantId: tenant.id },
    update: { status: "AWAITING_SWCU_CONFIGURATION", isEnabled: false },
    create: { tenantId: tenant.id, status: "AWAITING_SWCU_CONFIGURATION", isEnabled: false },
  });
  await db.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "CALCULATOR_SETTINGS_UPDATED", targetType: "CalculatorSettings", targetId: record.id, changeMetadata: { enabled: false } } });
  revalidatePath("/admin/calculator");
}

export async function saveLeadershipAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const input = z.object({ name: text(160), title: text(160), group: text(80), profile: z.string().trim().max(1000).optional(), sortOrder: z.coerce.number().int().min(0).max(999), mediaAssetId: idSchema.optional() }).parse({ name: value(form, "name"), title: value(form, "title"), group: value(form, "group"), profile: value(form, "profile") || undefined, sortOrder: value(form, "sortOrder") || 0, mediaAssetId: value(form, "mediaAssetId") || undefined });
  if (input.mediaAssetId && !(await db.mediaAsset.findFirst({ where: { id: input.mediaAssetId, tenantId: tenant.id, retiredAt: null, mimeType: { startsWith: "image/" } } }))) throw new Error("Approved active image media is required.");
  const record = await db.$transaction(async (tx) => { await lockCmsTenant(tx, tenant.id); return tx.leadershipRecord.create({ data: { tenantId: tenant.id, ...input } }); });
  await db.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "LEADERSHIP_RECORD_CREATED", targetType: "LeadershipRecord", targetId: record.id, changeMetadata: { group: record.group } } });
  revalidatePath("/admin/leadership");
}

export async function updateLeadershipAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.leadershipRecord.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("Leadership record not found.");
  const data = z.object({ name: text(160), title: text(160), group: text(80), profile: z.string().trim().max(1000).optional(), sortOrder: z.coerce.number().int().min(0).max(999), mediaAssetId: idSchema.optional(), isEnabled: z.boolean(), isPublished: z.boolean() }).parse({ name: value(form, "name"), title: value(form, "title"), group: value(form, "group"), profile: value(form, "profile") || undefined, sortOrder: value(form, "sortOrder") || 0, mediaAssetId: value(form, "mediaAssetId") || undefined, isEnabled: checkbox(form, "isEnabled"), isPublished: checkbox(form, "isPublished") });
  if (data.mediaAssetId && !(await db.mediaAsset.findFirst({ where: { id: data.mediaAssetId, tenantId: tenant.id, retiredAt: null, mimeType: { startsWith: "image/" } } }))) throw new Error("Approved active image media is required.");
  await db.$transaction(async (tx) => { await lockCmsTenant(tx, tenant.id); const before = await tx.leadershipRecord.findUniqueOrThrow({ where: { id } }); const updated = await tx.leadershipRecord.update({ where: { id }, data }); await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "LEADERSHIP_RECORD_UPDATED", targetType: "LeadershipRecord", targetId: id, changeMetadata: { before: { group: before.group, sortOrder: before.sortOrder, isEnabled: before.isEnabled, isPublished: before.isPublished }, after: { group: updated.group, sortOrder: updated.sortOrder, isEnabled: updated.isEnabled, isPublished: updated.isPublished } } } }); });
  revalidatePath("/admin/leadership");
}

export async function updateRateFeeAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const id = idSchema.parse(value(form, "id"));
  const existing = await db.rateFee.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) throw new Error("Rate not found.");
  const data = z.object({ category: text(40), product: text(120), label: text(160), displayValue: text(120), note: z.string().trim().max(500).optional(), sortOrder: z.coerce.number().int().min(0).max(999), isEnabled: z.boolean(), isPublished: z.boolean(), effectiveAt: dateOrNull }).parse({ category: value(form, "category"), product: value(form, "product"), label: value(form, "label"), displayValue: value(form, "displayValue"), note: value(form, "note") || undefined, sortOrder: value(form, "sortOrder") || 0, isEnabled: checkbox(form, "isEnabled"), isPublished: checkbox(form, "isPublished"), effectiveAt: value(form, "effectiveAt") });
  await db.$transaction(async (tx) => { await lockCmsTenant(tx, tenant.id); const before = await tx.rateFee.findUniqueOrThrow({ where: { id } }); const updated = await tx.rateFee.update({ where: { id }, data }); await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: userId, action: "RATE_FEE_UPDATED", targetType: "RateFee", targetId: id, changeMetadata: { before: { category: before.category, isEnabled: before.isEnabled, isPublished: before.isPublished }, after: { category: updated.category, isEnabled: updated.isEnabled, isPublished: updated.isPublished } } } }); });
  revalidatePath("/admin/rates");
}

export async function disableEditorWithReassignmentAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  const membershipId = value(form, "membershipId");
  const assigneeUserId = value(form, "assigneeUserId");
  if (!assigneeUserId) throw new Error("Choose an active Editor before disabling this account.");
  await disableEditorWithReassignment({ tenant, actorUserId: userId, membershipId, assigneeUserId });
  revalidatePath("/admin/staff");
  revalidatePath("/admin/drafts");
}

export async function reassignDraftAction(form: FormData) {
  const { tenant, userId } = await staff(["ADMINISTRATOR"]);
  await reassignCmsDraft({ tenant, actorUserId: userId, draftId: value(form, "draftId"), assigneeUserId: value(form, "assigneeUserId") });
  revalidatePath("/admin/staff");
  revalidatePath("/admin/drafts");
}