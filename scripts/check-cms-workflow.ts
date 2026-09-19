import { File as NodeFile } from "node:buffer";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { db } from "../src/lib/db";
import {
  CmsDraftKind,
  CmsDraftOperation,
  CmsDraftStatus,
} from "../src/generated/prisma/client";
import { createCmsDraft, publishCmsDraft, archiveCmsDraft } from "../src/lib/cms-workflow";
import { uploadDocument, uploadMedia } from "../src/lib/media-service";
import { getR2Client } from "../src/lib/r2";
import { mediaCacheControl } from "../src/lib/media-cache";
import { canServeMedia } from "../src/lib/media-access";

const suffix = Date.now().toString(36);
const mediaKeys: string[] = [];
const mediaIds: string[] = [];
const draftIds: string[] = [];
let tenantId: string | undefined;
let editorId: string | undefined;
let adminId: string | undefined;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const tenant = await db.tenant.create({
    data: { slug: `prompt2-workflow-${suffix}`, displayName: "Prompt 2 workflow QA" },
  });
  tenantId = tenant.id;
  const editor = await db.user.create({
    data: { id: crypto.randomUUID(), name: "Workflow Editor", email: `workflow-editor-${suffix}@example.invalid`, emailVerified: false },
  });
  const admin = await db.user.create({
    data: { id: crypto.randomUUID(), name: "Workflow Administrator", email: `workflow-admin-${suffix}@example.invalid`, emailVerified: false },
  });
  editorId = editor.id;
  adminId = admin.id;
  await db.staffMembership.createMany({
    data: [
      { tenantId: tenant.id, userId: editor.id, role: "EDITOR" },
      { tenantId: tenant.id, userId: admin.id, role: "ADMINISTRATOR" },
    ],
  });

  const image = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#176DB3" } }).jpeg().toBuffer();
  const replacementImage = await sharp({ create: { width: 700, height: 450, channels: 3, background: "#168887" } }).jpeg().toBuffer();
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "ascii");
  const resolved = { id: tenant.id, slug: tenant.slug, displayName: tenant.displayName };

  const heroMedia = await uploadMedia({ tenant: resolved, actorUserId: admin.id, purpose: "hero", altText: "Published hero", file: new NodeFile([image], "hero.jpg", { type: "image/jpeg" }) as unknown as File });
  const heroReplacement = await uploadMedia({ tenant: resolved, actorUserId: editor.id, purpose: "hero", altText: "Draft hero", file: new NodeFile([replacementImage], "hero-replacement.jpg", { type: "image/jpeg" }) as unknown as File });
  const formMedia = await uploadDocument({ tenant: resolved, actorUserId: admin.id, altText: "Published form", file: new NodeFile([pdf], "published.pdf", { type: "application/pdf" }) as unknown as File });
  const formReplacement = await uploadDocument({ tenant: resolved, actorUserId: editor.id, altText: "Draft form", file: new NodeFile([pdf], "replacement.pdf", { type: "application/pdf" }) as unknown as File });
  mediaIds.push(heroMedia.id, heroReplacement.id, formMedia.id, formReplacement.id);
  mediaKeys.push(heroMedia.objectKey, heroReplacement.objectKey, formMedia.objectKey, formReplacement.objectKey);

  const hero = await db.homeHeroSlide.create({ data: { tenantId: tenant.id, mediaAssetId: heroMedia.id, altText: "Published hero", isEnabled: true } });
  const form = await db.formDocument.create({ data: { tenantId: tenant.id, mediaAssetId: formMedia.id, title: "Published form", isEnabled: true } });
  const news = await db.newsNotice.create({ data: { tenantId: tenant.id, title: "Published news", summary: "Published summary", isPublished: true, publishedAt: new Date() } });
  const faq = await db.fAQ.create({ data: { tenantId: tenant.id, question: "Published question", answer: "Published answer", isEnabled: true } });
  const notice = await db.siteNotice.create({ data: { tenantId: tenant.id, message: "Published notice", isEnabled: false } });

  const newsDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, payload: { title: "Draft news", summary: "Draft summary", publishedAt: null, isPublished: true } });
  const newNewsDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.CREATE, payload: { title: "New draft news", summary: "New draft summary", publishedAt: null, isPublished: true } });
  const faqDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.FAQ, operation: CmsDraftOperation.UPDATE, targetId: faq.id, payload: { question: "Draft question", answer: "Draft answer", sortOrder: 0, isEnabled: true } });
  const formDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.FORM_DOCUMENT, operation: CmsDraftOperation.REPLACE, targetId: form.id, mediaAssetId: formReplacement.id, payload: { title: "Published form", mediaAssetId: formReplacement.id, sortOrder: 0, isEnabled: true } });
  const heroDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.REPLACE, targetId: hero.id, mediaAssetId: heroReplacement.id, payload: { mediaAssetId: heroReplacement.id, altText: "Draft hero" } });
  const noticeDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.SITE_NOTICE, operation: CmsDraftOperation.UPDATE, targetId: notice.id, payload: { message: "Draft notice", isEnabled: true, actionText: null, actionUrl: null, startsAt: null, endsAt: null } });
  draftIds.push(newsDraft.id, newNewsDraft.id, faqDraft.id, formDraft.id, heroDraft.id, noticeDraft.id);

  const unchanged = await Promise.all([
    db.newsNotice.findUniqueOrThrow({ where: { id: news.id } }),
    db.fAQ.findUniqueOrThrow({ where: { id: faq.id } }),
    db.formDocument.findUniqueOrThrow({ where: { id: form.id } }),
    db.homeHeroSlide.findUniqueOrThrow({ where: { id: hero.id } }),
    db.siteNotice.findUniqueOrThrow({ where: { id: notice.id } }),
  ]);
  check(unchanged[0].title === "Published news" && unchanged[1].question === "Published question", "Editor drafts changed live News/FAQ.");
  check(unchanged[2].mediaAssetId === formMedia.id && unchanged[3].mediaAssetId === heroMedia.id, "Editor drafts changed live media references.");
  check(unchanged[4].message === "Published notice" && !unchanged[4].isEnabled, "Editor draft changed live Site Notice.");

  let rejected = false;
  try { await publishCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: newsDraft.id }); } catch { rejected = true; }
  check(rejected, "Editor direct publish was not rejected.");

  for (const draftId of [newsDraft.id, newNewsDraft.id, faqDraft.id, formDraft.id, heroDraft.id, noticeDraft.id]) {
    await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId });
  }
  const [publishedNews, publishedFaq, publishedForm, publishedHero, publishedNotice, oldHero, oldForm] = await Promise.all([
    db.newsNotice.findUniqueOrThrow({ where: { id: news.id } }),
    db.fAQ.findUniqueOrThrow({ where: { id: faq.id } }),
    db.formDocument.findUniqueOrThrow({ where: { id: form.id } }),
    db.homeHeroSlide.findUniqueOrThrow({ where: { id: hero.id } }),
    db.siteNotice.findUniqueOrThrow({ where: { id: notice.id } }),
    db.mediaAsset.findUniqueOrThrow({ where: { id: heroMedia.id } }),
    db.mediaAsset.findUniqueOrThrow({ where: { id: formMedia.id } }),
  ]);
  check(publishedNews.title === "Draft news" && publishedFaq.question === "Draft question", "Administrator publish did not apply News/FAQ.");
  check(publishedNews.publishedAt !== null && publishedNews.isPublished, "News publish did not assign a public eligibility date.");
  check(Boolean(await db.newsNotice.findFirst({ where: { tenantId: tenant.id, title: "New draft news", isPublished: true, publishedAt: { not: null } } })), "New News draft did not publish as publicly eligible.");
  check(publishedForm.mediaAssetId === formReplacement.id && publishedHero.mediaAssetId === heroReplacement.id, "Administrator publish did not apply media replacements.");
  check(publishedNotice.message === "Draft notice" && publishedNotice.isEnabled, "Administrator publish did not apply Site Notice.");
  check(publishedNotice.actionText === null && publishedNotice.actionUrl === null, "Site Notice action fields were not cleared.");
  check(oldHero.retiredAt && oldHero.replacedById === heroReplacement.id && oldForm.retiredAt && oldForm.replacedById === formReplacement.id, "Old media was not retired/recoverable after publish.");
  check((await db.mediaAsset.findUniqueOrThrow({ where: { id: heroReplacement.id } })).retiredAt === null, "Draft Hero media is not active after publish.");
  const sharedHero = await db.homeHeroSlide.create({ data: { tenantId: tenant.id, mediaAssetId: heroReplacement.id, altText: "Shared hero", isEnabled: true } });
  const sharedHeroRemove = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.REMOVE, targetId: sharedHero.id, payload: {} });
  await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: sharedHeroRemove.id });
  check((await db.mediaAsset.findUniqueOrThrow({ where: { id: heroReplacement.id } })).retiredAt === null, "Shared Hero REMOVE retired an asset still referenced.");
  const sharedHeroReplace = await db.homeHeroSlide.create({ data: { tenantId: tenant.id, mediaAssetId: heroReplacement.id, altText: "Shared replace", isEnabled: true } });
  const heroReplaceMedia = await uploadMedia({ tenant: resolved, actorUserId: editor.id, purpose: "hero", altText: "Shared replacement", file: new NodeFile([image], "shared-hero-replacement.jpg", { type: "image/jpeg" }) as unknown as File });
  mediaIds.push(heroReplaceMedia.id);
  mediaKeys.push(heroReplaceMedia.objectKey);
  const sharedHeroReplaceDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.HERO, operation: CmsDraftOperation.REPLACE, targetId: sharedHeroReplace.id, mediaAssetId: heroReplaceMedia.id, payload: { mediaAssetId: heroReplaceMedia.id, altText: "Shared replacement" } });
  await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: sharedHeroReplaceDraft.id });
  check((await db.mediaAsset.findUniqueOrThrow({ where: { id: heroReplacement.id } })).retiredAt === null, "Shared Hero REPLACE retired an asset still referenced.");
  const sharedForm = await db.formDocument.create({ data: { tenantId: tenant.id, mediaAssetId: formReplacement.id, title: "Shared form", isEnabled: true } });
  const sharedFormReplacement = await uploadDocument({ tenant: resolved, actorUserId: editor.id, altText: "Shared form replacement", file: new NodeFile([pdf], "shared-replacement.pdf", { type: "application/pdf" }) as unknown as File });
  mediaIds.push(sharedFormReplacement.id);
  mediaKeys.push(sharedFormReplacement.objectKey);
  const sharedFormDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.FORM_DOCUMENT, operation: CmsDraftOperation.REPLACE, targetId: form.id, mediaAssetId: sharedFormReplacement.id, payload: { title: form.title, mediaAssetId: sharedFormReplacement.id, isEnabled: true } });
  await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: sharedFormDraft.id });
  check((await db.mediaAsset.findUniqueOrThrow({ where: { id: formReplacement.id } })).retiredAt === null, "Shared Form replacement retired an asset still referenced.");
  const finalFormDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.FORM_DOCUMENT, operation: CmsDraftOperation.REPLACE, targetId: sharedForm.id, mediaAssetId: sharedFormReplacement.id, payload: { title: sharedForm.title, mediaAssetId: sharedFormReplacement.id, isEnabled: true } });
  await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: finalFormDraft.id });
  check((await db.mediaAsset.findUniqueOrThrow({ where: { id: formReplacement.id } })).retiredAt !== null, "Final Form reference move did not retire the old PDF.");
  const archived = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.FAQ, operation: CmsDraftOperation.UPDATE, targetId: faq.id, payload: { question: "Archived", answer: "Archived", sortOrder: 0, isEnabled: true } });
  draftIds.push(archived.id);
  await archiveCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: archived.id });
  check((await db.cmsDraft.findUniqueOrThrow({ where: { id: archived.id } })).status === CmsDraftStatus.ARCHIVED, "Archive action did not archive the draft.");

  const otherTenant = await db.tenant.create({ data: { slug: `prompt2-other-${suffix}`, displayName: "Other tenant" } });
  const otherAdmin = await db.user.create({ data: { id: crypto.randomUUID(), name: "Other Administrator", email: `workflow-other-${suffix}@example.invalid`, emailVerified: false } });
  await db.staffMembership.create({ data: { tenantId: otherTenant.id, userId: otherAdmin.id, role: "ADMINISTRATOR" } });
  try {
    const otherResolved = { id: otherTenant.id, slug: otherTenant.slug, displayName: otherTenant.displayName };
    let targetRejected = false;
    try { await createCmsDraft({ tenant: otherResolved, actorUserId: otherAdmin.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, payload: { title: "forged", summary: "forged" } }); } catch { targetRejected = true; }
    check(targetRejected, "Forged cross-tenant target was accepted.");
    let mediaRejected = false;
    try { await createCmsDraft({ tenant: otherResolved, actorUserId: otherAdmin.id, kind: CmsDraftKind.MEDIA, operation: CmsDraftOperation.REPLACE, targetId: heroMedia.id, mediaAssetId: heroReplacement.id, payload: { mediaAssetId: heroReplacement.id } }); } catch { mediaRejected = true; }
    check(mediaRejected, "Forged cross-tenant media was accepted.");
    let publishRejected = false;
    try { await publishCmsDraft({ tenant: otherResolved, actorUserId: otherAdmin.id, draftId: newsDraft.id }); } catch { publishRejected = true; }
    check(publishRejected, "Cross-tenant publish was not rejected.");
  } finally {
    await db.staffMembership.deleteMany({ where: { tenantId: otherTenant.id } });
    await db.tenant.delete({ where: { id: otherTenant.id } });
    await db.user.delete({ where: { id: otherAdmin.id } });
  }

  const auditActions = await db.auditLog.findMany({ where: { tenantId: tenant.id }, select: { action: true, actorUserId: true, changeMetadata: true } });
  check(auditActions.some((entry) => entry.action === "CMS_DRAFT_CREATED"), "Draft audit action missing.");
  check(auditActions.some((entry) => entry.action === "CMS_DRAFT_PUBLISHED"), "Publish audit action missing.");
  check(auditActions.some((entry) => entry.action === "CMS_DRAFT_ARCHIVED"), "Archive audit action missing.");
  const createdAudit = auditActions.find((entry) => entry.action === "CMS_DRAFT_CREATED");
  const publishedAudit = auditActions.find((entry) => entry.action === "CMS_DRAFT_PUBLISHED");
  check(createdAudit?.actorUserId === editor.id && createdAudit.changeMetadata && JSON.stringify(createdAudit.changeMetadata).includes("EDITOR"), "Draft creator audit metadata missing.");
  check(publishedAudit?.actorUserId === admin.id && publishedAudit.changeMetadata && JSON.stringify(publishedAudit.changeMetadata).includes("ADMINISTRATOR"), "Draft approver audit metadata missing.");
  check(mediaCacheControl(true) === "public, max-age=3600" && mediaCacheControl(false) === "private, no-store", "Media cache policy is incorrect.");
  check(canServeMedia({ isPublished: true }) && canServeMedia({ isPublished: false, membershipRole: "EDITOR", membershipActive: true }) && !canServeMedia({ isPublished: false, membershipRole: "EDITOR", membershipActive: false }) && !canServeMedia({ isPublished: false }), "Media authorization policy is incorrect.");
  console.info(JSON.stringify({ editorDraftIsolation: "passed", editorPublishRejected: "passed", administratorPublish: "passed", mediaRecovery: "passed", tenantIsolation: "passed", auditDistinction: "passed" }));
}

async function cleanup() {
  if (tenantId) {
    await db.auditLog.deleteMany({ where: { tenantId } });
    await db.cmsDraft.deleteMany({ where: { tenantId } });
    await db.formDocument.deleteMany({ where: { tenantId } });
    await db.homeHeroSlide.deleteMany({ where: { tenantId } });
    await db.newsNotice.deleteMany({ where: { tenantId } });
    await db.fAQ.deleteMany({ where: { tenantId } });
    await db.siteNotice.deleteMany({ where: { tenantId } });
    await db.staffMembership.deleteMany({ where: { tenantId } });
    await db.mediaAsset.deleteMany({ where: { tenantId } });
    await db.tenant.delete({ where: { id: tenantId } });
  }
  if (adminId) await db.user.deleteMany({ where: { id: adminId } });
  if (editorId) await db.user.deleteMany({ where: { id: editorId } });
  const client = getR2Client();
  await Promise.all(mediaKeys.map((Key) => client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key }))));
  client.destroy();
  await db.$disconnect();
}

main().finally(cleanup).catch((error) => { console.error(error); process.exitCode = 1; });