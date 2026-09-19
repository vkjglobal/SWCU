import "server-only";

import { db } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import { PAGE_CONTENT_SLOTS } from "@/lib/cms-workflow";

export const PUBLIC_PAGE_SLOTS = PAGE_CONTENT_SLOTS;

export async function getPublishedPageContent(tenant: ResolvedTenant, slots?: readonly string[]) {
  return db.pageContent.findMany({
    where: {
      tenantId: tenant.id,
      isPublished: true,
      slot: { in: [...(slots ?? PUBLIC_PAGE_SLOTS)] },
    },
    orderBy: { slot: "asc" },
    select: { id: true, slot: true, heading: true, body: true, mediaAssetId: true, publishedAt: true },
  });
}

export async function getPublishedLeadership(tenant: ResolvedTenant) {
  return db.leadershipRecord.findMany({
    where: { tenantId: tenant.id, isPublished: true, isEnabled: true, OR: [{ mediaAssetId: null }, { mediaAsset: { retiredAt: null } }] },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, title: true, profile: true, group: true, mediaAssetId: true },
  });
}

export async function getPublishedRates(tenant: ResolvedTenant) {
  return db.rateFee.findMany({
    where: { tenantId: tenant.id, isPublished: true, isEnabled: true },
    orderBy: [{ sortOrder: "asc" }, { effectiveAt: "desc" }],
    select: { id: true, category: true, product: true, label: true, displayValue: true, note: true, effectiveAt: true },
  });
}

export async function getCalculatorSettings(tenant: ResolvedTenant) {
  return db.calculatorSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { status: true, disclaimer: true, securityReminder: true, isEnabled: true },
  });
}

export async function getPublicContactSettings(tenant: ResolvedTenant) {
  return db.contactSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { organisationName: true, streetAddress: true, postalAddress: true, telephone: true, publicEmail: true, officeHours: true, contactMapMediaAsset: { select: { id: true, altText: true, mimeType: true } } },
  });
}

export async function hasPublishedPrivacy(tenant: ResolvedTenant) {
  const page = await db.pageContent.findFirst({
    where: { tenantId: tenant.id, slot: "PRIVACY", isPublished: true, body: { not: null } },
    select: { id: true },
  });
  return Boolean(page);
}

export async function getPublishedResources(tenant: ResolvedTenant) {
  const [forms, news, faqs] = await Promise.all([
    db.formDocument.findMany({
      where: {
        tenantId: tenant.id,
        isEnabled: true,
        mediaAsset: { retiredAt: null },
        OR: [{ isAnnualReport: false }, { isAnnualReport: true, publicApprovedAt: { not: null } }],
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, description: true, category: true, isAnnualReport: true, mediaAssetId: true },
    }),
    db.newsNotice.findMany({
      where: { tenantId: tenant.id, isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, summary: true, publishedAt: true },
    }),
    db.fAQ.findMany({
      where: { tenantId: tenant.id, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, question: true, answer: true },
    }),
  ]);
  return { forms, news, faqs };
}