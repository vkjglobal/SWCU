import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getPublishedLeadership, getPublishedPageContent, getPublishedResources } from "@/lib/public-data";
import { Content, InnerHero, ResourceCard } from "../_components";
import { buildPublicMetadata } from "../metadata";
import { leadershipGroupLabel } from "@/lib/leadership";

export async function generateMetadata(): Promise<Metadata> { return buildPublicMetadata((await headers()).get("host") ?? "", "/about-swcu", "About SWCU | Service Worker Credit Union", "Learn about Service Worker Credit Union, its story, purpose and leadership."); }

export default async function AboutPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const [pages, leadership, resources] = await Promise.all([getPublishedPageContent(tenant, ["ABOUT_STORY","ABOUT_VISION","ABOUT_MISSION","ABOUT_PURPOSE"]), getPublishedLeadership(tenant), getPublishedResources(tenant)]);
  const by = (slot: string) => pages.find((p) => p.slot === slot);
  const reportResources = resources.forms.filter((form) => form.isAnnualReport && form.mediaAssetId);
  const grouped = leadership.reduce<Record<string, typeof leadership>>((acc, person) => { (acc[person.group] ??= []).push(person); return acc; }, {});
  return <><InnerHero eyebrow="Who we are" title="About SWCU" summary="A member-owned credit union built around the people who keep Fiji moving."/><main className="about-page">
    <section className="site-container about-story">
      <div className="about-content">{["ABOUT_STORY","ABOUT_VISION","ABOUT_MISSION","ABOUT_PURPOSE"].map((slot) => by(slot) && <Content key={slot} heading={by(slot)?.heading} body={by(slot)?.body}/>)}</div>
    </section>
    {leadership.length > 0 && <section className="leadership-section"><div className="site-container"><div className="leadership-heading"><div><p className="eyebrow">Leadership &amp; governance</p><h2 className="display-heading">Our Leadership</h2></div><p>Meet the people entrusted with the care, direction and oversight of the Service Worker Credit Union.</p></div>{Object.entries(grouped).map(([group, people]) => <section key={group} className="leadership-group"><div className="leadership-group-title"><h3>{leadershipGroupLabel(group)}</h3><span aria-hidden="true"/></div><div className={`leadership-grid ${group === "General Manager" ? "leadership-grid-manager" : ""}`}>{people.map((person) => <article key={person.id} className={`leader-card ${group === "General Manager" ? "leader-card-manager" : ""}`}><div className="leader-portrait">{person.mediaAssetId ? <Image src={`/api/media/${person.mediaAssetId}`} alt={`${person.name}, ${person.title}`} fill sizes="(max-width: 767px) 120px, 160px" className="object-cover" /> : <span aria-hidden="true">{person.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}</div><div className="leader-info"><h4>{person.name}</h4><p className="leader-title">{person.title}</p>{person.profile && <p className="leader-profile">{person.profile}</p>}</div></article>)}</div></section>)}</div></section>}
    {reportResources.length > 0 && <section className="site-container about-reports"><h2 className="display-heading text-3xl font-bold text-deep-navy">Annual Reports</h2><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reportResources.map((form) => <ResourceCard key={form.id} title={form.title} description={form.description} href={`/api/media/${form.mediaAssetId}`} />)}</div></section>}
  </main></>;
}