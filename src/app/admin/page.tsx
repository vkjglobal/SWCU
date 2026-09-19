import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";

const modules = [
  ["Homepage", "/admin/homepage", "Hero, highlights and services"],
  ["Site Notice", "/admin/site-notice", "Sitewide scheduled message"],
  ["Forms & Documents", "/admin/forms", "Approved member downloads"],
  ["News & Notices", "/admin/news", "Publish public updates"],
  ["FAQs", "/admin/faqs", "Common member questions"],
  ["Contact Details", "/admin/contact", "Central public contact source"],
  ["Media Library", "/admin/media", "Upload, replace and retire images"],
];

export default async function AdminDashboardPage() {
  const hostname = (await headers()).get("host") ?? "";
  const tenant = await requireTenant(hostname);
  const { membership } = await requireStaffMembership(tenant);
  const [heroCount, serviceCount, faqCount] = await Promise.all([
    db.homeHeroSlide.count({ where: { tenantId: tenant.id } }),
    db.service.count({ where: { tenantId: tenant.id } }),
    db.fAQ.count({ where: { tenantId: tenant.id } }),
  ]);

  return (
    <main className="min-h-screen bg-soft-blue-grey">
      <header className="border-b border-deep-navy/10 bg-white">
        <div className="site-container flex min-h-20 items-center justify-between">
          <div>
            <p className="font-heading text-xl font-bold text-deep-navy">SWCU CMS</p>
          <p className="text-sm text-charcoal/65">Homepage content workspace</p>
          </div>
          <span className="rounded-full bg-swcu-blue/10 px-3 py-1 text-sm font-semibold text-swcu-blue">
            {membership.role === "ADMINISTRATOR" ? "Administrator" : "Editor"}
          </span>
        </div>
      </header>
      <section className="site-container py-12">
        <p className="eyebrow">Protected staff area</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">
          Keep SWCU content clear, useful and up to date.
        </h1>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(([module, href, description]) => (
            <a key={module} href={href} className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-swcu-blue/30">
              <p className="font-heading font-semibold text-deep-navy">{module}</p>
              <p className="mt-2 text-sm text-charcoal/65">{description}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-swcu-blue">Open module →</span>
            </a>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3 text-sm text-charcoal/65">
          <span>{heroCount} hero slides</span><span>·</span><span>{serviceCount} services</span><span>·</span><span>{faqCount} FAQs</span>
        </div>
      </section>
    </main>
  );
}