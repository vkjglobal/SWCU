import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { StaffRole } from "@/generated/prisma/enums";
import type { ResolvedTenant } from "@/lib/tenant";

export async function requireStaffMembership(
  tenant: ResolvedTenant,
  allowedRoles: StaffRole[] = ["ADMINISTRATOR", "EDITOR"],
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/admin/login");
  }

  const membership = await db.staffMembership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    },
  });

  if (
    !membership?.isActive ||
    !allowedRoles.includes(membership.role)
  ) {
    redirect("/admin/login?error=unauthorised");
  }

  return { session, membership };
}