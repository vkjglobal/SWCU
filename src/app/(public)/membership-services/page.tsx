import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getCalculatorSettings, getPublishedPageContent, getPublishedResources, getRetirementMinimumContribution } from "@/lib/public-data";
import { findExactMemberServiceForm, MEMBER_SERVICE_FORM_TITLES } from "@/lib/member-service-forms";
import { AnchorNav, Content, InnerHero, ResourceCard } from "../_components";
import { buildPublicMetadata } from "../metadata";
import { MotionReveal } from "@/components/motion-reveal";

export async function generateMetadata(): Promise<Metadata> {
  return buildPublicMetadata((await headers()).get("host") ?? "", "/membership-services", "Membership & Member Services | SWCU", "Learn about SWCU membership, savings, loans, retirement savings and member benefits.");
}

export default async function MembershipServicesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [pages, settings, resources, retirementMinimum] = await Promise.all([
    getPublishedPageContent(tenant, ["MEMBERSHIP_INTRO", "SAVINGS_INTRO", "LOANS_INTRO", "RETIREMENT_INTRO", "DEATH_BENEFIT_INTRO"]),
    getCalculatorSettings(tenant),
    getPublishedResources(tenant),
    getRetirementMinimumContribution(tenant),
  ]);
  const by = (slot: string) => pages.find((page) => page.slot === slot);
  const sections = [["membership", "Membership", "MEMBERSHIP_INTRO"], ["savings", "Savings", "SAVINGS_INTRO"], ["loans", "Loans", "LOANS_INTRO"], ["retirement-savings", "Retirement Savings", "RETIREMENT_INTRO"], ["death-benefit", "Death Benefit", "DEATH_BENEFIT_INTRO"]] as const;
  const membershipForm = findExactMemberServiceForm(resources.forms, MEMBER_SERVICE_FORM_TITLES.membership);
  const fullWithdrawalForm = findExactMemberServiceForm(resources.forms, MEMBER_SERVICE_FORM_TITLES.fullWithdrawal);
  const partialWithdrawalForm = findExactMemberServiceForm(resources.forms, MEMBER_SERVICE_FORM_TITLES.partialWithdrawal);
  const loanForm = findExactMemberServiceForm(resources.forms, MEMBER_SERVICE_FORM_TITLES.loan);
  const deathBenefitForm = findExactMemberServiceForm(resources.forms, MEMBER_SERVICE_FORM_TITLES.deathBenefit);

  return <><InnerHero title="Membership & Member Services" summary="Everything you need to know about joining SWCU, saving, borrowing and your member benefits." /><AnchorNav items={sections.map(([id, label]) => [id, label])} /><div className="site-container section-shell"><div className="grid gap-12 lg:grid-cols-[1fr_.72fr]"><div className="grid gap-12">
      {sections.map(([id, label, slot], sectionIndex) => <section id={id} key={id} className="scroll-mt-52">
         {by(slot) && <MotionReveal><Content heading={by(slot)?.heading || label} body={by(slot)?.body} /></MotionReveal>}
         {id === "membership" && <div id="joining" className="mt-8 scroll-mt-52 rounded-2xl bg-soft-blue-grey p-7">
           {membershipForm ? <ResourceCard title={membershipForm.title} description={membershipForm.description} href={`/api/media/${membershipForm.mediaAssetId}`} label="Download Membership Application" /> : <p className="text-charcoal/70">The application will appear here when available.</p>}
         <div className="mt-6 flex flex-wrap gap-3"><Link href="/forms-resources" className="button-secondary">Forms &amp; Resources</Link><Link href="/contact" className="button-primary">Contact SWCU</Link></div>
       </div>}
         {id === "savings" && (fullWithdrawalForm || partialWithdrawalForm) && <div className="mt-8 grid gap-3 sm:grid-cols-2">{fullWithdrawalForm && <MotionReveal index={0}><ResourceCard title={MEMBER_SERVICE_FORM_TITLES.fullWithdrawal} description={fullWithdrawalForm.description} href={`/api/media/${fullWithdrawalForm.mediaAssetId}`} /></MotionReveal>}{partialWithdrawalForm && <MotionReveal index={1}><ResourceCard title={MEMBER_SERVICE_FORM_TITLES.partialWithdrawal} description={partialWithdrawalForm.description} href={`/api/media/${partialWithdrawalForm.mediaAssetId}`} /></MotionReveal>}</div>}
         {id === "loans" && loanForm && <div className="mt-8"><MotionReveal index={sectionIndex}><ResourceCard title="Loan Application Form" description={loanForm.description} href={`/api/media/${loanForm.mediaAssetId}`} label="Download Loan Application Form" /></MotionReveal></div>}
        {id === "retirement-savings" && retirementMinimum && <p className="mt-6 rounded-xl bg-soft-blue-grey p-4 font-semibold text-deep-navy">Minimum Contribution: {retirementMinimum}</p>}
         {id === "death-benefit" && deathBenefitForm && <div className="mt-8"><MotionReveal index={sectionIndex}><ResourceCard title="Special Death Benefit Claim Form" description={deathBenefitForm.description} href={`/api/media/${deathBenefitForm.mediaAssetId}`} label="Download Special Death Benefit Claim Form" /></MotionReveal></div>}
    </section>)}
   </div><aside className="h-fit rounded-2xl bg-deep-navy p-6 text-white lg:sticky lg:top-36">{settings && <div><h2 className="font-heading text-xl font-bold">Loan calculator</h2>{settings.disclaimer && <p className="mt-4 text-sm text-white/70">{settings.disclaimer}</p>}</div>}</aside></div></div></>;
}