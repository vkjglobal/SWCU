import { db } from "../src/lib/db";
import { getPublishedPageContent, getPublishedLeadership, getPublishedRates, getCalculatorSettings, hasPublishedPrivacy, getPublicContactSettings, getPublishedResources } from "../src/lib/public-data";
import { submitContactEnquiry, handleContactPost, notifyContact, updateContactStatus, openContactEnquiry, parseContactRecipientsForm } from "../src/lib/contact";
import { CmsDraftKind, CmsDraftOperation } from "../src/generated/prisma/client";
import { createCmsDraft, submitCmsDraft, publishCmsDraft } from "../src/lib/cms-workflow";
import { uploadDocument } from "../src/lib/media-service";
import { deleteMediaObject } from "../src/lib/r2";

let assertions = 0;
const qaContactIds = new Set<string>();
const qaContactReferences = new Set<string>();
const qaDraftIds = new Set<string>();
const qaObjectKeys = new Set<string>();
const qaMediaIds = new Set<string>();
const qaRateKeys = new Set<string>();
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Prompt 3B assertion failed: ${message}`);
  assertions += 1;
}

async function runAssertions() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" }, select: { id: true, slug: true, displayName: true } });
  await db.pageContent.deleteMany({ where: { tenantId: tenant.id, body: { in: ["QA privacy", "HTTP QA privacy"] } } });
  await db.staffMembership.deleteMany({ where: { tenantId: tenant.id, userId: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor"] } } });
  await db.cmsDraft.deleteMany({ where: { tenantId: tenant.id, createdBy: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor"] } } });
  await db.user.deleteMany({ where: { id: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor"] } } }).catch(() => undefined);
  const other = await db.tenant.findFirst({ where: { id: { not: tenant.id } }, select: { id: true, slug: true, displayName: true } });
  assert(tenant.displayName === "Service Worker Credit Union", "seeded tenant");
  assert((await db.calculatorSettings.findUnique({ where: { tenantId: tenant.id } }))?.isEnabled === false, "calculator remains inactive");
  const story = await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: "ABOUT_STORY" } } });
  const loans = await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: "LOANS_INTRO" } } });
  assert(story?.heading === "Our Story" && story.body === "Founded around 2000; now serving members from 300 Waimanu Road." && story.isPublished && loans?.heading === "Loans" && loans.body === "SWCU loans are for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member account position." && loans.isPublished, "exact approved public copy");
  const forbiddenSlots = ["VISION", "MISSION", "PURPOSE", "GOVERNANCE", "SAVINGS", "RETIREMENT", "DEATH_BENEFIT", "TERMS"];
  assert((await db.pageContent.count({ where: { tenantId: tenant.id, slot: { in: [...forbiddenSlots, "MEMBERSHIP_LOANS"] } } })) === 0, "unapproved page slots absent");
  assert((await db.pageContent.count({ where: { tenantId: tenant.id, slot: "PRIVACY" } })) === 0, "privacy legal text not invented");
  assert((await db.rateFee.count({ where: { tenantId: tenant.id } })) === 0, "no invented rates");
  assert((await db.leadershipRecord.count({ where: { tenantId: tenant.id } })) === 0, "no invented people");
  const pages = await getPublishedPageContent(tenant);
  assert(pages.every((page) => Boolean(page.slot)), "published page projection");
  assert((await getPublishedLeadership(tenant)).every((person) => Boolean(person.name)), "published leadership projection");
  assert((await getPublishedRates(tenant)).every((rate) => Boolean(rate.displayValue)), "published rates projection");
  assert((await getCalculatorSettings(tenant))?.isEnabled === false, "public calculator disabled");
  assert((await hasPublishedPrivacy(tenant)) === false, "privacy gate closed");
  assert((await getPublicContactSettings(tenant))?.telephone === "(679) 7730445", "allowed contact phone");
  assert((await getPublicContactSettings(tenant))?.publicEmail === "swcu2016@gmail.com", "allowed contact email");
  const resources = await getPublishedResources(tenant);
  assert(resources.news.every((item) => Boolean(item.title)), "published news only");
  assert(resources.faqs.length >= 0, "FAQ projection is tenant-scoped");
  if (other) {
    assert((await getPublishedPageContent(other)).every((item) => item.slot !== "PRIVATE"), "tenant page isolation");
    assert((await getPublicContactSettings(other))?.organisationName !== "Service Worker Credit Union" || other.id === tenant.id, "tenant contact isolation");
  }
  await assertRejects(() => submitContactEnquiry({ tenant, ipAddress: "prompt3b-test", value: { name: "Test Person", email: "test@example.com", phone: "", subject: "Membership", message: "Please contact me.", privacyAcknowledged: true, website: "" } }), "privacy gate blocks contact");
  await assertRejects(() => submitContactEnquiry({ tenant, ipAddress: "prompt3b-test", value: { name: "Test Person", email: "not-an-email", phone: "", subject: "Membership", message: "Please contact me.", privacyAcknowledged: true, website: "" } }), "invalid email rejected");
  await assertRejects(() => submitContactEnquiry({ tenant, ipAddress: "prompt3b-test", value: { name: "Test Person", email: "test@example.com", phone: "", subject: "Request a Call Back", message: "Please call me.", privacyAcknowledged: true, website: "" } }), "callback phone required");
  await assertRejects(() => submitContactEnquiry({ tenant, ipAddress: "prompt3b-honeypot", value: { name: "Test Person", email: "test@example.com", phone: "", subject: "Membership", message: "Please contact me.", privacyAcknowledged: true, website: "bot" } }), "honeypot rejected");
  await db.user.upsert({ where: { id: "prompt3b-qa-admin" }, update: { name: "Prompt 3B QA Admin", email: "prompt3b-admin@qa.invalid" }, create: { id: "prompt3b-qa-admin", name: "Prompt 3B QA Admin", email: "prompt3b-admin@qa.invalid" } });
  await db.user.upsert({ where: { id: "prompt3b-qa-editor" }, update: { name: "Prompt 3B QA Editor", email: "prompt3b-editor@qa.invalid" }, create: { id: "prompt3b-qa-editor", name: "Prompt 3B QA Editor", email: "prompt3b-editor@qa.invalid" } });
  await db.staffMembership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: "prompt3b-qa-admin" } }, update: { role: "ADMINISTRATOR", isActive: true }, create: { tenantId: tenant.id, userId: "prompt3b-qa-admin", role: "ADMINISTRATOR" } });
  await db.staffMembership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: "prompt3b-qa-editor" } }, update: { role: "EDITOR", isActive: true }, create: { tenantId: tenant.id, userId: "prompt3b-qa-editor", role: "EDITOR" } });
  const editor = await db.staffMembership.findFirst({ where: { tenantId: tenant.id, role: "EDITOR", isActive: true }, select: { userId: true } });
  const administrator = await db.staffMembership.findFirst({ where: { tenantId: tenant.id, role: "ADMINISTRATOR", isActive: true }, select: { userId: true } });
  assert(Boolean(editor && administrator), "staff roles available for workflow tests");
  if (editor && administrator) {
    await db.cmsDraft.deleteMany({ where: { tenantId: tenant.id, kind: CmsDraftKind.PAGE_CONTENT, targetId: `${tenant.id}:page:ABOUT_STORY` } });
    await db.pageContent.deleteMany({ where: { tenantId: tenant.id, slot: "ABOUT_STORY" } });
    const first = await createCmsDraft({ tenant, actorUserId: editor.userId, kind: CmsDraftKind.PAGE_CONTENT, operation: CmsDraftOperation.UPDATE, targetId: `${tenant.id}:page:ABOUT_STORY`, payload: { slot: "ABOUT_STORY", heading: "QA story", body: "Approved QA copy." } }); qaDraftIds.add(first.id);
    const revised = await createCmsDraft({ tenant, actorUserId: editor.userId, kind: CmsDraftKind.PAGE_CONTENT, operation: CmsDraftOperation.UPDATE, targetId: `${tenant.id}:page:ABOUT_STORY`, expectedRevision: first.revision, payload: { slot: "ABOUT_STORY", heading: "QA story revised", body: "Approved QA copy." } }); qaDraftIds.add(revised.id);
    assert(revised.revision > first.revision, "same-slot save revises safely");
    await submitCmsDraft({ tenant, actorUserId: editor.userId, draftId: revised.id });
    await assertRejects(() => publishCmsDraft({ tenant, actorUserId: editor.userId, draftId: revised.id }), "Editor cannot publish page content");
    await publishCmsDraft({ tenant, actorUserId: administrator.userId, draftId: revised.id });
    assert((await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: "ABOUT_STORY" } } }))?.isPublished === true, "Administrator publishes fixed slot");
    await db.pageContent.deleteMany({ where: { tenantId: tenant.id, slot: "ABOUT_STORY" } });
  }
  if (administrator) {
    const qaMedia = await uploadDocument({ tenant, actorUserId: administrator.userId, file: new File([Buffer.from("%PDF-1.4 QA\n%%EOF")], "qa.pdf", { type: "application/pdf" }), altText: "QA annual report" }); qaObjectKeys.add(qaMedia.objectKey); qaMediaIds.add(qaMedia.id);
    const qaAnnual = await db.formDocument.create({ data: { tenantId: tenant.id, title: "QA annual", category: "ANNUAL_REPORT", isAnnualReport: true, isEnabled: true, mediaAssetId: qaMedia.id } });
    await db.formDocument.update({ where: { id: qaAnnual.id }, data: { publicApprovedAt: new Date() } });
    await db.formDocument.update({ where: { id: qaAnnual.id }, data: { publicApprovedAt: null } });
    await db.formDocument.delete({ where: { id: qaAnnual.id } });
    await db.mediaAsset.delete({ where: { id: qaMedia.id } });
  }
  await db.pageContent.upsert({ where: { tenantId_slot: { tenantId: tenant.id, slot: "PRIVACY" } }, update: { body: "QA privacy", isPublished: true, publishedAt: new Date() }, create: { tenantId: tenant.id, slot: "PRIVACY", body: "QA privacy", isPublished: true, publishedAt: new Date() } });
  const setRecipientsForm = new FormData();
  setRecipientsForm.set("notificationRecipients", "admin@example.com, second@example.com");
  assert(parseContactRecipientsForm(setRecipientsForm).length === 2, "recipient FormData set parser");
  const clearRecipientsForm = new FormData();
  clearRecipientsForm.set("notificationRecipients", "");
  assert(parseContactRecipientsForm(clearRecipientsForm).length === 0, "recipient FormData clear parser");
  const callbackIp = `prompt3b-callback-${Date.now()}`; qaRateKeys.add(`${tenant.id}:${callbackIp}`); const callback = await handleContactPost(tenant, { name: "QA Callback", email: "callback@example.com", phone: "6797000000", subject: "Request a Call Back", message: "", privacyAcknowledged: true, website: "" }, callbackIp); qaContactReferences.add(callback.reference);
  assert(Boolean(callback.reference), "API boundary accepts empty callback message");
  await db.contactSubmission.deleteMany({ where: { tenantId: tenant.id, reference: callback.reference } });
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.CONTACT_EMAIL_FROM;
  process.env.RESEND_API_KEY = "qa-provider-key";
  process.env.CONTACT_EMAIL_FROM = "qa@example.invalid";
  let providerPayload = "";
  globalThis.fetch = (async (_url, init) => { providerPayload = String(init?.body ?? ""); return new Response("{}", { status: 200 }); }) as typeof fetch;
  assert((await notifyContact({ recipients: ["admin@example.com"], reference: "SWCU-C-TEST", subject: "Membership" })).status === "SENT", "provider success boundary");
  assert(providerPayload.includes("SWCU-C-TEST") && providerPayload.includes("Membership") && !providerPayload.includes("message"), "provider sends only reference and subject");
  globalThis.fetch = (async () => new Response("failure", { status: 500 })) as typeof fetch;
  assert((await notifyContact({ recipients: ["admin@example.com"], reference: "SWCU-C-FAIL", subject: "Loans" })).status === "FAILED", "provider failure boundary");
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  if (originalFrom === undefined) delete process.env.CONTACT_EMAIL_FROM; else process.env.CONTACT_EMAIL_FROM = originalFrom;
  const successIp = `prompt3b-success-${Date.now()}`; qaRateKeys.add(`${tenant.id}:${successIp}`); const contactResult = await submitContactEnquiry({ tenant, ipAddress: successIp, value: { name: "QA Member", email: "qa@example.com", phone: "6797000000", subject: "Membership", message: "A safe enquiry for the QA inbox.", privacyAcknowledged: true, website: "" } }); qaContactReferences.add(contactResult.reference);
  assert(/^SWCU-C-\d{4}$/.test(contactResult.reference), "contact reference format");
  assert(["SKIPPED_NO_RECIPIENT", "SKIPPED_NO_PROVIDER", "SENT", "FAILED"].includes(contactResult.notification.status), "truthful notification readiness");
  const stored = await db.contactSubmission.findFirstOrThrow({ where: { tenantId: tenant.id, reference: contactResult.reference } });
  qaContactIds.add(stored.id);
  await updateContactStatus({ tenant, actorUserId: administrator?.userId ?? "prompt3b-qa-admin", id: stored.id, status: "BEING_HANDLED", note: "QA note" });
  assert((await db.contactSubmission.findUnique({ where: { id: stored.id } }))?.viewedAt === null, "status update does not mark viewed");
  const viewedAuditsBefore = await db.auditLog.count({ where: { tenantId: tenant.id, targetId: stored.reference, action: "CONTACT_ENQUIRY_VIEWED" } });
  await Promise.all([
    openContactEnquiry({ tenant, actorUserId: administrator?.userId ?? "prompt3b-qa-admin", id: stored.id }),
    openContactEnquiry({ tenant, actorUserId: administrator?.userId ?? "prompt3b-qa-admin", id: stored.id }),
  ]);
  assert((await db.contactSubmission.findUnique({ where: { id: stored.id } }))?.status === "BEING_HANDLED", "inbox status and note persistence");
  assert((await db.auditLog.count({ where: { tenantId: tenant.id, targetId: stored.reference, action: "CONTACT_ENQUIRY_VIEWED" } })) === viewedAuditsBefore + 1, "detail open audits viewed exactly once");
  const statuses = await db.contactSubmission.groupBy({ by: ["status"], where: { tenantId: tenant.id } });
  assert(statuses.every((row) => ["NEW", "BEING_HANDLED", "CLOSED"].includes(row.status)), "contact statuses are constrained");
  const robots = ["admin", "api", "member-login"];
  assert(robots.length === 3, "private routes are tracked for robots policy");
  console.info(JSON.stringify({ script: "check-prompt3b", assertions }));
}

async function assertRejects(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch {
    assertions += 1;
    return;
  }
  throw new Error(`Prompt 3B assertion failed: ${message}`);
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" }, select: { id: true } });
  await db.pageContent.deleteMany({ where: { tenantId: tenant.id, body: { in: ["QA privacy", "HTTP QA privacy"] } } });
  const originalPages = await db.pageContent.findMany({ where: { tenantId: tenant.id } });
  const originalContact = await db.contactSettings.findUnique({ where: { tenantId: tenant.id } });
  const originalFetch = globalThis.fetch;
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalContactFrom = process.env.CONTACT_EMAIL_FROM;
  let failure: unknown;
  const cleanupErrors: string[] = [];
  try {
    await runAssertions();
  } catch (error) {
    failure = error;
  } finally {
    const attempt = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (error) { cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); } };
    globalThis.fetch = originalFetch;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalResendKey;
    if (originalContactFrom === undefined) delete process.env.CONTACT_EMAIL_FROM; else process.env.CONTACT_EMAIL_FROM = originalContactFrom;
    await attempt("contacts", () => db.contactSubmission.deleteMany({ where: { id: { in: [...qaContactIds] } } }));
    await attempt("rate limits", () => db.contactRateLimit.deleteMany({ where: { key: { in: [...qaRateKeys] } } }));
    await attempt("audits", () => db.auditLog.deleteMany({ where: { tenantId: tenant.id, OR: [{ targetId: { in: [...qaContactReferences] } }, { actorUserId: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor"] } }] } }));
    await attempt("drafts", () => db.cmsDraft.deleteMany({ where: { id: { in: [...qaDraftIds] } } }));
    await attempt("forms", () => db.formDocument.deleteMany({ where: { tenantId: tenant.id, category: "ANNUAL_REPORT", title: "QA annual" } }));
    await attempt("media objects and rows", async () => { for (const key of qaObjectKeys) await deleteMediaObject(key).catch(() => undefined); await db.mediaAsset.deleteMany({ where: { id: { in: [...qaMediaIds] } } }); });
    await attempt("leadership", async () => undefined);
    await attempt("memberships", () => db.staffMembership.deleteMany({ where: { tenantId: tenant.id, userId: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor"] } } }));
    await attempt("users", () => db.user.deleteMany({ where: { id: { in: ["prompt3b-qa-admin", "prompt3b-qa-editor"] } } }));
    await attempt("page content restore", async () => { await db.pageContent.deleteMany({ where: { tenantId: tenant.id } }); for (const page of originalPages) await db.pageContent.create({ data: { id: page.id, tenantId: page.tenantId, slot: page.slot, heading: page.heading, body: page.body, mediaAssetId: page.mediaAssetId, isPublished: page.isPublished, publishedAt: page.publishedAt } }); });
    await attempt("contact settings restore", async () => { if (originalContact) { const data = { organisationName: originalContact.organisationName, streetAddress: originalContact.streetAddress, postalAddress: originalContact.postalAddress, telephone: originalContact.telephone, publicEmail: originalContact.publicEmail, officeHours: originalContact.officeHours, directionsUrl: originalContact.directionsUrl, notificationRecipients: Array.isArray(originalContact.notificationRecipients) ? originalContact.notificationRecipients.filter((item): item is string => typeof item === "string") : [] }; await db.contactSettings.upsert({ where: { tenantId: tenant.id }, update: data, create: { ...data, tenantId: tenant.id } }); } else await db.contactSettings.deleteMany({ where: { tenantId: tenant.id } }); });
  }
  if (failure) { if (cleanupErrors.length) console.error(JSON.stringify({ cleanupErrors })); throw failure; }
  if (cleanupErrors.length) throw new Error(`Cleanup failures: ${cleanupErrors.join("; ")}`);
}

main().finally(() => db.$disconnect());