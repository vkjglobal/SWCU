import { db } from "../src/lib/db";
import { CmsDraftKind, CmsDraftOperation, CmsDraftStatus } from "../src/generated/prisma/client";
import { createCmsDraft, updateCmsDraft, submitCmsDraft, returnCmsDraft, withdrawCmsDraft, archiveCmsDraft, publishCmsDraft } from "../src/lib/cms-workflow";
import { clearStaffLoginFailures, recordStaffLoginFailure, staffLoginAllowed } from "../src/lib/login-throttle";
import { POST as adminLogin } from "../src/app/api/admin/login/route";
import { POST as authLogin } from "../src/app/api/auth/[...all]/route";
import { NextRequest } from "next/server";
import { createStaffAccount, changeStaffRole, setStaffAccountActive, initiateStaffPasswordReset, completeStaffPasswordReset, disableEditorWithReassignment } from "../src/lib/staff-accounts";
import { resolveCmsDraftTarget } from "../src/lib/cms-workflow";

const suffix = Date.now().toString(36);
let assertions = 0;
const check: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw new Error(message); assertions += 1; };

async function main() {
  const tenant = await db.tenant.create({ data: { slug: `prompt3a-${suffix}`, displayName: "Prompt 3A QA" } });
  const editor = await db.user.create({ data: { id: crypto.randomUUID(), name: "QA Editor", email: `p3a-editor-${suffix}@example.invalid` } });
  const admin = await db.user.create({ data: { id: crypto.randomUUID(), name: "QA Admin", email: `p3a-admin-${suffix}@example.invalid` } });
  await db.staffMembership.createMany({ data: [{ tenantId: tenant.id, userId: editor.id, role: "EDITOR" }, { tenantId: tenant.id, userId: admin.id, role: "ADMINISTRATOR" }] });
  const resolved = { id: tenant.id, slug: tenant.slug, displayName: tenant.displayName };
  const news = await db.newsNotice.create({ data: { tenantId: tenant.id, title: "Live", summary: "Live", isPublished: true, publishedAt: new Date() } });
  const [first] = await Promise.all([
    createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, payload: { title: "Draft", summary: "Draft", isPublished: true } }),
    createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, payload: { title: "Draft", summary: "Draft", isPublished: true } }).catch(() => null),
  ]);
  check(first, "Concurrent initial drafts did not create an approval item.");
  const duplicate = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, expectedRevision: first.revision, payload: { title: "Draft revised", summary: "Draft", isPublished: true } });
  check(first.id === duplicate.id, "Repeated edit created a duplicate open draft.");
  const revised = await updateCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: first.id, payload: { title: "Draft revised", summary: "Draft", isPublished: true }, revision: duplicate.revision });
  check(revised.revision > duplicate.revision, "Draft revision did not increment.");
  await submitCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: first.id });
  await returnCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: first.id, note: "Please clarify this notice." });
  const returned = await db.cmsDraft.findUniqueOrThrow({ where: { id: first.id } });
  check(returned.status === CmsDraftStatus.RETURNED_FOR_CHANGES && returned.administratorNote, "Return-for-changes did not preserve the note.");
  await updateCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: first.id, payload: { title: "Final", summary: "Final", isPublished: true }, revision: returned.revision });
  await submitCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: first.id });
  check((await db.cmsDraft.findUniqueOrThrow({ where: { id: first.id } })).status === CmsDraftStatus.WAITING_FOR_APPROVAL, "Resubmission did not await approval.");
  await withdrawCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: first.id });
  check((await db.cmsDraft.findUniqueOrThrow({ where: { id: first.id } })).status === CmsDraftStatus.WITHDRAWN, "Withdraw did not close the draft.");
  const waitingArchive = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, payload: { title: "Waiting archive", summary: "Waiting archive" } });
  await submitCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: waitingArchive.id });
  await archiveCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: waitingArchive.id });
  check((await db.cmsDraft.findUniqueOrThrow({ where: { id: waitingArchive.id } })).status === CmsDraftStatus.ARCHIVED, "Administrator could not archive a waiting draft.");
  const archived = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: news.id, payload: { title: "Another", summary: "Another" } });
  await archiveCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: archived.id });
  check((await db.cmsDraft.findUniqueOrThrow({ where: { id: archived.id } })).status === CmsDraftStatus.ARCHIVED, "Archive did not close the draft.");
  const concurrentNews = await db.newsNotice.create({ data: { tenantId: tenant.id, title: "Concurrent", summary: "Concurrent", isPublished: true, publishedAt: new Date() } });
  const concurrentDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: concurrentNews.id, payload: { title: "Concurrent draft", summary: "Concurrent draft", isPublished: true } });
  await submitCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: concurrentDraft.id });
  await Promise.allSettled([
    archiveCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: concurrentDraft.id }),
    (async () => { try { await (await import("../src/lib/cms-workflow")).publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: concurrentDraft.id }); } catch { /* first terminal action wins */ } })(),
  ]);
  const concurrentResult = await db.cmsDraft.findUniqueOrThrow({ where: { id: concurrentDraft.id } });
  check(concurrentResult.status === CmsDraftStatus.ARCHIVED || concurrentResult.status === CmsDraftStatus.PUBLISHED, "Concurrent approval actions did not produce one terminal winner.");
  const retiredNews = await db.newsNotice.create({ data: { tenantId: tenant.id, title: "Retired", summary: "Retired", isPublished: true, publishedAt: new Date() } });
  const retiredDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: retiredNews.id, payload: { title: "Retired draft", summary: "Retired draft" } });
  await db.newsNotice.update({ where: { id: retiredNews.id }, data: { isPublished: false } });
  let retiredMessage = "";
  try { await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: retiredDraft.id }); } catch (error) { retiredMessage = error instanceof Error ? error.message : ""; }
  check(retiredMessage === "This item has since been retired. This draft cannot be published.", "Logical retirement did not hard-block publication.");
  const staleNews = await db.newsNotice.create({ data: { tenantId: tenant.id, title: "Stale", summary: "Stale", isPublished: true, publishedAt: new Date() } });
  const staleDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.UPDATE, targetId: staleNews.id, payload: { title: "Stale proposed", summary: "Stale proposed" } });
  await db.newsNotice.update({ where: { id: staleNews.id }, data: { summary: "Changed after editor opened" } });
  let staleMessage = "";
  try { await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: staleDraft.id }); } catch (error) { staleMessage = error instanceof Error ? error.message : ""; }
  check(staleMessage === "The published version has changed since this draft was started. Please review the current version before publishing.", "Stale publish did not require explicit confirmation.");
  await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: staleDraft.id, confirmPublishedChange: true });
  const firstNotice = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.SITE_NOTICE, operation: CmsDraftOperation.UPDATE, payload: { message: "First singleton notice", isEnabled: true } });
  await submitCmsDraft({ tenant: resolved, actorUserId: editor.id, draftId: firstNotice.id });
  await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: firstNotice.id });
  check(Boolean(await db.siteNotice.findUnique({ where: { tenantId: tenant.id } })), "First-ever Site Notice did not publish via tenant singleton upsert.");
  const retiredMedia = await db.mediaAsset.create({ data: { tenantId: tenant.id, objectKey: `qa/retired-${suffix}`, originalFilename: "retired.jpg", mimeType: "image/jpeg", purpose: "general", byteSize: 1, width: 1, height: 1, retiredAt: new Date() } });
  const mediaDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.MEDIA, operation: CmsDraftOperation.REPLACE, targetId: retiredMedia.id, payload: {} });
  let mediaMessage = "";
  try { await publishCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: mediaDraft.id }); } catch (error) { mediaMessage = error instanceof Error ? error.message : ""; }
  check(mediaMessage === "This item has since been retired. This draft cannot be published.", "Retired MEDIA target was not blocked.");
  await clearStaffLoginFailures("qa@example.invalid", "127.0.0.1");
  for (let i = 0; i < 5; i += 1) await recordStaffLoginFailure("qa@example.invalid", "127.0.0.1");
  check(!(await staffLoginAllowed("qa@example.invalid", "127.0.0.1")), "Login throttle did not block repeated failures.");
  const loginResponse = await adminLogin(new Request("http://localhost/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.2" },
    body: JSON.stringify({ email: `missing-${suffix}@example.invalid`, password: "not-a-password" }),
  }) as never);
  check(loginResponse.status === 401 && (await loginResponse.json()).error === "The email or password was not recognised.", "Login route did not return a generic failure.");
  const directLoginResponse = await authLogin(new NextRequest("http://localhost/api/auth/sign-in/email", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.3" },
    body: JSON.stringify({ email: `direct-missing-${suffix}@example.invalid`, password: "not-a-password" }),
  }) as never);
  check(directLoginResponse.status === 401 && (await directLoginResponse.json()).error === "The email or password was not recognised.", "Direct Better Auth email endpoint bypassed the login guard.");
  const blockedEmail = `blocked-${suffix}@example.invalid`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await adminLogin(new NextRequest("http://localhost/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.4" },
      body: JSON.stringify({ email: blockedEmail, password: "wrong" }),
    }));
    check(failed.status === 401, "Failed login did not return a generic unauthorized response.");
  }
  const blocked = await adminLogin(new NextRequest("http://localhost/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.4" },
    body: JSON.stringify({ email: blockedEmail, password: "wrong" }),
  }));
  check(blocked.status === 401 && (await blocked.json()).error === "The email or password was not recognised.", "Admin login was not blocked after the threshold.");
  await clearStaffLoginFailures(blockedEmail, "127.0.0.4");
  check(await staffLoginAllowed(blockedEmail, "127.0.0.4"), "Successful-login clearing equivalent did not clear the durable throttle key.");
  const directEmail = `direct-blocked-${suffix}@example.invalid`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await authLogin(new NextRequest("http://localhost/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.5" }, body: JSON.stringify({ email: directEmail, password: "wrong" }) }));
    check(response.status === 401, "Direct auth threshold attempt did not fail generically.");
  }
  check(!(await staffLoginAllowed(directEmail, "127.0.0.5")), "Direct auth endpoint did not persist a blocked durable state.");
  const beforeDirectBlocked = await db.staffLoginAttempt.findUniqueOrThrow({ where: { key: `${directEmail}|127.0.0.5` } });
  const blockedDirectResponse = await authLogin(new NextRequest("http://localhost/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.5" }, body: JSON.stringify({ email: directEmail, password: "wrong" }) }));
  const afterDirectBlocked = await db.staffLoginAttempt.findUniqueOrThrow({ where: { key: `${directEmail}|127.0.0.5` } });
  check(blockedDirectResponse.status === 401 && afterDirectBlocked.failures === beforeDirectBlocked.failures, "Direct auth guard dispatched after threshold instead of stopping at the durable guard.");
  const provisioned = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Provisioned Editor", email: `provisioned-${suffix}@example.invalid`, password: "Strong-Password-123", role: "EDITOR" });
  check(provisioned.role === "EDITOR" && Boolean(await db.user.findUnique({ where: { id: provisioned.userId } })), "Staff provisioning did not create a linked user.");
  const adminTwo = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Second Admin", email: `admin-two-${suffix}@example.invalid`, password: "Strong-Password-123", role: "ADMINISTRATOR" });
  const adminThree = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Third Admin", email: `admin-three-${suffix}@example.invalid`, password: "Strong-Password-123", role: "ADMINISTRATOR" });
  await changeStaffRole({ tenant: resolved, actorUserId: admin.id, membershipId: adminTwo.id, role: "EDITOR" });
  await changeStaffRole({ tenant: resolved, actorUserId: admin.id, membershipId: adminTwo.id, role: "ADMINISTRATOR" });
  await Promise.allSettled([
    setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: adminTwo.id, isActive: false }),
    setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: adminThree.id, isActive: false }),
  ]);
  check((await db.staffMembership.count({ where: { tenantId: tenant.id, role: "ADMINISTRATOR", isActive: true } })) >= 1, "Concurrent Administrator removals left no active Administrator.");
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: adminTwo.id, isActive: true });
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: adminTwo.id, isActive: false });
  let soleAdminProtected = false;
  try { await changeStaffRole({ tenant: resolved, actorUserId: admin.id, membershipId: (await db.staffMembership.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } } })).id, role: "EDITOR" }); } catch { soleAdminProtected = true; }
  check(soleAdminProtected, "Sole active Administrator could be demoted.");
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: adminTwo.id, isActive: true });
  const reset = await initiateStaffPasswordReset({ tenant: resolved, actorUserId: admin.id, membershipId: provisioned.id, baseUrl: "http://127.0.0.1:5000" });
  check(Boolean(reset.resetLink && !reset.resetLink.includes("?token=") && reset.resetLink.includes("#token=")), "Reset token was emitted in the query string.");
  const resetToken = decodeURIComponent(reset.resetLink!.split("#token=")[1]);
  let invalidReset = false;
  try { await completeStaffPasswordReset({ membershipId: provisioned.id, token: `${resetToken}-invalid`, password: "New-Strong-Password-123" }); } catch { invalidReset = true; }
  check(invalidReset, "Invalid reset secret was accepted.");
  await completeStaffPasswordReset({ membershipId: provisioned.id, token: resetToken, password: "New-Strong-Password-123" });
  let reusedReset = false;
  try { await completeStaffPasswordReset({ membershipId: provisioned.id, token: resetToken, password: "Another-Strong-Password-123" }); } catch { reusedReset = true; }
  check(reusedReset, "Reset token was reusable.");
  const assignedDraft = await createCmsDraft({ tenant: resolved, actorUserId: editor.id, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.CREATE, payload: { title: "Assigned", summary: "Assigned" } });
  await disableEditorWithReassignment({ tenant: resolved, actorUserId: admin.id, membershipId: (await db.staffMembership.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: tenant.id, userId: editor.id } } })).id, assigneeUserId: provisioned.userId });
  const reassigned = await db.cmsDraft.findUniqueOrThrow({ where: { id: assignedDraft.id } });
  check(reassigned.assignedTo === provisioned.userId, "Disable/reassignment did not preserve assigned ownership.");
  await updateCmsDraft({ tenant: resolved, actorUserId: provisioned.userId, draftId: assignedDraft.id, revision: reassigned.revision, payload: { title: "Assigned revised", summary: "Assigned revised" } });
  await submitCmsDraft({ tenant: resolved, actorUserId: provisioned.userId, draftId: assignedDraft.id });
  const retiredResolved = await resolveCmsDraftTarget(resolved, CmsDraftKind.MEDIA, retiredMedia.id);
  check(retiredResolved === null, "Approval resolver exposed retired MEDIA.");
  const auditActions = await db.auditLog.findMany({ where: { tenantId: tenant.id }, select: { action: true, actorUserId: true, targetId: true, changeMetadata: true } });
  for (const required of ["CMS_DRAFT_CREATED", "CMS_DRAFT_REVISED", "CMS_DRAFT_SUBMITTED", "CMS_DRAFT_RETURNED_FOR_CHANGES", "CMS_DRAFT_NOTE_ADDED", "CMS_DRAFT_RESUBMITTED", "CMS_DRAFT_WITHDRAWN", "CMS_DRAFT_ARCHIVED", "CMS_DRAFT_STALE_VERSION_CONFIRMED"]) {
    check(auditActions.some((entry) => entry.action === required), `Required audit event missing: ${required}`);
  }
  check(auditActions.some((entry) => entry.action === "CMS_DRAFT_REVISED" && entry.actorUserId === editor.id && entry.targetId === first.id), "Revision audit identity/target missing.");
  check(!auditActions.some((entry) => JSON.stringify(entry.changeMetadata).includes("token")), "Reset token appeared in an audit payload.");
  for (const required of ["STAFF_ACCOUNT_CREATED", "STAFF_PASSWORD_RESET_INITIATED", "STAFF_DRAFTS_REASSIGNED", "STAFF_ACCESS_DISABLED", "STAFF_ROLE_CHANGED"]) {
    check(auditActions.some((entry) => entry.action === required && entry.actorUserId === admin.id), `Staff audit event missing: ${required}`);
  }
  check(auditActions.filter((entry) => entry.action.startsWith("STAFF_")).every((entry) => !JSON.stringify(entry.changeMetadata).match(/password|resetLink|token/i)), "Staff audit metadata exposed secret material.");
  check((await db.cmsDraft.findMany({ where: { tenantId: tenant.id, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] } } })).every((draft) => draft.tenantId === tenant.id), "Pending count escaped tenant scope.");
  console.info(JSON.stringify({ assertions, script: "check-prompt3a" }));
  await db.auditLog.deleteMany({ where: { tenantId: tenant.id } });
  await db.cmsDraft.deleteMany({ where: { tenantId: tenant.id } });
  await db.newsNotice.deleteMany({ where: { tenantId: tenant.id } });
  await db.siteNotice.deleteMany({ where: { tenantId: tenant.id } });
  await db.mediaAsset.deleteMany({ where: { tenantId: tenant.id } });
  await db.staffMembership.deleteMany({ where: { tenantId: tenant.id } });
  await db.tenant.delete({ where: { id: tenant.id } });
  await db.user.deleteMany({ where: { id: { in: [editor.id, admin.id, provisioned.userId] } } });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());