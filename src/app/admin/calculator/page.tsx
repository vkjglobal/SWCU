import { headers } from "next/headers";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
import { db } from "@/lib/db";
import { saveCalculatorSettingsAction } from "../actions";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export default async function CalculatorPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const settings = await db.calculatorSettings.findUnique({ where: { tenantId: tenant.id } });
  return <main className="site-container py-12"><Link href="/admin">← Dashboard</Link><h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Loan calculator settings</h1><p className="mt-2 text-charcoal/70">The calculator remains inactive until SWCU confirms its method, rates and terms.</p><div className="mt-8 rounded-card bg-white p-6"><p className="font-semibold">Calculator status: Awaiting SWCU configuration</p><p className="mt-3 text-sm text-charcoal/70">{settings?.disclaimer}</p><AdminActionForm action={saveCalculatorSettingsAction} className="mt-5" successMessage="Calculator settings saved."><AdminSubmitButton pendingLabel="Saving…" className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save inactive settings</AdminSubmitButton></AdminActionForm></div></main>;
}