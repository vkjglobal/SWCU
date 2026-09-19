import "server-only";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import {
  normaliseHostname,
  selectDevelopmentTenantSlug,
} from "@/lib/tenant-core";

export type ResolvedTenant = {
  id: string;
  slug: string;
  displayName: string;
};

export async function resolveTenant(hostname: string, options?: { allowDevelopmentFallback?: boolean }): Promise<ResolvedTenant | null> {
  const environment = getServerEnvironment();
  const normalisedHostname = normaliseHostname(hostname);

  const domain = await db.tenantDomain.findFirst({
    where: {
      hostname: normalisedHostname,
      isActive: true,
      tenant: { isActive: true },
    },
    select: {
      tenant: {
        select: { id: true, slug: true, displayName: true },
      },
    },
  });

  if (domain) {
    return domain.tenant;
  }

  if (options?.allowDevelopmentFallback === false) return null;
  const developmentSlug = selectDevelopmentTenantSlug({
    hostname: normalisedHostname,
    nodeEnv: environment.NODE_ENV,
    developmentSlug: environment.DEV_TENANT_SLUG,
  });

  if (!developmentSlug) {
    return null;
  }

  return db.tenant.findFirst({
    where: { slug: developmentSlug, isActive: true },
    select: { id: true, slug: true, displayName: true },
  });
}

export async function requireTenant(hostname: string): Promise<ResolvedTenant> {
  const tenant = await resolveTenant(hostname);
  if (!tenant) {
    notFound();
  }
  return tenant;
}