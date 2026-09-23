import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/lib/tenant";
import { calculateLoanEstimate, type PayrollPeriod } from "@/lib/loan-estimate";
import { configuredFee, currentFijiCalendarDate, enabledPayrollPeriods, getCalculatorSettings, scenarioLimitError } from "@/lib/calculator-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000_000),
  payrollPeriod: z.enum(["weekly", "fortnightly", "monthly"]),
  repayments: z.coerce.number().int().positive().max(1200),
});

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const tenant = await resolveTenant(request.headers.get("host") ?? "");
  if (!tenant) return NextResponse.json({ error: "Calculator unavailable." }, { status: 404 });
  const settings = await getCalculatorSettings(tenant.id);
  if (!settings.isEnabled) return NextResponse.json({ error: "Calculator unavailable." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter valid calculator details." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid loan amount and number of repayments." }, { status: 400 });
  const { amount, payrollPeriod, repayments } = parsed.data;
  const periods = enabledPayrollPeriods(settings);
  if (!periods.includes(payrollPeriod as PayrollPeriod)) return NextResponse.json({ error: "That payroll period is not available." }, { status: 400 });
  const limitError = scenarioLimitError(settings, amount, repayments);
  if (limitError) return NextResponse.json({ error: limitError }, { status: 400 });
  try {
    const estimate = calculateLoanEstimate({
      amount,
      payrollPeriod,
      repayments,
      startDate: currentFijiCalendarDate(),
      monthlyRate: settings.monthlyInterestRatePercent / 100,
      enabledPeriods: periods,
      fee: configuredFee(settings),
    });
    return NextResponse.json({
      estimatedRepayment: estimate.regularRepayment,
      payrollPeriod: estimate.payrollPeriod,
      repayments: estimate.repayments,
    });
  } catch {
    return NextResponse.json({ error: "Unable to calculate this estimate. Check the details and try again." }, { status: 400 });
  }
}