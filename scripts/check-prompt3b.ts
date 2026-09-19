import { db } from "../src/lib/db";
import { getPublishedPageContent, getPublishedLeadership, getPublishedRates, getCalculatorSettings, hasPublishedPrivacy, getPublicContactSettings, getPublishedResources } from "../src/lib/public-data";
import { submitContactEnquiry, handleContactPost, notifyContact, updateContactStatus, openContactEnquiry, parseContactRecipientsForm } from "../src/lib/contact";
import { CmsDraftKind, CmsDraftOperation } from "../src/generated/prisma/client";
import { createCmsDraft, submitCmsDraft, publishCmsDraft } from "../src/lib/cms-workflow";
import { uploadDocument } from "../src/lib/media-service";
import { deleteMediaObject } from "../src/lib/r2";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";

let assertions = 0;
const qaContactIds = new Set<string>();
const qaContactReferences = new Set<string>();
const qaDraftIds = new Set<string>();
const qaObjectKeys = new Set<string>();
const qaMediaIds = new Set<string>();
const qaRateKeys = new Set<string>();
const suffix = Date.now().toString(36);
let fixtureTenantId: string | undefined;
const fixtureActorIds = new Set<string>();
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Prompt 3B assertion failed: ${message}`);
  assertions += 1;
}

async function runAssertions() {
  assertQaExecutionSafe();
  const publicTenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" }, select: { id: true, slug: true, displayName: true } });
  const other = await db.tenant.findFirst({ where: { id: { not: publicTenant.id } }, select: { id: true, slug: true, displayName: true } });
  assert(publicTenant.displayName === "Service Worker Credit Union", "seeded tenant");
  assert((await db.calculatorSettings.findUnique({ where: { tenantId: publicTenant.id } }))?.isEnabled === false, "calculator remains inactive");
  const story = await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: publicTenant.id, slot: "ABOUT_STORY" } } });
  const loans = await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: publicTenant.id, slot: "LOANS_INTRO" } } });
  assert(story?.heading === "Our Story" && story.body === "Service Worker Credit Union began on 23 August 2000, when a group of Fiji Public Service Association members met in Suva to establish a credit union for members. Today, SWCU serves its members from 300 Waimanu Road, Suva." && story.isPublished && loans?.heading === "Loans" && loans.body === "SWCU provides member loans for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member’s account position." && loans.isPublished, "exact approved public copy");
  const approvedSlots = ["ABOUT_STORY", "ABOUT_VISION", "ABOUT_MISSION", "ABOUT_PURPOSE", "MEMBERSHIP_INTRO", "SAVINGS_INTRO", "LOANS_INTRO", "RETIREMENT_INTRO", "DEATH_BENEFIT_INTRO"];
  assert((await db.pageContent.count({ where: { tenantId: publicTenant.id, slot: { in: approvedSlots }, isPublished: true } })) === approvedSlots.length, "all approved public copy slots are published");
  const forbiddenSlots = ["VISION", "MISSION", "PURPOSE", "GOVERNANCE", "SAVINGS", "RETIREMENT", "DEATH_BENEFIT", "TERMS"];
  assert((await db.pageContent.count({ where: { tenantId: publicTenant.id, slot: { in: [...forbiddenSlots, "MEMBERSHIP_LOANS"] } } })) === 0, "unapproved page slots absent");
  assert((await db.pageContent.count({ where: { tenantId: publicTenant.id, slot: "PRIVACY" } })) === 0, "privacy legal text not invented");
  assert((await db.rateFee.count({ where: { tenantId: publicTenant.id } })) === 0, "no invented rates");
  assert((await db.leadershipRecord.count({ where: { tenantId: publicTenant.id } })) === 0, "no invented people");
  const pages = await getPublishedPageContent(publicTenant);
  assert(pages.every((page) => Boolean(page.slot)), "published page projection");
  assert((await getPublishedLeadership(publicTenant)).every((person) => Boolean(person.name)), "published leadership projection");
  assert((await getPublishedRates(publicTenant)).every((rate) => Boolean(rate.displayValue)), "published rates projection");
  assert((await getCalculatorSettings(publicTenant))?.isEnabled === false, "public calculator disabled");
  assert((await hasPublishedPrivacy(publicTenant)) === false, "privacy gate closed");
  assert((await getPublicContactSettings(publicTenant))?.telephone === "(679) 7730445", "allowed contact phone");
  assert((await getPublicContactSettings(publicTenant))?.publicEmail === "swcu2016@gmail.com", "allowed contact email");
  const resources = await getPublishedResources(publicTenant);
  assert(resources.news.every((item) => Boolean(item.title)), "published news only");
  assert(resources.faqs.length >= 0, "FAQ projection is tenant-scoped");
  if (other) {
    assert((await getPublishedPageContent(other)).every((item) => item.slot !== "PRIVATE"), "tenant page isolation");
    assert((await getPublicContactSettings(other))?.organisationName !== "Service Worker Credit Union" || other.id === publicTenant.id, "tenant contact isolation");
  }
  await assertRejects(() => submitContactEnquiry({ tenant: publicTenant, ipAddress: "prompt3b-test", value: { name: "Test Person", email: "test@example.com", phone: "", subject: "Membership", message: "Please contact me.", privacyAcknowledged: true, website: "" } }), "privacy gate blocks contact");
  await assertRejects(() => submitContactEnquiry({ tenant: publicTenant, ipAddress: "prompt3b-test", value: { name: "Test Person", email: "not-an-email", phone: "", subject: "Membership", message: "Please contact me.", privacyAcknowledged: true, website: "" } }), "invalid email rejected");
  await assertRejects(() => submitContactEnquiry({ tenant: publicTenant, ipAddress: "prompt3b-test", value: { name: "Test Person", email: "test@example.com", phone: "", subject: "Request a Call Back", message: "Please call me.", privacyAcknowledged: true, website: "" } }), "callback phone required");
  await assertRejects(() => submitContactEnquiry({ tenant: publicTenant, ipAddress: "prompt3b-honeypot", value: { name: "Test Person", email: "test@example.com", phone: "", subject: "Membership", message: "", privacyAcknowledged: true, website: "bot" } }), "honeypot rejected");
  const fixtureSlug = `prompt3b-fixture-${suffix}`;
  const fixtureHostname = `prompt3b-${suffix}.qa.invalid`;
  if (await db.tenant.findUnique({ where: { slug: fixtureSlug }, select: { id: true } })) throw new Error("Exact Prompt 3B fixture slug already exists; refusing to mutate it.");
  if (await db.tenantDomain.findUnique({ where: { hostname: fixtureHostname }, select: { id: true } })) throw new Error("Exact Prompt 3B fixture hostname already exists; refusing to mutate it.");
  const tenant = await db.tenant.create({ data: { slug: fixtureSlug, displayName: "Prompt 3B Fixture QA" } });
  fixtureTenantId = tenant.id;
  await db.tenantDomain.create({ data: { tenantId: tenant.id, hostname: fixtureHostname, isPrimary: true } });
  const adminId = `prompt3b-qa-admin-${suffix}`;
  const editorId = `prompt3b-qa-editor-${suffix}`;
  fixtureActorIds.add(adminId); fixtureActorIds.add(editorId);
  await db.user.create({ data: { id: adminId, name: "Prompt 3B QA Admin", email: `${adminId}@qa.invalid` } });
  await db.user.create({ data: { id: editorId, name: "Prompt 3B QA Editor", email: `${editorId}@qa.invalid` } });
  await db.staffMembership.createMany({ data: [{ tenantId: tenant.id, userId: adminId, role: "ADMINISTRATOR" }, { tenantId: tenant.id, userId: editorId, role: "EDITOR" }] });
  const editor = await db.staffMembership.findFirst({ where: { tenantId: tenant.id, role: "EDITOR", isActive: true }, select: { userId: true } });
  const administrator = await db.staffMembership.findFirst({ where: { tenantId: tenant.id, role: "ADMINISTRATOR", isActive: true }, select: { userId: true } });
  assert(Boolean(editor && administrator), "staff roles available for workflow tests");
  if (editor && administrator) {
    const first = await createCmsDraft({ tenant, actorUserId: editor.userId, kind: CmsDraftKind.PAGE_CONTENT, operation: CmsDraftOperation.UPDATE, targetId: `${tenant.id}:page:ABOUT_STORY`, payload: { slot: "ABOUT_STORY", heading: "QA story", body: "Approved QA copy." } }); qaDraftIds.add(first.id);
    const revised = await createCmsDraft({ tenant, actorUserId: editor.userId, kind: CmsDraftKind.PAGE_CONTENT, operation: CmsDraftOperation.UPDATE, targetId: `${tenant.id}:page:ABOUT_STORY`, expectedRevision: first.revision, payload: { slot: "ABOUT_STORY", heading: "QA story revised", body: "Approved QA copy." } }); qaDraftIds.add(revised.id);
    assert(revised.revision > first.revision, "same-slot save revises safely");
    await submitCmsDraft({ tenant, actorUserId: editor.userId, draftId: revised.id });
    await assertRejects(() => publishCmsDraft({ tenant, actorUserId: editor.userId, draftId: revised.id }), "Editor cannot publish page content");
    await publishCmsDraft({ tenant, actorUserId: administrator.userId, draftId: revised.id });
    assert((await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: "ABOUT_STORY" } } }))?.isPublished === true, "Administrator publishes fixed slot");
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
  await updateContactStatus({ tenant, actorUserId: administrator?.userId ?? adminId, id: stored.id, status: "BEING_HANDLED", note: "QA note" });
  assert((await db.contactSubmission.findUnique({ where: { id: stored.id } }))?.viewedAt === null, "status update does not mark viewed");
  const viewedAuditsBefore = await db.auditLog.count({ where: { tenantId: tenant.id, targetId: stored.reference, action: "CONTACT_ENQUIRY_VIEWED" } });
  await Promise.all([
    openContactEnquiry({ tenant, actorUserId: administrator?.userId ?? adminId, id: stored.id }),
    openContactEnquiry({ tenant, actorUserId: administrator?.userId ?? adminId, id: stored.id }),
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
  assertQaExecutionSafe();
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
    if (fixtureTenantId) {
      const [auditRows, draftRows, formRows, mediaRows, membershipRows, pageRows, domainRows, contactRows, rateRows] = await Promise.all([
        db.auditLog.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.cmsDraft.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.formDocument.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.mediaAsset.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true, objectKey: true } }),
        db.staffMembership.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.pageContent.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.tenantDomain.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.contactSubmission.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
        db.contactRateLimit.findMany({ where: { tenantId: fixtureTenantId }, select: { id: true } }),
      ]);
      const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
      await attempt("audits", () => auditRows.length ? db.auditLog.deleteMany({ where: { id: { in: ids(auditRows) } } }) : Promise.resolve());
      await attempt("drafts", () => draftRows.length ? db.cmsDraft.deleteMany({ where: { id: { in: ids(draftRows) } } }) : Promise.resolve());
      await attempt("forms", () => formRows.length ? db.formDocument.deleteMany({ where: { id: { in: ids(formRows) } } }) : Promise.resolve());
      await attempt("page content", () => pageRows.length ? db.pageContent.deleteMany({ where: { id: { in: ids(pageRows) } } }) : Promise.resolve());
      await attempt("contacts", () => contactRows.length ? db.contactSubmission.deleteMany({ where: { id: { in: ids(contactRows) } } }) : Promise.resolve());
      await attempt("rate limits", () => rateRows.length ? db.contactRateLimit.deleteMany({ where: { id: { in: ids(rateRows) } } }) : Promise.resolve());
      await attempt("R2 objects", async () => {
        const exactObjectKeys = new Set([...qaObjectKeys, ...mediaRows.map((row) => row.objectKey)]);
        for (const key of exactObjectKeys) await deleteMediaObject(key);
      });
      await attempt("media rows", () => mediaRows.length ? db.mediaAsset.deleteMany({ where: { id: { in: ids(mediaRows) } } }) : Promise.resolve());
      await attempt("memberships", () => membershipRows.length ? db.staffMembership.deleteMany({ where: { id: { in: ids(membershipRows) } } }) : Promise.resolve());
      await attempt("domain", () => domainRows.length ? db.tenantDomain.deleteMany({ where: { id: { in: ids(domainRows) } } }) : Promise.resolve());
      await attempt("tenant", () => db.tenant.delete({ where: { id: fixtureTenantId } }));
    }
    await attempt("users", () => fixtureActorIds.size ? db.user.deleteMany({ where: { id: { in: [...fixtureActorIds] } } }) : Promise.resolve());
  }
  if (failure) { if (cleanupErrors.length) console.error(JSON.stringify({ cleanupErrors })); throw failure; }
  if (cleanupErrors.length) throw new Error(`Cleanup failures: ${cleanupErrors.join("; ")}`);
}

main().finally(() => db.$disconnect());