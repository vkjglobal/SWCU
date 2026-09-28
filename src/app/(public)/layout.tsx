import { headers } from "next/headers";
import { PublicHeader, PublicFooter, MobileQuickActions } from "./_components";
import { requireTenant } from "@/lib/tenant";
import { getActiveSiteNotice } from "@/lib/home-data";
import { getPublicContactSettings, getPublishedPageContent } from "@/lib/public-data";
import { SiteNoticeMotion } from "@/components/site-notice-motion";
import { db } from "@/lib/db";
import { getMemberAppHref } from "@/lib/public-links";
import { AskSwcuWidget } from "@/components/ask-swcu-widget";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const hostname = (await headers()).get("host") ?? "";
  const tenant = await requireTenant(hostname);
  const notice = await getActiveSiteNotice(tenant);
  const [contact, pages, tenantSettings] = await Promise.all([getPublicContactSettings(tenant), getPublishedPageContent(tenant, ["PRIVACY", "TERMS_OF_USE", "ACCESSIBILITY", "IMPORTANT_INFORMATION"]), db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { memberAppStatus: true, memberAppUrl: true, showAskSwcu: true } })]);
  const published = { privacy: pages.some((p) => p.slot === "PRIVACY"), terms: pages.some((p) => p.slot === "TERMS_OF_USE"), accessibility: pages.some((p) => p.slot === "ACCESSIBILITY"), importantInformation: pages.some((p) => p.slot === "IMPORTANT_INFORMATION") };

  const memberAppHref = getMemberAppHref(tenantSettings);
  return <><PublicHeader memberAppHref={memberAppHref} />{notice && <SiteNoticeMotion notice={notice}/>}<main className="public-site pb-24 md:pb-0">{children}</main><MobileQuickActions phone={contact?.telephone} memberAppHref={memberAppHref}/><PublicFooter contact={contact} published={published} /><AskSwcuWidget enabled={tenantSettings?.showAskSwcu ?? false} /></>;
}