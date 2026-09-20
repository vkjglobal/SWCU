import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getPublicContactSettings, getPublishedPageContent, hasPublishedPrivacy } from "@/lib/public-data";
import { CONTACT_SUBJECTS } from "@/lib/contact";
import { ContactForm, InnerHero } from "../_components";
import { buildPublicMetadata } from "../metadata";
import { formatTelephone, telephoneHref } from "@/lib/public-links";

export async function generateMetadata(): Promise<Metadata> { return buildPublicMetadata((await headers()).get("host") ?? "", "/contact", "Contact SWCU | Service Worker Credit Union", "Contact Service Worker Credit Union using approved contact details."); }

export default async function ContactPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [contact, privacyOpen, pages] = await Promise.all([getPublicContactSettings(tenant), hasPublishedPrivacy(tenant), getPublishedPageContent(tenant, ["CONTACT_INTRO"])]);
  return <><InnerHero eyebrow="Contact" title="Contact Service Worker Credit Union" summary={pages[0]?.body?.split(/\n/)[0]}/><div className="site-container section-shell"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div>{contact ? <div className="rounded-2xl bg-deep-navy p-7 text-white"><h2 className="font-heading text-2xl font-bold">{contact.organisationName}</h2><div className="mt-6 grid gap-4 text-white/80"><p>{contact.streetAddress}<br/>{contact.postalAddress}</p><div className="overflow-hidden rounded-xl border border-white/15">{contact.contactMapMediaAsset ? <Image src={`/api/media/${contact.contactMapMediaAsset.id}`} alt="Map showing the SWCU office at 300 Waimanu Road, Suva" width={1200} height={650} className="h-auto w-full" /> : <div className="relative flex min-h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-swcu-blue via-ocean-teal to-deep-navy p-8 text-center"><div className="absolute inset-5 rounded-full border border-white/20"/><div className="absolute inset-x-10 top-10 border-t border-dashed border-white/30"/><div className="relative"><p className="font-heading text-lg font-bold text-white">SWCU office</p><p className="mt-2 text-sm text-white/85">300 Waimanu Road, Suva, Fiji</p></div></div>}</div><a href={telephoneHref(contact.telephone)} className="font-semibold text-white">{formatTelephone(contact.telephone)}</a><a href={`mailto:${contact.publicEmail}`} className="break-all">{contact.publicEmail}</a>{contact.officeHours && <p>{contact.officeHours}</p>}</div></div> : <p className="rounded-xl border border-dashed p-6">Contact details will appear here when published.</p>}</div><div>{privacyOpen ? <ContactForm subjects={CONTACT_SUBJECTS}/> : <div className="rounded-2xl bg-soft-blue-grey p-7"><h2 className="font-heading text-2xl font-bold text-deep-navy">Send us an enquiry</h2><p className="mt-4 text-charcoal/75">The contact form is temporarily unavailable until the published Privacy information is ready. Please use the approved contact details to reach SWCU.</p></div>}</div></div></div></>;
}