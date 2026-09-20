import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";

export default async function RatesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  return <main className="site-container py-12">
    <Link href="/admin">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Rates & Fees</h1>
    <section className="mt-8 max-w-3xl rounded-card border border-deep-navy/10 bg-white p-6">
      <p className="font-semibold text-deep-navy">Public rates are not permitted.</p>
      <p className="mt-3 text-charcoal/70">This area is dormant. Existing records and schema are retained for backward safety, but they cannot be created, edited, enabled or released as public website content.</p>
      <p className="mt-3 text-charcoal/70">Private calculation factors belong under <Link href="/admin/calculator" className="font-semibold text-swcu-blue underline">Loan Calculator Settings</Link>.</p>
    </section>
  </main>;
}