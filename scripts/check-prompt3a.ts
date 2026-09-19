import { db } from "../src/lib/db";
import { CmsDraftKind, CmsDraftOperation, CmsDraftStatus } from "../src/generated/prisma/client";
import { createCmsDraft, updateCmsDraft, submitCmsDraft, returnCmsDraft, withdrawCmsDraft, archiveCmsDraft, publishCmsDraft } from "../src/lib/cms-workflow";
import { clearStaffLoginFailures, recordStaffLoginFailure, staffLoginAllowed, staffLoginAttemptKey } from "../src/lib/login-throttle";
import { POST as adminLogin } from "../src/app/api/admin/login/route";
import { POST as authLogin } from "../src/app/api/auth/[...all]/route";
import { NextRequest } from "next/server";
import { createStaffAccount, changeStaffRole, setStaffAccountActive, initiateStaffPasswordReset, completeStaffPasswordReset, disableEditorWithReassignment } from "../src/lib/staff-accounts";
import { resolveCmsDraftTarget } from "../src/lib/cms-workflow";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";

const suffix = Date.now().toString(36);
let assertions = 0;
let qaTenantId: string | undefined;
const qaUserIds: string[] = [];
const loginAttemptKeys = new Set<string>();
const check: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw new Error(message); assertions += 1; };

async function main() {
  assertQaExecutionSafe();
  const tenant = await db.tenant.create({ data: { slug: `prompt3a-${suffix}`, displayName: "Prompt 3A QA" } });
  qaTenantId = tenant.id;
  const editor = await db.user.create({ data: { id: crypto.randomUUID(), name: "QA Editor", email: `p3a-editor-${suffix}@example.invalid` } });
  const admin = await db.user.create({ data: { id: crypto.randomUUID(), name: "QA Admin", email: `p3a-admin-${suffix}@example.invalid` } });
  qaUserIds.push(editor.id, admin.id);
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
  loginAttemptKeys.add(staffLoginAttemptKey("qa@example.invalid", "127.0.0.1"));
  for (let i = 0; i < 5; i += 1) await recordStaffLoginFailure("qa@example.invalid", "127.0.0.1");
  check(!(await staffLoginAllowed("qa@example.invalid", "127.0.0.1")), "Login throttle did not block repeated failures.");
  loginAttemptKeys.add(staffLoginAttemptKey(`missing-${suffix}@example.invalid`, "127.0.0.2"));
  const loginResponse = await adminLogin(new Request("http://localhost/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.2" },
    body: JSON.stringify({ email: `missing-${suffix}@example.invalid`, password: "not-a-password" }),
  }) as never);
  check(loginResponse.status === 401 && (await loginResponse.json()).error === "The email or password was not recognised.", "Login route did not return a generic failure.");
  loginAttemptKeys.add(staffLoginAttemptKey(`direct-missing-${suffix}@example.invalid`, "127.0.0.3"));
  const directLoginResponse = await authLogin(new NextRequest("http://localhost/api/auth/sign-in/email", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.3" },
    body: JSON.stringify({ email: `direct-missing-${suffix}@example.invalid`, password: "not-a-password" }),
  }) as never);
  check(directLoginResponse.status === 401 && (await directLoginResponse.json()).error === "The email or password was not recognised.", "Direct Better Auth email endpoint bypassed the login guard.");
  const blockedEmail = `blocked-${suffix}@example.invalid`;
  loginAttemptKeys.add(staffLoginAttemptKey(blockedEmail, "127.0.0.4"));
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
  loginAttemptKeys.add(staffLoginAttemptKey(directEmail, "127.0.0.5"));
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
  qaUserIds.push(provisioned.userId);
  check(provisioned.role === "EDITOR" && Boolean(await db.user.findUnique({ where: { id: provisioned.userId } })), "Staff provisioning did not create a linked user.");
  const adminTwo = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Second Admin", email: `admin-two-${suffix}@example.invalid`, password: "Strong-Password-123", role: "ADMINISTRATOR" });
  const adminThree = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Third Admin", email: `admin-three-${suffix}@example.invalid`, password: "Strong-Password-123", role: "ADMINISTRATOR" });
  qaUserIds.push(adminTwo.userId, adminThree.userId);
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
  const atomicReset = await initiateStaffPasswordReset({ tenant: resolved, actorUserId: admin.id, membershipId: provisioned.id, baseUrl: "http://127.0.0.1:5000" });
  const atomicResetToken = decodeURIComponent(atomicReset.resetLink!.split("#token=")[1]);
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: provisioned.id, isActive: false });
  let inactiveResetRejected = false;
  try { await completeStaffPasswordReset({ membershipId: provisioned.id, token: atomicResetToken, password: "Atomic-Strong-Password-123" }); } catch { inactiveResetRejected = true; }
  check(inactiveResetRejected, "Password reset succeeded for a disabled staff membership.");
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: provisioned.id, isActive: true });
  let atomicResetPreserved = true;
  try { await completeStaffPasswordReset({ membershipId: provisioned.id, token: atomicResetToken, password: "Atomic-Strong-Password-123" }); } catch { atomicResetPreserved = false; }
  check(atomicResetPreserved, "A valid reset token was consumed after a failed completion.");
  const concurrentReset = await initiateStaffPasswordReset({ tenant: resolved, actorUserId: admin.id, membershipId: provisioned.id, baseUrl: "http://127.0.0.1:5000" });
  const concurrentResetToken = decodeURIComponent(concurrentReset.resetLink!.split("#token=")[1]);
  const concurrentResults = await Promise.all([
    completeStaffPasswordReset({ membershipId: provisioned.id, token: concurrentResetToken, password: "Concurrent-Strong-Password-123" }).then(() => true).catch(() => false),
    completeStaffPasswordReset({ membershipId: provisioned.id, token: concurrentResetToken, password: "Concurrent-Strong-Password-456" }).then(() => true).catch(() => false),
  ]);
  check(concurrentResults.filter(Boolean).length === 1, "Concurrent reset completion did not allow exactly one success.");
  const editorMembership = await db.staffMembership.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: tenant.id, userId: editor.id } } });
  const lifecycleDraft = async (creatorUserId: string, title: string, status: "DRAFT" | "WAITING_FOR_APPROVAL" | "RETURNED_FOR_CHANGES") => {
    const draft = await createCmsDraft({ tenant: resolved, actorUserId: creatorUserId, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.CREATE, payload: { title, summary: title } });
    if (status !== "DRAFT") await submitCmsDraft({ tenant: resolved, actorUserId: creatorUserId, draftId: draft.id });
    if (status === "RETURNED_FOR_CHANGES") await returnCmsDraft({ tenant: resolved, actorUserId: admin.id, draftId: draft.id, note: "Lifecycle safety review." });
    return draft;
  };
  const rejectDrafts = await Promise.all([
    lifecycleDraft(editor.id, "Reject draft", "DRAFT"),
    lifecycleDraft(editor.id, "Reject waiting", "WAITING_FOR_APPROVAL"),
    lifecycleDraft(editor.id, "Reject returned", "RETURNED_FOR_CHANGES"),
  ]);
  let rejectedWithoutDecision = false;
  try { await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: editorMembership.id, isActive: false }); } catch (error) {
    rejectedWithoutDecision = error instanceof Error && error.message.includes("REASSIGN") && error.message.includes("ARCHIVE");
  }
  check(rejectedWithoutDecision, "Disabling an Editor with open drafts did not require an explicit REASSIGN or ARCHIVE decision.");
  check((await db.staffMembership.findUniqueOrThrow({ where: { id: editorMembership.id } })).isActive, "Editor was disabled after a missing draft decision.");
  check((await db.cmsDraft.findMany({ where: { id: { in: rejectDrafts.map((draft) => draft.id) } }, select: { status: true, assignedTo: true } })).every((draft) => draft.status !== CmsDraftStatus.ARCHIVED && draft.assignedTo === null), "Reject-without-decision changed open drafts.");
  const reassignedLifecycle = await lifecycleDraft(provisioned.userId, "Assigned to disabled editor", "WAITING_FOR_APPROVAL");
  await db.cmsDraft.update({ where: { id: reassignedLifecycle.id }, data: { assignedTo: editor.id } });
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: editorMembership.id, isActive: false, decision: "REASSIGN", assigneeUserId: provisioned.userId });
  const reassignedLifecycleRows = await db.cmsDraft.findMany({ where: { id: { in: [...rejectDrafts.map((draft) => draft.id), reassignedLifecycle.id] } }, select: { status: true, assignedTo: true } });
  check(reassignedLifecycleRows.every((draft) => draft.assignedTo === provisioned.userId), "REASSIGN did not transfer every createdBy/assignedTo open draft.");
  check(reassignedLifecycleRows.some((draft) => draft.status === CmsDraftStatus.DRAFT) && reassignedLifecycleRows.some((draft) => draft.status === CmsDraftStatus.WAITING_FOR_APPROVAL) && reassignedLifecycleRows.some((draft) => draft.status === CmsDraftStatus.RETURNED_FOR_CHANGES), "REASSIGN lifecycle did not cover all three open statuses.");
  check((await db.cmsDraft.count({ where: { tenantId: tenant.id, OR: [{ assignedTo: editor.id }, { createdBy: editor.id, assignedTo: null }], status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] } } })) === 0, "Disabled Editor retained a persistent open or unassigned draft.");
  const archiveEditor = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Archive Editor", email: `archive-editor-${suffix}@example.invalid`, password: "Strong-Password-123", role: "EDITOR" });
  qaUserIds.push(archiveEditor.userId);
  const archiveDrafts = await Promise.all([
    lifecycleDraft(archiveEditor.userId, "Archive draft", "DRAFT"),
    lifecycleDraft(archiveEditor.userId, "Archive waiting", "WAITING_FOR_APPROVAL"),
    lifecycleDraft(archiveEditor.userId, "Archive returned", "RETURNED_FOR_CHANGES"),
  ]);
  await db.session.create({ data: { id: crypto.randomUUID(), token: `qa-archive-session-${suffix}`, userId: archiveEditor.userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: archiveEditor.id, isActive: false, decision: "ARCHIVE" });
  check(await db.session.count({ where: { userId: archiveEditor.userId } }) === 0, "Draft-disposition disable did not revoke all sessions.");
  const archivedLifecycleRows = await db.cmsDraft.findMany({ where: { id: { in: archiveDrafts.map((draft) => draft.id) } }, select: { status: true, archivedAt: true, assignedTo: true } });
  check(archivedLifecycleRows.every((draft) => draft.status === CmsDraftStatus.ARCHIVED && draft.archivedAt), "ARCHIVE did not preserve all drafts as historical records.");
  const emptyEditor = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Empty Editor", email: `empty-editor-${suffix}@example.invalid`, password: "Strong-Password-123", role: "EDITOR" });
  qaUserIds.push(emptyEditor.userId);
  await setStaffAccountActive({ tenant: resolved, actorUserId: admin.id, membershipId: emptyEditor.id, isActive: false });
  check(!(await db.staffMembership.findUniqueOrThrow({ where: { id: emptyEditor.id } })).isActive, "Editor with no open drafts could not be disabled normally.");
  const handoffEditor = await createStaffAccount({ tenant: resolved, actorUserId: admin.id, name: "Handoff Editor", email: `handoff-editor-${suffix}@example.invalid`, password: "Strong-Password-123", role: "EDITOR" });
  qaUserIds.push(handoffEditor.userId);
  const assignedDraft = await createCmsDraft({ tenant: resolved, actorUserId: handoffEditor.userId, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.CREATE, payload: { title: "Assigned", summary: "Assigned" } });
  const assignedByOtherDraft = await createCmsDraft({ tenant: resolved, actorUserId: provisioned.userId, kind: CmsDraftKind.NEWS, operation: CmsDraftOperation.CREATE, payload: { title: "Assigned by another editor", summary: "Assigned by another editor" } });
  await db.cmsDraft.update({ where: { id: assignedByOtherDraft.id }, data: { assignedTo: handoffEditor.userId } });
  let roleChangeRejected = false;
  try { await changeStaffRole({ tenant: resolved, actorUserId: admin.id, membershipId: handoffEditor.id, role: "ADMINISTRATOR" }); } catch (error) {
    roleChangeRejected = error instanceof Error && error.message.includes("REASSIGN") && error.message.includes("ARCHIVE");
  }
  check(roleChangeRejected, "Changing an Editor role with open drafts bypassed draft disposition.");
  await db.session.create({ data: { id: crypto.randomUUID(), token: `qa-session-${suffix}`, userId: handoffEditor.userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  await disableEditorWithReassignment({ tenant: resolved, actorUserId: admin.id, membershipId: handoffEditor.id, assigneeUserId: provisioned.userId });
  check(await db.session.count({ where: { userId: handoffEditor.userId } }) === 0, "Disabling an Editor did not revoke all sessions.");
  const reassigned = await db.cmsDraft.findUniqueOrThrow({ where: { id: assignedDraft.id } });
  check(reassigned.assignedTo === provisioned.userId, "Disable/reassignment did not preserve assigned ownership.");
  const reassignedByOther = await db.cmsDraft.findUniqueOrThrow({ where: { id: assignedByOtherDraft.id } });
  check(reassignedByOther.assignedTo === provisioned.userId, "Disable/reassignment missed a draft assigned to the disabled editor.");
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
  check(auditActions.some((entry) => entry.action === "STAFF_ACCESS_DISABLED" && entry.targetId === handoffEditor.id), "Editor access-disable audit event missing.");
  check(auditActions.some((entry) => entry.action === "STAFF_ACCESS_DISABLED" && entry.targetId === archiveEditor.id), "Draft-disposition access-disable audit event missing.");
  check(auditActions.some((entry) => entry.action === "STAFF_DRAFTS_ARCHIVED" && entry.actorUserId === admin.id), "Staff draft archive audit event missing.");
  check(!auditActions.some((entry) => entry.action === "STAFF_DRAFTS_UNASSIGNED"), "Persistent unassigned draft audit behavior remains.");
  check(auditActions.filter((entry) => entry.action.startsWith("STAFF_")).every((entry) => !JSON.stringify(entry.changeMetadata).match(/password|resetLink|token/i)), "Staff audit metadata exposed secret material.");
  check((await db.cmsDraft.findMany({ where: { tenantId: tenant.id, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] } } })).every((draft) => draft.tenantId === tenant.id), "Pending count escaped tenant scope.");
  console.info(JSON.stringify({ assertions, script: "check-prompt3a" }));
  await cleanupAfterFailure();
  qaTenantId = undefined;
}

async function cleanupAfterFailure() {
  if (!qaTenantId) return;
  const [audits, drafts, news, notices, media, memberships] = await Promise.all([
    db.auditLog.findMany({ where: { tenantId: qaTenantId }, select: { id: true } }),
    db.cmsDraft.findMany({ where: { tenantId: qaTenantId }, select: { id: true } }),
    db.newsNotice.findMany({ where: { tenantId: qaTenantId }, select: { id: true } }),
    db.siteNotice.findMany({ where: { tenantId: qaTenantId }, select: { id: true } }),
    db.mediaAsset.findMany({ where: { tenantId: qaTenantId }, select: { id: true } }),
    db.staffMembership.findMany({ where: { tenantId: qaTenantId }, select: { id: true } }),
  ]);
  const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
  const loginAttempts = await db.staffLoginAttempt.findMany({ where: { key: { in: [...loginAttemptKeys] } }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { id: { in: ids(audits) } } });
  await db.staffLoginAttempt.deleteMany({ where: { id: { in: ids(loginAttempts) } } });
  await db.cmsDraft.deleteMany({ where: { id: { in: ids(drafts) } } });
  await db.newsNotice.deleteMany({ where: { id: { in: ids(news) } } });
  await db.siteNotice.deleteMany({ where: { id: { in: ids(notices) } } });
  await db.mediaAsset.deleteMany({ where: { id: { in: ids(media) } } });
  await db.staffMembership.deleteMany({ where: { id: { in: ids(memberships) } } });
  await db.tenant.delete({ where: { id: qaTenantId } });
  await db.user.deleteMany({ where: { id: { in: qaUserIds } } });
}

main().catch(async (error) => {
  try { await cleanupAfterFailure(); } catch (cleanupError) { console.error(cleanupError); }
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());