import "server-only";

export type PayrollPeriod = "weekly" | "fortnightly" | "monthly";
export type EstablishmentFeeType = "none" | "fixed" | "percentage";

export interface EstablishmentFee {
  type: EstablishmentFeeType;
  value?: number;
  financed?: boolean;
}

export interface LoanEstimateInput {
  amount: number;
  payrollPeriod: PayrollPeriod;
  repayments: number;
  startDate: string;
  monthlyRate: number;
  enabledPeriods?: readonly PayrollPeriod[];
  fee?: EstablishmentFee;
}

export interface LoanEstimate {
  requestedAmount: number;
  financedAmount: number;
  feeAmount: number;
  regularRepayment: number;
  payrollPeriod: PayrollPeriod;
  repayments: number;
  firstRepaymentDate: string;
  finalRepaymentDate: string;
}

export interface ScheduleResult {
  balance: number;
  interestAccrued: number;
  dates: string[];
}

const MAX_AMOUNT = 1_000_000_000;
const MAX_REPAYMENTS = 1_200;
const MAX_RATE = 1;
const EPSILON = 0.00000001;

function fail(message: string): never {
  throw new Error(message);
}

function assertFinitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) fail(`${label} must be a positive finite number.`);
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("Date must use YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail("Date is not a valid Gregorian calendar date.");
  }
  return date;
}

export function formatCalendarDate(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) fail("Invalid calendar month.");
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(date: string, days: number): string {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return formatCalendarDate(result);
}

export function addCalendarMonth(date: string): string {
  const current = parseDate(date);
  const targetYear = current.getUTCFullYear() + (current.getUTCMonth() === 11 ? 1 : 0);
  const targetMonth = (current.getUTCMonth() + 1) % 12;
  const day = Math.min(current.getUTCDate(), daysInMonth(targetYear, targetMonth + 1));
  return formatCalendarDate(new Date(Date.UTC(targetYear, targetMonth, day)));
}

export function buildRepaymentDates(startDate: string, payrollPeriod: PayrollPeriod, repayments: number): string[] {
  parseDate(startDate);
  if (!["weekly", "fortnightly", "monthly"].includes(payrollPeriod)) fail("Payroll period is invalid.");
  if (!Number.isInteger(repayments) || repayments < 1 || repayments > MAX_REPAYMENTS) fail("Number of repayments is invalid.");
  const dates: string[] = [];
  for (let index = 0; index < repayments; index += 1) {
    const date = payrollPeriod === "weekly"
      ? addDays(startDate, 7 * (index + 1))
      : payrollPeriod === "fortnightly"
        ? addDays(startDate, 14 * (index + 1))
        : addCalendarMonths(startDate, index + 1);
    dates.push(date);
  }
  return dates;
}

export function addCalendarMonths(date: string, months: number): string {
  if (!Number.isInteger(months) || months < 0) fail("Calendar month increment is invalid.");
  const current = parseDate(date);
  const absoluteMonth = current.getUTCFullYear() * 12 + current.getUTCMonth() + months;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12;
  const day = Math.min(current.getUTCDate(), daysInMonth(targetYear, targetMonth + 1));
  return formatCalendarDate(new Date(Date.UTC(targetYear, targetMonth, day)));
}

function validateFee(fee: EstablishmentFee | undefined, amount: number) {
  const selected = fee ?? { type: "none" as const };
  if (!["none", "fixed", "percentage"].includes(selected.type)) fail("Establishment fee type is invalid.");
  if (selected.type === "none") return 0;
  assertFinitePositive(selected.value ?? 0, "Establishment fee");
  if (selected.type === "percentage" && (selected.value! > 100 || selected.value! / 100 > MAX_RATE)) fail("Establishment fee percentage is invalid.");
  const result = selected.type === "fixed" ? selected.value! : amount * selected.value! / 100;
  if (!Number.isFinite(result) || result < 0 || result > MAX_AMOUNT) fail("Establishment fee is invalid.");
  return result;
}

export function financedAmount(amount: number, fee?: EstablishmentFee): { feeAmount: number; financedAmount: number } {
  assertFinitePositive(amount, "Loan amount");
  if (amount > MAX_AMOUNT) fail("Loan amount is too large.");
  const feeAmount = validateFee(fee, amount);
  const financed = fee?.financed ? amount + feeAmount : amount;
  if (!Number.isFinite(financed) || financed > MAX_AMOUNT + feeAmount) fail("Financed amount is invalid.");
  return { feeAmount, financedAmount: financed };
}

function validateInput(input: LoanEstimateInput) {
  assertFinitePositive(input.amount, "Loan amount");
  if (input.amount > MAX_AMOUNT) fail("Loan amount is too large.");
  assertFinitePositive(input.monthlyRate, "Monthly interest rate");
  if (input.monthlyRate > MAX_RATE) fail("Monthly interest rate is too large.");
  if (!Number.isInteger(input.repayments) || input.repayments < 1 || input.repayments > MAX_REPAYMENTS) fail("Number of repayments is invalid.");
  parseDate(input.startDate);
  if (!["weekly", "fortnightly", "monthly"].includes(input.payrollPeriod)) fail("Payroll period is invalid.");
  if (input.enabledPeriods && !input.enabledPeriods.includes(input.payrollPeriod)) fail("Selected payroll period is not enabled.");
}

/** Simulates daily reducing-balance interest. Repayment is applied before that day's interest. */
export function simulateSchedule(
  principal: number,
  startDate: string,
  payrollPeriod: PayrollPeriod,
  repayments: number,
  regularRepayment: number,
  monthlyRate: number,
): ScheduleResult {
  assertFinitePositive(principal, "Principal");
  assertFinitePositive(monthlyRate, "Monthly interest rate");
  const dates = buildRepaymentDates(startDate, payrollPeriod, repayments);
  const paymentDates = new Set(dates);
  const finalDate = dates[dates.length - 1];
  let date = startDate;
  let balance = principal;
  let interestAccrued = 0;
  while (date <= finalDate) {
    if (paymentDates.has(date)) balance -= regularRepayment;
    const current = parseDate(date);
    const dailyRate = monthlyRate / daysInMonth(current.getUTCFullYear(), current.getUTCMonth() + 1);
    interestAccrued += Math.max(balance, 0) * dailyRate;
    if (current.getUTCDate() === daysInMonth(current.getUTCFullYear(), current.getUTCMonth() + 1)) {
      balance += interestAccrued;
      interestAccrued = 0;
    }
    if (date === finalDate) break;
    date = addDays(date, 1);
  }
  // Interest accrued in a partial final month remains owed even before month-end posting.
  balance += interestAccrued;
  return { balance, interestAccrued: 0, dates };
}

function solveRepayment(principal: number, input: LoanEstimateInput, dates: string[]): number {
  const finalDate = dates[dates.length - 1];
  const noInterest = simulateSchedule(principal, input.startDate, input.payrollPeriod, input.repayments, 0, input.monthlyRate).balance;
  let low = 0;
  let high = Math.max(principal / input.repayments, noInterest);
  while (simulateSchedule(principal, input.startDate, input.payrollPeriod, input.repayments, high, input.monthlyRate).balance > EPSILON && high < MAX_AMOUNT) high *= 2;
  if (high >= MAX_AMOUNT && simulateSchedule(principal, input.startDate, input.payrollPeriod, input.repayments, high, input.monthlyRate).balance > EPSILON) fail("Unable to solve the repayment estimate.");
  for (let iteration = 0; iteration < 90; iteration += 1) {
    const middle = (low + high) / 2;
    if (simulateSchedule(principal, input.startDate, input.payrollPeriod, input.repayments, middle, input.monthlyRate).balance > 0) low = middle;
    else high = middle;
  }
  void finalDate;
  return high;
}

export function roundFinancial(value: number): number {
  if (!Number.isFinite(value)) fail("Financial value is invalid.");
  const scaled = value * 100;
  const floatingPointTolerance = Number.EPSILON * Math.abs(scaled) * 4;
  return Math.floor(scaled + 0.5 + floatingPointTolerance) / 100;
}

export function calculateLoanEstimate(input: LoanEstimateInput): LoanEstimate {
  validateInput(input);
  const { feeAmount, financedAmount: principal } = financedAmount(input.amount, input.fee);
  const dates = buildRepaymentDates(input.startDate, input.payrollPeriod, input.repayments);
  return {
    requestedAmount: roundFinancial(input.amount),
    financedAmount: roundFinancial(principal),
    feeAmount: roundFinancial(feeAmount),
    regularRepayment: roundFinancial(solveRepayment(principal, input, dates)),
    payrollPeriod: input.payrollPeriod,
    repayments: input.repayments,
    firstRepaymentDate: dates[0],
    finalRepaymentDate: dates[dates.length - 1],
  };
}