import { headers } from "next/headers";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
import { saveCalculatorSettingsAction } from "../actions";
import { getCalculatorSettings } from "@/lib/calculator-settings";
import { AdminCalculatorSettings } from "@/components/admin-calculator-settings";

export default async function CalculatorPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const settings = await getCalculatorSettings(tenant.id);
  return <main className="site-container py-12"><Link href="/admin">← Dashboard</Link><h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Loan Calculator</h1><p className="mt-2 max-w-3xl text-charcoal/70">Manage the website repayment estimate and test it before making it available to members.</p><AdminCalculatorSettings settings={settings} action={saveCalculatorSettingsAction} /></main>;
}