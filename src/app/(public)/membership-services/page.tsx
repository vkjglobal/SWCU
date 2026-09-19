import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getCalculatorSettings, getPublishedPageContent, getPublishedRates, getPublishedResources } from "@/lib/public-data";
import { AnchorNav, Content, InnerHero, ResourceCard } from "../_components";
import { buildPublicMetadata } from "../metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildPublicMetadata((await headers()).get("host") ?? "", "/membership-services", "Membership & Member Services | SWCU", "Explore approved SWCU membership services and published information for Fiji members.");
}

export default async function MembershipServicesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [pages, rates, settings, resources] = await Promise.all([
    getPublishedPageContent(tenant, ["MEMBERSHIP_INTRO", "SAVINGS_INTRO", "LOANS_INTRO", "RETIREMENT_INTRO", "DEATH_BENEFIT_INTRO"]),
    getPublishedRates(tenant),
    getCalculatorSettings(tenant),
    getPublishedResources(tenant),
  ]);
  const by = (slot: string) => pages.find((page) => page.slot === slot);
  const sections = [["membership", "Membership", "MEMBERSHIP_INTRO"], ["savings", "Savings", "SAVINGS_INTRO"], ["loans", "Loans", "LOANS_INTRO"], ["retirement", "Retirement", "RETIREMENT_INTRO"], ["death-benefit", "Death Benefit", "DEATH_BENEFIT_INTRO"]] as const;
  const membershipForms = resources.forms.filter((form) => /membership/i.test(form.title) && form.mediaAssetId);

  return <><InnerHero eyebrow="Membership & Services" title="Membership & Member Services" summary={by("MEMBERSHIP_INTRO")?.body?.split(/\n/)[0]} /><AnchorNav items={sections.map(([id, label]) => [id, label])} /><div className="site-container section-shell"><div className="grid gap-12 lg:grid-cols-[1fr_.72fr]"><div className="grid gap-12">
     {sections.map(([id, label, slot]) => <section id={id} key={id} className="scroll-mt-36">
        {by(slot) && <Content heading={by(slot)?.heading || label} body={by(slot)?.body} />}
      {id === "membership" && <div id="joining" className="mt-8 scroll-mt-36 rounded-2xl bg-soft-blue-grey p-7">
        <p className="eyebrow">Joining SWCU</p><h2 className="display-heading mt-3 text-3xl font-bold text-deep-navy">Become a Member</h2>
        <ol className="mt-6 grid gap-4 text-charcoal/80">
          <li><strong className="text-deep-navy">1. Review approved membership information.</strong>{by("MEMBERSHIP_INTRO")?.body && <span className="mt-1 block text-sm">Start with the approved information on this page.</span>}</li>
          <li><strong className="text-deep-navy">2. Download the published Membership Application.</strong>{membershipForms.length === 0 && <span className="mt-1 block text-sm">The application will appear here when published.</span>}</li>
          <li><strong className="text-deep-navy">3. Find other documents in Forms &amp; Resources.</strong><span className="mt-1 block text-sm">Visit the resources page for approved documents.</span></li>
          <li><strong className="text-deep-navy">4. Contact SWCU for current requirements or help.</strong><span className="mt-1 block text-sm">Use the published contact details.</span></li>
        </ol>
        {membershipForms.length > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-2">{membershipForms.map((form) => <ResourceCard key={form.id} title={form.title} description={form.description} href={`/api/media/${form.mediaAssetId}`} />)}</div>}
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/forms-resources" className="button-secondary">Forms &amp; Resources</Link><Link href="/contact" className="button-primary">Contact SWCU</Link></div>
      </div>}
    </section>)}
  </div><aside className="h-fit rounded-2xl bg-deep-navy p-6 text-white lg:sticky lg:top-36"><p className="eyebrow text-white/60">Published information</p>{rates.length > 0 ? <div className="mt-5"><h2 className="font-heading text-xl font-bold">Current rates</h2><div className="mt-4 grid gap-3">{rates.map((rate) => <div key={rate.id} className="border-b border-white/15 pb-3"><p className="font-semibold">{rate.label || rate.product}</p><p className="text-lg text-ocean-teal">{rate.displayValue}</p>{rate.note && <p className="text-xs text-white/65">{rate.note}</p>}</div>)}</div></div> : <div className="mt-5 border-t border-white/15 pt-5"><h2 className="font-heading text-xl font-bold">Current rates</h2><p className="mt-3 text-sm text-white/70">Current rate information is not available here.</p></div>}{settings && <div className="mt-8 border-t border-white/15 pt-6"><h2 className="font-heading text-xl font-bold">Loan calculator</h2>{settings.disclaimer && <p className="mt-4 text-sm text-white/70">{settings.disclaimer}</p>}</div>}</aside></div></div></>;
}