import "server-only";

import { db } from "@/lib/db";
import type { EstablishmentFee, PayrollPeriod } from "@/lib/loan-estimate";

export const CALCULATOR_DEFAULTS = {
  isEnabled: false,
  monthlyInterestRatePercent: 1,
  weeklyEnabled: true,
  fortnightlyEnabled: true,
  monthlyEnabled: true,
  takeHomePayPercentage: 50,
  establishmentFeeType: "none" as const,
  establishmentFeeValue: null as number | null,
  establishmentFeeFinanced: false,
  minimumLoanAmount: null as number | null,
  maximumLoanAmount: null as number | null,
  minimumRepayments: null as number | null,
  maximumRepayments: null as number | null,
};

export async function getCalculatorSettings(tenantId: string) {
  const record = await db.calculatorSettings.findUnique({ where: { tenantId } });
  if (!record) return { ...CALCULATOR_DEFAULTS, id: null };
  return {
    id: record.id,
    isEnabled: record.isEnabled,
    monthlyInterestRatePercent: Number(record.monthlyInterestRate),
    weeklyEnabled: record.weeklyEnabled,
    fortnightlyEnabled: record.fortnightlyEnabled,
    monthlyEnabled: record.monthlyEnabled,
    takeHomePayPercentage: Number(record.takeHomePayPercentage),
    establishmentFeeType: record.establishmentFeeType.toLowerCase() as "none" | "fixed" | "percentage",
    establishmentFeeValue: record.establishmentFeeValue == null ? null : Number(record.establishmentFeeValue),
    establishmentFeeFinanced: record.establishmentFeeFinanced,
    minimumLoanAmount: record.minimumLoanAmount == null ? null : Number(record.minimumLoanAmount),
    maximumLoanAmount: record.maximumLoanAmount == null ? null : Number(record.maximumLoanAmount),
    minimumRepayments: record.minimumRepayments,
    maximumRepayments: record.maximumRepayments,
  };
}

export function enabledPayrollPeriods(settings: Awaited<ReturnType<typeof getCalculatorSettings>>): PayrollPeriod[] {
  return [
    settings.weeklyEnabled ? "weekly" : null,
    settings.fortnightlyEnabled ? "fortnightly" : null,
    settings.monthlyEnabled ? "monthly" : null,
  ].filter((period): period is PayrollPeriod => period !== null);
}

export function configuredFee(settings: Awaited<ReturnType<typeof getCalculatorSettings>>): EstablishmentFee {
  return {
    type: settings.establishmentFeeType,
    value: settings.establishmentFeeValue ?? undefined,
    financed: settings.establishmentFeeFinanced,
  };
}

export function scenarioLimitError(settings: Awaited<ReturnType<typeof getCalculatorSettings>>, amount: number, repayments: number): string | null {
  const amountOutsideRange =
    (settings.minimumLoanAmount != null && amount < settings.minimumLoanAmount)
    || (settings.maximumLoanAmount != null && amount > settings.maximumLoanAmount);
  const repaymentsOutsideRange =
    (settings.minimumRepayments != null && repayments < settings.minimumRepayments)
    || (settings.maximumRepayments != null && repayments > settings.maximumRepayments);
  return amountOutsideRange || repaymentsOutsideRange
    ? "The amount or number of repayments is outside the calculator’s available range."
    : null;
}

export function currentFijiCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Pacific/Fiji",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}