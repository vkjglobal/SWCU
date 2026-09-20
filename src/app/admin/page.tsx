import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { CmsDraftStatus, ContactSubmissionStatus } from "@/generated/prisma/client";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { AdminShell, StatusBadge } from "@/app/admin/admin-shell";

const modules = [
  ["Homepage", "/admin/homepage", "Hero images, highlights and services"],
  ["Site notice", "/admin/site-notice", "A scheduled message for members"],
  ["Forms and documents", "/admin/forms", "Approved member downloads"],
  ["News and notices", "/admin/news", "Public updates"],
  ["FAQs", "/admin/faqs", "Common member questions"],
  ["Contact details", "/admin/contact", "The public contact source"],
  ["Media library", "/admin/media", "Images and documents"],
  ["Page content", "/admin/page-content", "Approved fixed content slots"],
  ["Utility pages", "/admin/utility-pages", "Administrator-only institutional pages"],
  ["Leadership & committees", "/admin/leadership", "Approved committee records"],
  ["Calculator settings", "/admin/calculator", "Inactive until SWCU confirms method"],
  ["Contact enquiries", "/admin/contact-enquiries", "Review messages received from members"],
];

export default async function AdminDashboardPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const [heroCount, faqCount, waiting, myDrafts, newEnquiries] = await Promise.all([
    db.homeHeroSlide.count({ where: { tenantId: tenant.id } }),
    db.fAQ.count({ where: { tenantId: tenant.id } }),
    db.cmsDraft.count({ where: { tenantId: tenant.id, status: CmsDraftStatus.WAITING_FOR_APPROVAL } }),
    db.cmsDraft.count({ where: { tenantId: tenant.id, createdBy: membership.userId, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.RETURNED_FOR_CHANGES] } } }),
    db.contactSubmission.count({ where: { tenantId: tenant.id, status: ContactSubmissionStatus.NEW } }),
  ]);
  return <AdminShell role={membership.role} title="Website administration" intro="Manage, review and publish SWCU website content.">
     <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{membership.role === "ADMINISTRATOR" && <Link href="/admin/approvals" className="rounded-card border border-swcu-blue/20 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-swcu-blue/40"><p className="text-sm font-semibold text-swcu-blue">Pending approvals</p><p className="mt-2 font-heading text-3xl font-bold text-deep-navy">{waiting}</p><p className="mt-1 text-sm text-charcoal/70">Changes waiting for review</p><span className="mt-4 inline-block text-sm font-semibold text-swcu-blue">Review submissions</span></Link>}<Link href="/admin/drafts" className="rounded-card border border-ocean-teal/20 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-ocean-teal/40"><p className="text-sm font-semibold text-ocean-teal">My drafts</p><p className="mt-2 font-heading text-3xl font-bold text-deep-navy">{myDrafts}</p><p className="mt-1 text-sm text-charcoal/70">Your drafts needing attention</p><span className="mt-4 inline-block text-sm font-semibold text-swcu-blue">Open drafts</span></Link><Link href="/admin/contact-enquiries" className="rounded-card border border-swcu-red/20 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-swcu-red/40"><p className="text-sm font-semibold text-swcu-red">Contact enquiries</p><p className="mt-2 font-heading text-3xl font-bold text-deep-navy">{newEnquiries}</p><p className="mt-1 text-sm text-charcoal/70">New messages</p><span className="mt-4 inline-block text-sm font-semibold text-swcu-blue">Open enquiries</span></Link></div>
    <section className="mt-10"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Content areas</p><h2 className="mt-1 font-heading text-2xl font-bold text-deep-navy">Choose where to work</h2></div><div className="hidden text-right text-sm text-charcoal/60 sm:block"><p>{heroCount} homepage images</p><p>{faqCount} FAQs</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.filter(([, href]) => membership.role === "ADMINISTRATOR" || ["/admin/site-notice", "/admin/forms", "/admin/news", "/admin/faqs", "/admin/media"].includes(href)).map(([label, href, description]) => <Link key={href} href={href} className="rounded-xl border border-deep-navy/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-swcu-blue/30"><p className="font-heading font-semibold text-deep-navy">{label}</p><p className="mt-2 text-sm text-charcoal/65">{description}</p><span className="mt-5 inline-block text-sm font-semibold text-swcu-blue">Open area</span></Link>)}</div></section>
    <div className="mt-8 flex items-center gap-3 text-sm text-charcoal/60"><StatusBadge status="PUBLISHED"/><span>Public content is reviewed before it goes live.</span></div>
  </AdminShell>;
}