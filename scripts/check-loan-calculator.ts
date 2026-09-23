import {
  addCalendarMonth,
  buildRepaymentDates,
  calculateLoanEstimate,
  daysInMonth,
  roundFinancial,
  simulateSchedule,
} from "../src/lib/loan-estimate";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function close(actual: number, expected: number, tolerance = 0.000001) {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}
function rejects(action: () => unknown, message: string) {
  try { action(); } catch { return; }
  throw new Error(message);
}
const base = { amount: 1000, payrollPeriod: "weekly" as const, repayments: 12, startDate: "2024-01-01", monthlyRate: 0.01 };

// 1–4: actual Gregorian month lengths, including leap years.
assert(daysInMonth(2024, 1) === 31, "31-day month failed");
assert(daysInMonth(2024, 4) === 30, "30-day month failed");
assert(daysInMonth(2023, 2) === 28, "February 28-day handling failed");
assert(daysInMonth(2024, 2) === 29, "February 29-day handling failed");

// 5–8: payroll intervals and safe calendar-month advancement.
assert(buildRepaymentDates("2024-01-01", "weekly", 2)[1] === "2024-01-15", "Weekly interval failed");
assert(buildRepaymentDates("2024-01-01", "fortnightly", 2)[1] === "2024-01-29", "Fortnightly interval failed");
assert(buildRepaymentDates("2024-01-15", "monthly", 2)[1] === "2024-03-15", "Monthly interval failed");
assert(addCalendarMonth("2024-01-31") === "2024-02-29", "Month-end rollover failed");
assert(buildRepaymentDates("2024-01-31", "monthly", 2)[1] === "2024-03-31", "Monthly schedule did not retain its original calendar-day anchor");

// 9–12: daily reducing-balance interest and month-end posting.
const daily = simulateSchedule(100, "2024-01-01", "weekly", 1, 0, 0.01);
close(daily.balance, 100 * (1 + (8 * 0.01) / 31), 0.000001);
const february = simulateSchedule(100, "2024-02-01", "monthly", 1, 0, 0.01);
close(february.balance, 101 + 101 * 0.01 / 31, 0.000001);
const payment = simulateSchedule(100, "2024-01-01", "weekly", 1, 50, 0.01);
assert(payment.balance < daily.balance, "Payments must reduce balance");
const monthEnd = simulateSchedule(100, "2024-01-25", "weekly", 2, 0, 0.01);
assert(monthEnd.balance > 100.01, "Month-end accumulated interest was not applied");

// 13–14: monotonicity.
const fewer = calculateLoanEstimate(base);
const more = calculateLoanEstimate({ ...base, repayments: 24 });
assert(more.regularRepayment < fewer.regularRepayment, "More repayments should reduce regular repayment");
assert(calculateLoanEstimate({ ...base, amount: 2000 }).regularRepayment > fewer.regularRepayment, "Larger loan should increase repayment");

// 15–17: establishment fee financing behavior.
const fixed = calculateLoanEstimate({ ...base, repayments: 24, fee: { type: "fixed", value: 100, financed: true } });
const plain = calculateLoanEstimate({ ...base, repayments: 24 });
const percentage = calculateLoanEstimate({ ...base, repayments: 24, fee: { type: "percentage", value: 10, financed: true } });
const notFinanced = calculateLoanEstimate({ ...base, repayments: 24, fee: { type: "fixed", value: 100, financed: false } });
assert(fixed.financedAmount === 1100 && fixed.regularRepayment > plain.regularRepayment, "Fixed financed fee failed");
assert(percentage.financedAmount === 1100 && percentage.regularRepayment > plain.regularRepayment, "Percentage financed fee failed");
assert(notFinanced.financedAmount === plain.financedAmount && notFinanced.regularRepayment === plain.regularRepayment, "Non-financed fee changed repayment");

// 18–19: public rounding and invalid input rejection.
assert(roundFinancial(153.476) === 153.48, "Financial half-up rounding failed");
assert(roundFinancial(1.005) === 1.01, "Half-cent rounding failed at 1.005");
assert(roundFinancial(10.075) === 10.08, "Half-cent rounding failed at 10.075");
assert(Number.isInteger(fewer.regularRepayment * 100), "Estimate was not rounded to two decimals");
for (const invalid of [
  { ...base, amount: 0 },
  { ...base, amount: -1 },
  { ...base, amount: Number.NaN },
  { ...base, repayments: 0 },
  { ...base, repayments: 1.5 },
  { ...base, payrollPeriod: "daily" as never },
]) rejects(() => calculateLoanEstimate(invalid), "Invalid input was accepted");

console.info("Loan calculator engine checks passed (19 requirement groups).");