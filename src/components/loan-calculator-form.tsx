"use client";

import { FormEvent, useState } from "react";
import type { PayrollPeriod } from "@/lib/loan-estimate";

const labels: Record<PayrollPeriod, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

interface LoanCalculatorFormProps {
  endpoint: string;
  periods: readonly PayrollPeriod[];
  buttonLabel: string;
  admin?: boolean;
}

export function LoanCalculatorForm({ endpoint, periods, buttonLabel, admin = false }: LoanCalculatorFormProps) {
  const [amount, setAmount] = useState("");
  const [repayments, setRepayments] = useState("");
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod>(periods[0] ?? "fortnightly");
  const [result, setResult] = useState<{ estimatedRepayment: number; payrollPeriod: PayrollPeriod } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount, payrollPeriod, repayments }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to calculate the estimate.");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to calculate the estimate.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={calculate}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold">Loan amount
        <span className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-charcoal/55">FJD $</span><input required inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-deep-navy/15 bg-white pl-[4.6rem] pr-4 outline-none focus:border-swcu-blue" /></span>
      </label>
      <label className="grid gap-2 text-sm font-semibold">Payroll period
        <select required value={payrollPeriod} onChange={(event) => setPayrollPeriod(event.target.value as PayrollPeriod)} className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4">
          {periods.map((period) => <option key={period} value={period}>{labels[period]}</option>)}
        </select>
      </label>
    </div>
    <label className="mt-4 grid gap-2 text-sm font-semibold">Number of repayments
      <input required inputMode="numeric" autoComplete="off" value={repayments} onChange={(event) => setRepayments(event.target.value.replace(/\D/g, ""))} placeholder="Enter number" className="min-h-12 rounded-xl border border-deep-navy/15 bg-white px-4 outline-none focus:border-swcu-blue" />
      <span className={`font-normal ${admin ? "text-charcoal/65" : "text-charcoal/65"}`}>Enter the number of payroll deductions you expect to make.</span>
    </label>
    <button type="submit" disabled={pending || periods.length === 0} className="mt-5 min-h-12 w-full rounded-xl bg-swcu-blue px-5 font-bold text-white transition hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Calculating…" : buttonLabel}</button>
    {error && <p role="alert" className="mt-4 rounded-xl bg-swcu-red/10 p-4 text-sm font-semibold text-swcu-red">{error}</p>}
    {result && <div role="status" className={`mt-5 rounded-xl p-5 ${admin ? "bg-soft-blue-grey" : "bg-soft-blue-grey"}`}>
      <p className="text-sm font-bold uppercase tracking-[.06em] text-swcu-blue">Estimated repayment</p>
      <p className="mt-2 font-heading text-3xl font-bold text-deep-navy">FJD ${result.estimatedRepayment.toFixed(2)} <span className="text-lg font-semibold">{labels[result.payrollPeriod].toLowerCase()}</span></p>
    </div>}
  </form>;
}