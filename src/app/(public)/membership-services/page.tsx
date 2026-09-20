import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getCalculatorSettings, getPublishedPageContent, getPublishedResources } from "@/lib/public-data";
import { AnchorNav, Content, InnerHero, ResourceCard } from "../_components";
import { buildPublicMetadata } from "../metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildPublicMetadata((await headers()).get("host") ?? "", "/membership-services", "Membership & Member Services | SWCU", "Learn about SWCU membership, savings, loans, retirement savings and member benefits.");
}

export default async function MembershipServicesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [pages, settings, resources] = await Promise.all([
    getPublishedPageContent(tenant, ["MEMBERSHIP_INTRO", "SAVINGS_INTRO", "LOANS_INTRO", "RETIREMENT_INTRO", "DEATH_BENEFIT_INTRO"]),
    getCalculatorSettings(tenant),
    getPublishedResources(tenant),
  ]);
  const by = (slot: string) => pages.find((page) => page.slot === slot);
  const sections = [["membership", "Membership", "MEMBERSHIP_INTRO"], ["savings", "Savings", "SAVINGS_INTRO"], ["loans", "Loans", "LOANS_INTRO"], ["retirement-savings", "Retirement", "RETIREMENT_INTRO"], ["death-benefit", "Death Benefit", "DEATH_BENEFIT_INTRO"]] as const;
  const membershipForms = resources.forms.filter((form) => /membership/i.test(form.title) && form.mediaAssetId);

  return <><InnerHero title="Membership & Member Services" summary="Everything you need to know about joining SWCU, saving, borrowing and your member benefits." /><AnchorNav items={sections.map(([id, label]) => [id, label])} /><div className="site-container section-shell"><div className="grid gap-12 lg:grid-cols-[1fr_.72fr]"><div className="grid gap-12">
     {sections.map(([id, label, slot]) => <section id={id} key={id} className="scroll-mt-52">
        {by(slot) && <Content heading={by(slot)?.heading || label} body={by(slot)?.body} />}
       {id === "membership" && <div id="joining" className="mt-8 scroll-mt-52 rounded-2xl bg-soft-blue-grey p-7">
         {membershipForms.length > 0 ? <div className="grid gap-3 sm:grid-cols-2">{membershipForms.map((form) => <ResourceCard key={form.id} title={form.title} description={form.description} href={`/api/media/${form.mediaAssetId}`} />)}</div> : <p className="text-charcoal/70">The application will appear here when available.</p>}
         <div className="mt-6 flex flex-wrap gap-3"><Link href="/forms-resources" className="button-secondary">Forms &amp; Resources</Link><Link href="/contact" className="button-primary">Contact SWCU</Link></div>
      </div>}
    </section>)}
   </div><aside className="h-fit rounded-2xl bg-deep-navy p-6 text-white lg:sticky lg:top-36">{settings && <div><h2 className="font-heading text-xl font-bold">Loan calculator</h2>{settings.disclaimer && <p className="mt-4 text-sm text-white/70">{settings.disclaimer}</p>}</div>}</aside></div></div></>;
}