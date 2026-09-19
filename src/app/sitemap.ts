import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { resolveTenant } from "@/lib/tenant";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const tenant = await resolveTenant(host);
  if (!tenant) return [];
  const base = `${requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http"}://${host}`;
  const paths = ["/", "/about-swcu", "/membership-services", "/forms-resources", "/contact"];
  const utility = await db.pageContent.findMany({
    where: { tenantId: tenant.id, slot: { in: ["PRIVACY", "TERMS_OF_USE", "ACCESSIBILITY"] }, isPublished: true },
    select: { slot: true, updatedAt: true },
  });
  const utilityPaths = utility.map((item) => ({ PRIVACY: "/privacy", TERMS_OF_USE: "/terms-of-use", ACCESSIBILITY: "/accessibility" }[item.slot])).filter(Boolean);
  return [...paths.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const })), ...utility.map((item, index) => ({ url: `${base}${utilityPaths[index]}`, lastModified: item.updatedAt }))];
}