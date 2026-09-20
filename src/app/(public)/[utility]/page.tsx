import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getPublishedPageContent } from "@/lib/public-data";
import { Content, InnerHero } from "../_components";

export const dynamicParams = false;
export function generateStaticParams() { return [{ utility: "privacy" }, { utility: "terms-of-use" }, { utility: "accessibility" }, { utility: "important-information" }]; }
export async function generateMetadata({ params }: { params: Promise<{ utility: string }> }): Promise<Metadata> {
  const { utility } = await params;
  const title = utility === "privacy" ? "Privacy" : utility === "terms-of-use" ? "Terms of Use" : utility === "accessibility" ? "Accessibility" : "Important Information";
  return { title: { absolute: `${title} | SWCU` }, description: "Information from Service Worker Credit Union." };
}
export default async function UtilityPage({ params }: { params: Promise<{ utility: string }> }) {
  const { utility } = await params;
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  if (utility === "important-information") {
    const pages = await getPublishedPageContent(tenant, ["IMPORTANT_INFORMATION"]);
    const approved = pages[0];
    if (!approved) notFound();
    return <><InnerHero title={approved.heading || "Important Information"}/><div className="site-container section-shell"><div className="grid max-w-3xl gap-8"><Content body={approved.body}/></div></div></>;
  }
  const slot = utility === "privacy" ? "PRIVACY" : utility === "terms-of-use" ? "TERMS_OF_USE" : utility === "accessibility" ? "ACCESSIBILITY" : "";
  if (!slot) notFound();
  const pages = await getPublishedPageContent(tenant, [slot]);
  const page = pages[0];
  if (!page) notFound();
  return <><InnerHero eyebrow={page.heading || utility.replaceAll("-", " ")} title={page.heading || utility.replaceAll("-", " ")} /><div className="site-container section-shell"><Content heading={undefined} body={page.body}/></div></>;
}