import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getCalculatorSettings, getPublishedPageContent } from "@/lib/public-data";
import { Content, InnerHero } from "../_components";

export const dynamicParams = false;
export function generateStaticParams() { return [{ utility: "privacy" }, { utility: "terms-of-use" }, { utility: "accessibility" }, { utility: "important-information" }]; }
export async function generateMetadata({ params }: { params: Promise<{ utility: string }> }): Promise<Metadata> {
  const { utility } = await params;
  return { title: `${utility.replaceAll("-", " ")} | SWCU`, description: "Published information from Service Worker Credit Union." };
}
export default async function UtilityPage({ params }: { params: Promise<{ utility: string }> }) {
  const { utility } = await params;
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  if (utility === "important-information") {
    const [settings, pages] = await Promise.all([getCalculatorSettings(tenant), getPublishedPageContent(tenant, ["IMPORTANT_INFORMATION"])]);
    const approved = pages[0];
    return <><InnerHero eyebrow="Important Information" title="Stay safe when dealing with SWCU" summary="Please take care when sharing personal or security information."/><div className="site-container section-shell"><div className="grid max-w-3xl gap-8"><div className="rounded-2xl bg-soft-blue-grey p-7">{settings?.securityReminder && <><h2 className="display-heading text-3xl font-bold text-deep-navy">Security reminder</h2><p className="mt-4 text-charcoal/80">{settings.securityReminder}</p></>}{settings?.disclaimer && <p className="mt-6 border-t border-deep-navy/10 pt-5 text-sm text-charcoal/70">{settings.disclaimer}</p>}</div>{approved && <Content heading={approved.heading} body={approved.body}/>}</div></div></>;
  }
  const slot = utility === "privacy" ? "PRIVACY" : utility === "terms-of-use" ? "TERMS_OF_USE" : utility === "accessibility" ? "ACCESSIBILITY" : "";
  if (!slot) notFound();
  const pages = await getPublishedPageContent(tenant, [slot]);
  const page = pages[0];
  if (!page) notFound();
  return <><InnerHero eyebrow={page.heading || utility.replaceAll("-", " ")} title={page.heading || utility.replaceAll("-", " ")} /><div className="site-container section-shell"><Content heading={undefined} body={page.body}/></div></>;
}