import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { getPublishedResources } from "@/lib/public-data";
import { FAQList, InnerHero, ResourceCard } from "../_components";
import { buildPublicMetadata } from "../metadata";
import { MotionReveal } from "@/components/motion-reveal";

export async function generateMetadata(): Promise<Metadata> { return buildPublicMetadata((await headers()).get("host") ?? "", "/forms-resources", "Forms & Resources | SWCU", "Find approved SWCU forms, news and notices, and common questions."); }

export default async function FormsResourcesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { forms, news, faqs } = await getPublishedResources(tenant);
  return <><InnerHero title="Forms & Resources"/><div className="site-container section-shell"><div className="grid gap-16"><section id="forms"><MotionReveal><h2 className="display-heading text-3xl font-bold text-deep-navy">Forms</h2></MotionReveal>{forms.length > 0 ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{forms.map((f, index)=><MotionReveal key={f.id} index={index}><ResourceCard title={f.title} description={f.description} href={`/api/media/${f.mediaAssetId}`}/></MotionReveal>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-deep-navy/20 p-6 text-charcoal/65">Forms will appear here when available.</p>}</section><section id="news"><MotionReveal><h2 className="display-heading text-3xl font-bold text-deep-navy">News &amp; Notices</h2></MotionReveal><div className="mt-7 grid gap-3">{news.length ? news.map((n, index)=><MotionReveal key={n.id} index={index}><article className="border-b border-deep-navy/10 py-4"><h3 className="font-heading text-lg font-bold text-deep-navy">{n.title}</h3><p className="mt-1 text-sm text-charcoal/60">{n.publishedAt?.toLocaleDateString("en-FJ",{year:"numeric",month:"long",day:"numeric"})}</p>{n.summary && <p className="mt-2 text-charcoal/75">{n.summary}</p>}</article></MotionReveal>) : <p className="rounded-xl border border-dashed border-deep-navy/20 p-6 text-charcoal/65">News and notices will appear here when available.</p>}</div></section><section id="questions"><MotionReveal><h2 className="display-heading text-3xl font-bold text-deep-navy">Common Questions</h2></MotionReveal>{faqs.length ? <div className="mt-7"><MotionReveal><FAQList faqs={faqs}/></MotionReveal></div> : <p className="mt-5 rounded-xl border border-dashed border-deep-navy/20 p-6 text-charcoal/65">Common questions will appear here when available.</p>}</section></div></div></>;
}