import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { AdminShell } from "@/app/admin/admin-shell";
import { UTILITY_PAGE_DEFINITIONS } from "@/lib/utility-pages";

export default async function UtilityPagesAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);

  return <AdminShell role={membership.role} title="Utility pages" intro="Manage the four fixed institutional pages through the existing review and publishing workflow.">
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {UTILITY_PAGE_DEFINITIONS.map((page) => <Link key={page.slot} href={`/admin/utility-pages/${page.slug}`} className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-swcu-blue/30">
        <h2 className="font-heading text-xl font-bold text-deep-navy">{page.label}</h2>
        <p className="mt-2 text-sm text-charcoal/70">Open, preview, edit, and submit this fixed page for approval.</p>
        <span className="mt-5 inline-block text-sm font-semibold text-swcu-blue">Open page</span>
      </Link>)}
    </div>
  </AdminShell>;
}