import "server-only";

import { db } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";

export async function getHomeData(tenant: ResolvedTenant) {
  const now = new Date();
  const [siteNotice, heroSlides, highlights, homeSettings, tenantSettings, services, forms, news, faqs, contact, calculatorSettings] =
    await Promise.all([
      db.siteNotice.findFirst({
        where: {
          tenantId: tenant.id,
          isEnabled: true,
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        },
      }),
      db.homeHeroSlide.findMany({
        where: { tenantId: tenant.id, isEnabled: true, mediaAssetId: { not: null }, mediaAsset: { retiredAt: null } },
        include: { mediaAsset: { select: { id: true, altText: true } } },
        orderBy: { sortOrder: "asc" },
        take: 4,
      }),
      db.homeHighlight.findMany({
        where: { tenantId: tenant.id, isEnabled: true },
        orderBy: { sortOrder: "asc" },
      }),
      db.homeSettings.findUnique({ where: { tenantId: tenant.id } }),
      db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { memberAppStatus: true, memberAppUrl: true } }),
      db.service.findMany({ where: { tenantId: tenant.id, isEnabled: true }, orderBy: { sortOrder: "asc" } }),
      db.formDocument.findMany({
        where: {
          tenantId: tenant.id,
          isEnabled: true,
          mediaAsset: { retiredAt: null },
           isAnnualReport: false,
        },
        include: { mediaAsset: { select: { id: true, originalFilename: true, retiredAt: true } } },
        orderBy: { sortOrder: "asc" },
        take: 6,
      }),
      db.newsNotice.findMany({
        where: { tenantId: tenant.id, isPublished: true, publishedAt: { lte: now } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      db.fAQ.findMany({ where: { tenantId: tenant.id, isEnabled: true }, orderBy: { sortOrder: "asc" } }),
      db.contactSettings.findUnique({ where: { tenantId: tenant.id } }),
      db.calculatorSettings.findUnique({
        where: { tenantId: tenant.id },
        select: { isEnabled: true, weeklyEnabled: true, fortnightlyEnabled: true, monthlyEnabled: true },
      }),
    ]);

  return { tenant, siteNotice, heroSlides, highlights, homeSettings, tenantSettings, services, forms, news, faqs, contact, calculatorSettings };
}

export async function getActiveSiteNotice(tenant: ResolvedTenant) {
  const now = new Date();
  return db.siteNotice.findFirst({
    where: {
      tenantId: tenant.id,
      isEnabled: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
  });
}