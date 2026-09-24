"use client";

import { useState } from "react";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";
import { CalculatorAvailability } from "@/components/calculator-availability";
import { LoanCalculatorForm } from "@/components/loan-calculator-form";
import type { getCalculatorSettings } from "@/lib/calculator-settings";

type Settings = Awaited<ReturnType<typeof getCalculatorSettings>>;

export function AdminCalculatorSettings({
  settings, action, availabilityAction,
}: {
  settings: Settings;
  action: (formData: FormData) => Promise<unknown>;
  availabilityAction: (desired: boolean) => Promise<{ enabled: boolean; saved: boolean }>;
}) {
  const [feeType, setFeeType] = useState(settings.establishmentFeeType.toUpperCase());
  const periods = [
    settings.weeklyEnabled ? "weekly" as const : null,
    settings.fortnightlyEnabled ? "fortnightly" as const : null,
    settings.monthlyEnabled ? "monthly" as const : null,
  ].filter((period): period is "weekly" | "fortnightly" | "monthly" => period !== null);
  const field = "min-h-12 w-full min-w-0 rounded-xl border border-deep-navy/15 bg-white px-4";
  const card = "min-w-0 rounded-2xl border border-deep-navy/10 bg-white p-4 shadow-sm sm:p-5";

  return <div className="mt-5 grid gap-4">
    <CalculatorAvailability enabled={settings.isEnabled} action={availabilityAction} />

    <AdminActionForm action={action} successMessage="Calculator settings saved." className="grid gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-heading text-2xl font-bold text-deep-navy">Loan calculation</h2>
          <label className="mt-4 grid max-w-sm gap-1.5 font-semibold">Interest rate
            <span className="flex min-w-0"><input required name="monthlyInterestRate" type="number" min="0.0001" max="100" step="0.0001" defaultValue={settings.monthlyInterestRatePercent.toFixed(2)} className={`${field} rounded-r-none`} /><span className="flex shrink-0 items-center rounded-r-xl border border-l-0 border-deep-navy/15 bg-soft-blue-grey px-3 text-sm">% per month</span></span>
            <span className="text-sm font-normal leading-5 text-charcoal/65">Used only for the website estimate. This rate is not shown to members.</span>
          </label>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">{[
            ["Calculation method", "Reducing balance", "Interest is calculated on the remaining loan balance."],
            ["Interest calculation", "Calculated daily", "Interest is calculated for each actual calendar day."],
            ["Interest added", "At the end of each calendar month", "The calculator uses the actual number of days in each calendar month."],
          ].map(([label, value, help]) => <div key={label} className="min-w-0 rounded-xl bg-soft-blue-grey p-3"><p className="text-xs font-bold text-swcu-blue">{label}</p><p className="mt-1 font-semibold leading-5 text-deep-navy">{value}</p><p className="mt-1 text-xs leading-4 text-charcoal/65">{help}</p></div>)}</div>
        </section>

        <section className={card}>
          <h2 className="font-heading text-2xl font-bold text-deep-navy">Repayment options</h2>
          <p className="mt-1 text-sm text-charcoal/65">Enable at least one payroll period for the calculator.</p>
          <fieldset className="mt-4"><legend className="font-semibold">Payroll periods</legend><div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">{[
            ["weeklyEnabled", "Weekly", settings.weeklyEnabled],
            ["fortnightlyEnabled", "Fortnightly", settings.fortnightlyEnabled],
            ["monthlyEnabled", "Monthly", settings.monthlyEnabled],
          ].map(([name, label, checked]) => <label key={String(name)} className="flex min-h-11 items-center gap-2"><input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} className="size-5 accent-swcu-blue" />{label}</label>)}</div></fieldset>
          <label className="mt-4 grid max-w-sm gap-1.5 font-semibold">Take-home-pay rule
            <span className="flex min-w-0"><input required name="takeHomePayPercentage" type="number" min="0.01" max="100" step="0.01" defaultValue={settings.takeHomePayPercentage} className={`${field} rounded-r-none`} /><span className="flex shrink-0 items-center rounded-r-xl border border-l-0 border-deep-navy/15 bg-soft-blue-grey px-4">%</span></span>
            <span className="text-sm font-normal leading-5 text-charcoal/65">SWCU uses this rule when assessing repayment eligibility. The public calculator does not test a member’s salary or approval eligibility.</span>
          </label>
        </section>
      </div>

      <section className={card}>
        <h2 className="font-heading text-2xl font-bold text-deep-navy">Fees and limits</h2>
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
          <div className="min-w-0">
            <label className="grid max-w-sm gap-1.5 font-semibold">Establishment fee
              <select name="establishmentFeeType" value={feeType} onChange={(event) => setFeeType(event.target.value)} className={field}><option value="NONE">None</option><option value="FIXED">Fixed amount</option><option value="PERCENTAGE">Percentage</option></select>
            </label>
            {feeType !== "NONE" && <label className="mt-3 grid max-w-sm gap-1.5 font-semibold">{feeType === "FIXED" ? "Fee amount" : "Fee percentage"}
              <span className="flex min-w-0"><span className="flex shrink-0 items-center rounded-l-xl border border-r-0 border-deep-navy/15 bg-soft-blue-grey px-3">{feeType === "FIXED" ? "FJD $" : "%"}</span><input required name="establishmentFeeValue" type="number" min="0.01" max={feeType === "PERCENTAGE" ? "100" : "1000000000"} step="0.01" defaultValue={settings.establishmentFeeValue ?? ""} className={`${field} rounded-l-none`} /></span>
            </label>}
            <label className={`mt-3 flex min-h-11 items-center gap-3 font-semibold ${feeType === "NONE" ? "text-charcoal/45" : ""}`}><input type="checkbox" name="establishmentFeeFinanced" defaultChecked={settings.establishmentFeeFinanced} disabled={feeType === "NONE"} className="size-5 shrink-0 accent-swcu-blue" />Include establishment fee in the amount being repaid</label>
            <p className="text-sm leading-5 text-charcoal/65">When Yes, the fee is added to the loan amount used for the repayment estimate.</p>
          </div>
          <div className="min-w-0 lg:border-l lg:border-deep-navy/10 lg:pl-8">
            <h3 className="font-heading text-xl font-bold text-deep-navy">Optional limits</h3>
            <p className="mt-1 text-sm text-charcoal/65">Leave blank if SWCU does not want to set a calculator limit.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["minimumLoanAmount", "Minimum loan amount", settings.minimumLoanAmount, "0.01"],
                ["maximumLoanAmount", "Maximum loan amount", settings.maximumLoanAmount, "0.01"],
                ["minimumRepayments", "Minimum number of repayments", settings.minimumRepayments, "1"],
                ["maximumRepayments", "Maximum number of repayments", settings.maximumRepayments, "1"],
              ].map(([name, label, value, step]) => <label key={String(name)} className="grid min-w-0 gap-1.5 text-sm font-semibold">{label}<input name={String(name)} type="number" min={String(step)} max={String(name).includes("Repayments") ? "1200" : "1000000000"} step={String(step)} defaultValue={value ?? ""} className={field} /></label>)}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-soft-blue-grey px-3 py-2 text-sm"><span className="font-semibold text-deep-navy">Repayment rounding: 2 decimal places</span><span className="ml-2 text-charcoal/65">Example: $153.476 is shown as $153.48.</span></div>
      </section>
      <AdminSubmitButton pendingLabel="Saving settings…" className="min-h-12 w-fit rounded-xl bg-swcu-blue px-6 font-bold text-white">Save calculator settings</AdminSubmitButton>
    </AdminActionForm>

    <section className={card}>
      <h2 className="font-heading text-2xl font-bold text-deep-navy">Test Calculator</h2>
      <p className="mt-1 text-charcoal/70">Check an estimate before showing the calculator to members.</p>
      <div className="mt-4"><LoanCalculatorForm endpoint="/api/admin/calculator/estimate" periods={periods} buttonLabel="Calculate test estimate" admin /></div>
    </section>
  </div>;
}