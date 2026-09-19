import "server-only";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StaffRole, CmsDraftStatus } from "@/generated/prisma/client";
import type { ResolvedTenant } from "@/lib/tenant";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

async function assertAdministrator(tenantId: string, actorUserId: string) {
  const membership = await db.staffMembership.findUnique({ where: { tenantId_userId: { tenantId, userId: actorUserId } } });
  if (!membership?.isActive || membership.role !== StaffRole.ADMINISTRATOR) throw new Error("Only active Administrators may manage staff accounts.");
}

async function audit(tenantId: string, actorUserId: string, action: string, targetId: string, changeMetadata?: object) {
  await db.auditLog.create({ data: { tenantId, actorUserId, action, targetType: "StaffMembership", targetId, changeMetadata } });
}

export async function createStaffAccount(input: {
  tenant: ResolvedTenant; actorUserId: string; name: string; email: string; password: string; role: StaffRole;
}) {
  await assertAdministrator(input.tenant.id, input.actorUserId);
  const context = await auth.$context;
  const email = input.email.trim().toLowerCase();
  const user = await context.internalAdapter.createUser(
    { name: input.name.trim(), email, emailVerified: false },
    { method: "email" },
  );
  const password = await context.password.hash(input.password);
  await context.internalAdapter.createAccount({ userId: user.id, providerId: "credential", accountId: user.id, password });
  const membership = await db.staffMembership.create({ data: { tenantId: input.tenant.id, userId: user.id, role: input.role } });
  await audit(input.tenant.id, input.actorUserId, "STAFF_ACCOUNT_CREATED", membership.id, { role: input.role, userId: user.id });
  return membership;
}

export async function changeStaffRole(input: { tenant: ResolvedTenant; actorUserId: string; membershipId: string; role: StaffRole }) {
  await assertAdministrator(input.tenant.id, input.actorUserId);
  const { membership, updated } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const membership = await tx.staffMembership.findFirst({ where: { id: input.membershipId, tenantId: input.tenant.id } });
    if (!membership) throw new Error("Staff membership not found.");
    if (membership.role === StaffRole.ADMINISTRATOR && input.role !== StaffRole.ADMINISTRATOR && membership.isActive) {
      const count = await tx.staffMembership.count({ where: { tenantId: input.tenant.id, role: StaffRole.ADMINISTRATOR, isActive: true } });
      if (count <= 1) throw new Error("There must always be at least one active Administrator.");
    }
    const updated = await tx.staffMembership.update({ where: { id: membership.id }, data: { role: input.role } });
    return { membership, updated };
  });
  await audit(input.tenant.id, input.actorUserId, "STAFF_ROLE_CHANGED", membership.id, { from: membership.role, to: input.role });
  return updated;
}

export async function setStaffAccountActive(input: { tenant: ResolvedTenant; actorUserId: string; membershipId: string; isActive: boolean }) {
  await assertAdministrator(input.tenant.id, input.actorUserId);
  const { membership, updated } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const membership = await tx.staffMembership.findFirst({ where: { id: input.membershipId, tenantId: input.tenant.id } });
    if (!membership) throw new Error("Staff membership not found.");
    if (!input.isActive && membership.role === StaffRole.ADMINISTRATOR) {
      const count = await tx.staffMembership.count({ where: { tenantId: input.tenant.id, role: StaffRole.ADMINISTRATOR, isActive: true } });
      if (count <= 1) throw new Error("There must always be at least one active Administrator.");
    }
    const updated = await tx.staffMembership.update({ where: { id: membership.id }, data: { isActive: input.isActive } });
    if (!input.isActive) {
      const drafts = await tx.cmsDraft.updateMany({
        where: {
          tenantId: input.tenant.id,
          OR: [{ createdBy: membership.userId }, { assignedTo: membership.userId }],
          status: { in: ["DRAFT", "WAITING_FOR_APPROVAL", "RETURNED_FOR_CHANGES"] },
        },
        data: { assignedTo: null },
      });
      if (drafts.count > 0) {
        await tx.auditLog.create({
          data: {
            tenantId: input.tenant.id,
            actorUserId: input.actorUserId,
            action: "STAFF_DRAFTS_UNASSIGNED",
            targetType: "StaffMembership",
            targetId: membership.id,
            changeMetadata: { count: drafts.count },
          },
        });
      }
    }
    return { membership, updated };
  });
  if (!input.isActive) {
    await db.session.deleteMany({ where: { userId: membership.userId } });
  }
  await audit(input.tenant.id, input.actorUserId, input.isActive ? "STAFF_ACCESS_RESTORED" : "STAFF_ACCESS_DISABLED", membership.id);
  return updated;
}

export async function disableEditorWithReassignment(input: {
  tenant: ResolvedTenant; actorUserId: string; membershipId: string; assigneeUserId: string;
}) {
  await assertAdministrator(input.tenant.id, input.actorUserId);
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const member = await tx.staffMembership.findFirst({ where: { id: input.membershipId, tenantId: input.tenant.id, role: StaffRole.EDITOR, isActive: true } });
    const replacement = await tx.staffMembership.findUnique({ where: { tenantId_userId: { tenantId: input.tenant.id, userId: input.assigneeUserId } } });
    if (!member || !replacement?.isActive || replacement.role !== StaffRole.EDITOR) throw new Error("Choose an active replacement Editor.");
    const drafts = await tx.cmsDraft.updateMany({
      where: {
        tenantId: input.tenant.id,
        OR: [{ createdBy: member.userId }, { assignedTo: member.userId }],
        status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] },
      },
      data: { assignedTo: replacement.userId, revision: { increment: 1 } },
    });
    const updated = await tx.staffMembership.update({ where: { id: member.id }, data: { isActive: false } });
    await tx.session.deleteMany({ where: { userId: member.userId } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "STAFF_DRAFTS_REASSIGNED", targetType: "StaffMembership", targetId: member.id, changeMetadata: { replacementUserId: replacement.userId, count: drafts.count } } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "STAFF_ACCESS_DISABLED", targetType: "StaffMembership", targetId: member.id } });
    return updated;
  });
  return result;
}

export async function initiateStaffPasswordReset(input: {
  tenant: ResolvedTenant; actorUserId: string; membershipId: string; baseUrl: string;
}) {
  if (!/^https?:\/\/[^/]+$/i.test(input.baseUrl)) throw new Error("A validated tenant origin is required.");
  await assertAdministrator(input.tenant.id, input.actorUserId);
  const membership = await db.staffMembership.findFirst({ where: { id: input.membershipId, tenantId: input.tenant.id }, select: { id: true, userId: true } });
  if (!membership) throw new Error("Staff membership not found.");
  const identifier = `staff-password-reset:${membership.id}`;
  const rawToken = randomBytes(32).toString("hex");
  const value = createHash("sha256").update(rawToken).digest("hex");
  const context = await auth.$context;
  await context.internalAdapter.deleteVerificationByIdentifier(identifier);
  await context.internalAdapter.createVerificationValue({ identifier, value, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  await audit(input.tenant.id, input.actorUserId, "STAFF_PASSWORD_RESET_INITIATED", membership.id, { expiresInMinutes: 60, deliveryReady: false });
  return {
    initiated: true,
    deliveryReady: true,
    resetLink: `${input.baseUrl}/admin/reset-password?membership=${encodeURIComponent(membership.id)}#token=${encodeURIComponent(rawToken)}`,
  };
}

export async function completeStaffPasswordReset(input: { membershipId: string; token: string; password: string }) {
  const context = await auth.$context;
  const identifier = `staff-password-reset:${input.membershipId}`;
  const value = createHash("sha256").update(input.token).digest("hex");
  const password = await context.password.hash(input.password);
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ value: string; expiresAt: Date }>>`
      SELECT "value", "expiresAt"
      FROM "verifications"
      WHERE "identifier" = ${identifier}
      FOR UPDATE
    `;
    const stored = rows[0];
    const supplied = Buffer.from(value);
    const expected = Buffer.from(stored?.value ?? "");
    if (!stored || supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || stored.expiresAt <= new Date()) {
      throw new Error("This password reset link is invalid or expired.");
    }
    const membership = await tx.staffMembership.findUnique({ where: { id: input.membershipId } });
    if (!membership?.isActive) throw new Error("This password reset link is invalid or expired.");
    const account = await tx.account.findFirst({ where: { userId: membership.userId, providerId: "credential" } });
    if (!account) throw new Error("Staff credential account is unavailable.");
    await tx.account.update({ where: { id: account.id }, data: { password } });
    const consumed = await tx.verification.deleteMany({ where: { identifier, value, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new Error("This password reset link is invalid or expired.");
  });
  const membership = await db.staffMembership.findUnique({ where: { id: input.membershipId }, select: { userId: true } });
  if (membership) await context.internalAdapter.deleteUserSessions(membership.userId);
  return { completed: true };
}