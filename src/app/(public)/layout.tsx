import { headers } from "next/headers";
import { PublicHeader, PublicFooter, MobileQuickActions } from "./_components";
import { requireTenant } from "@/lib/tenant";
import { getActiveSiteNotice } from "@/lib/home-data";
import { getPublicContactSettings, getPublishedPageContent } from "@/lib/public-data";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const hostname = (await headers()).get("host") ?? "";
  const tenant = await requireTenant(hostname);
  const notice = await getActiveSiteNotice(tenant);
  const [contact, pages] = await Promise.all([getPublicContactSettings(tenant), getPublishedPageContent(tenant, ["PRIVACY", "TERMS_OF_USE", "ACCESSIBILITY", "IMPORTANT_INFORMATION"])]);
  const published = { privacy: pages.some((p) => p.slot === "PRIVACY"), terms: pages.some((p) => p.slot === "TERMS_OF_USE"), accessibility: pages.some((p) => p.slot === "ACCESSIBILITY"), importantInformation: pages.some((p) => p.slot === "IMPORTANT_INFORMATION") };

  return <><PublicHeader />{notice && <div className="border-b border-swcu-blue/15 bg-soft-blue-grey"><div className="site-container py-2 text-center text-sm">{notice.message}{notice.actionUrl && <a className="ml-3 font-bold text-swcu-blue" href={notice.actionUrl}>{notice.actionText || "Learn more"}</a>}</div></div>}<main className="pb-24 md:pb-0">{children}</main><MobileQuickActions phone={contact?.telephone}/><PublicFooter contact={contact} published={published} /></>;
}