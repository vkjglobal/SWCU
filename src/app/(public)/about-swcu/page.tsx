import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getPublishedLeadership, getPublishedPageContent, getPublishedResources } from "@/lib/public-data";
import { Content, InnerHero, ResourceCard } from "../_components";
import { buildPublicMetadata } from "../metadata";

export async function generateMetadata(): Promise<Metadata> { return buildPublicMetadata((await headers()).get("host") ?? "", "/about-swcu", "About SWCU | Service Worker Credit Union", "Learn about Service Worker Credit Union, its story, purpose and leadership."); }

export default async function AboutPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [pages, leadership, resources] = await Promise.all([getPublishedPageContent(tenant, ["ABOUT_STORY","ABOUT_VISION","ABOUT_MISSION","ABOUT_PURPOSE"]), getPublishedLeadership(tenant), getPublishedResources(tenant)]);
  const by = (slot: string) => pages.find((p) => p.slot === slot);
  const reportResources = resources.forms.filter((form) => form.isAnnualReport && form.mediaAssetId);
  return <><InnerHero title="About SWCU"/><div className="site-container section-shell"><div className={leadership.length > 0 ? "grid gap-14 lg:grid-cols-[1.1fr_.9fr]" : undefined}><div className="grid gap-12">{["ABOUT_STORY","ABOUT_VISION","ABOUT_MISSION","ABOUT_PURPOSE"].map((slot) => by(slot) && <Content key={slot} heading={by(slot)?.heading} body={by(slot)?.body}/>)}</div>{leadership.length > 0 && <aside><h2 className="display-heading text-3xl font-bold text-deep-navy">Our Leadership</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{leadership.map((person) => <article key={person.id} className="overflow-hidden rounded-xl border border-deep-navy/10 bg-soft-blue-grey"><div className="relative aspect-[4/3] bg-deep-navy/5">{person.mediaAssetId ? <Image src={`/api/media/${person.mediaAssetId}`} alt={`${person.name}, ${person.title}`} fill sizes="(max-width: 1024px) 50vw, 420px" className="object-cover" /> : <div className="h-full" aria-hidden="true" />}</div><div className="p-5"><h3 className="font-heading text-lg font-bold text-deep-navy">{person.name}</h3><p className="text-sm font-semibold text-swcu-blue">{person.title}</p>{person.group && <p className="mt-2 text-xs uppercase tracking-wider text-charcoal/55">{person.group}</p>}{person.profile && <p className="mt-3 text-sm text-charcoal/70">{person.profile}</p>}</div></article>)}</div></aside>}</div>{reportResources.length > 0 && <section className="mt-16 border-t border-deep-navy/10 pt-12"><h2 className="display-heading text-3xl font-bold text-deep-navy">Annual Reports</h2><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reportResources.map((form) => <ResourceCard key={form.id} title={form.title} description={form.description} href={`/api/media/${form.mediaAssetId}`} />)}</div></section>}</div></>;
}