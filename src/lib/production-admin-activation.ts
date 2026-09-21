import "server-only";

import { randomUUID } from "node:crypto";
import { StaffRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import {
  activationRequestMatchesCanonicalOrigin,
  activationSecretMatches,
  canonicalCredentialAccount,
} from "@/lib/production-activation-guards";
import { prepareStaffPasswordReset } from "@/lib/staff-accounts";

export const PRODUCTION_ADMIN_USER_ID = "1CFu4jCYA21L2lSLumV90ZNwypivFKsb";
export const PRODUCTION_ADMIN_EMAIL = "buzzmefiji@gmail.com";
const ACTIVATION_LOCK = "swcu-production-admin-activation";

export function productionAdminActivationAvailable(request?: {
  host?: string | null;
  forwardedProto?: string | null;
  origin?: string | null;
}) {
  const environment = getServerEnvironment();
  if (
    environment.NODE_ENV !== "production" ||
    !environment.SWCU_PRODUCTION_ADMIN_ACTIVATION_SECRET ||
    !environment.BETTER_AUTH_URL
  ) {
    return false;
  }
  return Boolean(request && activationRequestMatchesCanonicalOrigin({
    canonicalUrl: environment.BETTER_AUTH_URL,
    host: request.host,
    forwardedProto: request.forwardedProto,
    origin: request.origin,
  }));
}

export async function activateProductionAdministrator(input: {
  secret: string;
  host?: string | null;
  forwardedProto?: string | null;
  origin?: string | null;
}) {
  const environment = getServerEnvironment();
  const expectedSecret = environment.SWCU_PRODUCTION_ADMIN_ACTIVATION_SECRET;
  if (
    !productionAdminActivationAvailable(input) ||
    !expectedSecret ||
    !activationSecretMatches(input.secret, expectedSecret)
  ) {
    throw new Error("Production Administrator activation is unavailable.");
  }

  const baseUrl = new URL(environment.BETTER_AUTH_URL!).origin;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ACTIVATION_LOCK}, 0))`;

    const tenant = await tx.tenant.findUnique({
      where: { slug: "swcu" },
      select: { id: true, isActive: true },
    });
    const user = await tx.user.findUnique({
      where: { id: PRODUCTION_ADMIN_USER_ID },
      select: { id: true, email: true },
    });
    if (
      !tenant?.isActive ||
      !user ||
      user.email.trim().toLowerCase() !== PRODUCTION_ADMIN_EMAIL
    ) {
      throw new Error("Production Administrator activation is unavailable.");
    }

    const membership = await tx.staffMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      select: { id: true, role: true, isActive: true },
    });
    if (!membership?.isActive || membership.role !== StaffRole.ADMINISTRATOR) {
      throw new Error("Production Administrator activation is unavailable.");
    }

    const credentialAccounts = await tx.account.findMany({
      where: { userId: user.id, providerId: "credential" },
      select: { id: true, accountId: true, password: true },
    });
    const credential = canonicalCredentialAccount(credentialAccounts, user.id);
    if (credential?.password) {
      throw new Error("Production Administrator activation is unavailable.");
    }

    const identifier = `staff-password-reset:${membership.id}`;
    const pendingVerification = await tx.verification.findFirst({
      where: { identifier, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pendingVerification) {
      throw new Error("Production Administrator activation is unavailable.");
    }

    if (!credential) {
      await tx.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          providerId: "credential",
          accountId: user.id,
        },
      });
    }

    const prepared = prepareStaffPasswordReset(membership.id, baseUrl);
    await tx.verification.deleteMany({ where: { identifier: prepared.identifier } });
    await tx.verification.create({
      data: {
        id: randomUUID(),
        identifier: prepared.identifier,
        value: prepared.value,
        expiresAt: prepared.expiresAt,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: user.id,
        action: "PRODUCTION_ADMIN_ACTIVATION_INITIATED",
        targetType: "StaffMembership",
        targetId: membership.id,
        changeMetadata: { expiresInMinutes: 60, credentialCreated: !credential },
      },
    });

    return { resetLink: prepared.resetLink };
  });
}