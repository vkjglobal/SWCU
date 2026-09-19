import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
import { db } from "@/lib/db";
import { saveRateFeeAction, updateRateFeeAction } from "../actions";

export default async function RatesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const rates = await db.rateFee.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } });
  return <main className="site-container py-12">
    <Link href="/admin">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Rates & Fees</h1>
    <p className="mt-2 text-charcoal/70">Only approved records appear publicly. Empty records are intentionally omitted.</p>
    <form action={saveRateFeeAction} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 sm:grid-cols-2">
      {["category", "product", "label", "displayValue", "note", "sortOrder"].map((name) => <label key={name} className="text-sm font-semibold">{name}<input name={name} className="mt-1 w-full rounded border p-2" /></label>)}<input name="effectiveAt" type="datetime-local" /><label><input name="isEnabled" type="checkbox" defaultChecked/> Enabled</label>
      <button className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save unpublished rate</button>
    </form>
    <ul className="mt-8 space-y-3">{rates.map((rate) => <li key={rate.id} className="rounded-card bg-white p-4"><form action={updateRateFeeAction} className="grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={rate.id}/>{[["category",rate.category],["product",rate.product],["label",rate.label],["displayValue",rate.displayValue],["note",rate.note ?? ""],["sortOrder",String(rate.sortOrder)]].map(([name,value])=><input key={name} name={name} defaultValue={value} placeholder={name} className="rounded border p-2"/>)}<input name="effectiveAt" type="datetime-local" defaultValue={rate.effectiveAt?.toISOString().slice(0,16) ?? ""} /><label><input name="isEnabled" type="checkbox" defaultChecked={rate.isEnabled}/> Enabled</label><label><input name="isPublished" type="checkbox" defaultChecked={rate.isPublished}/> Public release approved</label><button className="rounded bg-swcu-blue px-3 py-2 font-semibold text-white">Update rate</button></form></li>)}</ul>
  </main>;
}