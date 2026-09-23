import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
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
  const tenant = await requireTenant(request.headers.get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid loan amount and number of repayments." }, { status: 400 });
  const settings = await getCalculatorSettings(tenant.id);
  const periods = enabledPayrollPeriods(settings);
  if (!periods.includes(parsed.data.payrollPeriod as PayrollPeriod)) return NextResponse.json({ error: "That payroll period is not enabled." }, { status: 400 });
  const limitError = scenarioLimitError(settings, parsed.data.amount, parsed.data.repayments);
  if (limitError) return NextResponse.json({ error: limitError }, { status: 400 });
  try {
    const estimate = calculateLoanEstimate({
      ...parsed.data,
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
    return NextResponse.json({ error: "Unable to calculate this test estimate. Check the details and try again." }, { status: 400 });
  }
}