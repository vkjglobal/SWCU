import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getPublicContactSettings, getPublishedPageContent, hasPublishedPrivacy } from "@/lib/public-data";
import { CONTACT_SUBJECTS } from "@/lib/contact";
import { ContactForm, InnerHero } from "../_components";
import { buildPublicMetadata } from "../metadata";

export async function generateMetadata(): Promise<Metadata> { return buildPublicMetadata((await headers()).get("host") ?? "", "/contact", "Contact SWCU | Service Worker Credit Union", "Contact Service Worker Credit Union using approved contact details."); }

export default async function ContactPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [contact, privacyOpen, pages] = await Promise.all([getPublicContactSettings(tenant), hasPublishedPrivacy(tenant), getPublishedPageContent(tenant, ["CONTACT_INTRO"])]);
  return <><InnerHero eyebrow="Contact" title="Contact Service Worker Credit Union" summary={pages[0]?.body?.split(/\n/)[0]}/><div className="site-container section-shell"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div>{contact ? <div className="rounded-2xl bg-deep-navy p-7 text-white"><h2 className="font-heading text-2xl font-bold">{contact.organisationName}</h2><div className="mt-6 grid gap-4 text-white/80"><p>{contact.streetAddress}<br/>{contact.postalAddress}</p><a href={`tel:${contact.telephone}`} className="font-semibold text-white">{contact.telephone}</a><a href={`mailto:${contact.publicEmail}`} className="break-all">{contact.publicEmail}</a>{contact.officeHours && <p>{contact.officeHours}</p>}</div></div> : <p className="rounded-xl border border-dashed p-6">Contact details will appear here when published.</p>}</div><div>{privacyOpen ? <ContactForm subjects={CONTACT_SUBJECTS}/> : <div className="rounded-2xl bg-soft-blue-grey p-7"><h2 className="font-heading text-2xl font-bold text-deep-navy">Send us an enquiry</h2><p className="mt-4 text-charcoal/75">The contact form is temporarily unavailable until the published Privacy information is ready. Please use the approved contact details to reach SWCU.</p></div>}</div></div></div></>;
}