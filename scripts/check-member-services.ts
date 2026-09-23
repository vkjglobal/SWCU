import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { findExactMemberServiceForm, MEMBER_SERVICE_FORM_TITLES } from "../src/lib/member-service-forms";

let assertions = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  assertions += 1;
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" }, select: { id: true } });
  const pages = await db.pageContent.findMany({
    where: {
      tenantId: tenant.id,
      slot: { in: ["MEMBERSHIP_INTRO", "SAVINGS_INTRO", "LOANS_INTRO", "RETIREMENT_INTRO", "DEATH_BENEFIT_INTRO"] },
      isPublished: true,
    },
    select: { slot: true, body: true },
  });
  const body = (slot: string) => pages.find((page) => page.slot === slot)?.body ?? "";

  for (const required of [
    "Please contact SWCU to confirm your eligibility before applying.",
    "Entrance fee: $1",
    "$8 per week",
    "$16 per fortnight",
    "Salary deduction is compulsory",
    "recent salary slip",
    "photo identification",
    "TIN/FNPF details",
    "employer confirmation letter",
    "witness signature",
    "FPSA branch in Lautoka",
    "FPSA branch in Labasa",
  ]) check(body("MEMBERSHIP_INTRO").includes(required), `Membership includes ${required}`);

  check(body("SAVINGS_INTRO").includes("Regular savings are a core SWCU member service"), "Savings uses confirmed wording");
  for (const required of ["at least 3 months", "provident or productive", "Tuesday at 4.30 pm", "Wednesday", "Thursday", "repayment ability", "income or salary", "member’s account position"]) {
    check(body("LOANS_INTRO").includes(required), `Loans includes ${required}`);
  }
  for (const required of ["all registered SWCU members", "retirement", "resignation or leaving", "death", "continue SWCU membership after retirement"]) {
    check(body("RETIREMENT_INTRO").includes(required), `Retirement Savings includes ${required}`);
  }
  for (const required of ["normal SWCU membership conditions", "maximum of $5,000", "cleared or written off", "no separate contribution or fee", "Subject to SWCU rules and claim requirements"]) {
    check(body("DEATH_BENEFIT_INTRO").includes(required), `Death Benefit includes ${required}`);
  }

  const publicCopy = pages.map((page) => page.body).join("\n");
  for (const forbidden of ["$20 per month", "1% monthly", "immediate family", "qualifying share", "membership share"]) {
    check(!publicCopy.includes(forbidden), `Public service copy withholds ${forbidden}`);
  }

  const settings = await db.tenantSettings.findUniqueOrThrow({
    where: { tenantId: tenant.id },
    select: { retirementMinimumContribution: true },
  });
  check(settings.retirementMinimumContribution === null, "Retirement minimum contribution remains blank");

  const calculator = await db.calculatorSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { isEnabled: true, status: true, weeklyEnabled: true, fortnightlyEnabled: true, monthlyEnabled: true },
  });
  check(calculator?.isEnabled === true && calculator.status === "CONFIGURED", "Calculator remains configured and enabled for DEV/UAT");
  check(Boolean(calculator?.weeklyEnabled && calculator.fortnightlyEnabled && calculator.monthlyEnabled), "Calculator retains all confirmed payroll periods");

  const forms = await db.formDocument.findMany({
    where: { tenantId: tenant.id, isEnabled: true, isAnnualReport: false, mediaAsset: { retiredAt: null } },
    select: { title: true, mediaAssetId: true },
  });
  for (const title of Object.values(MEMBER_SERVICE_FORM_TITLES)) {
    const expected = forms.find((form) => form.title === title);
    const selected = findExactMemberServiceForm(forms, title);
    check(Boolean(expected?.mediaAssetId), `${title} remains downloadable`);
    check(selected?.mediaAssetId === expected?.mediaAssetId, `${title} resolves to its exact media asset`);
  }

  const collisionForms = [
    { title: MEMBER_SERVICE_FORM_TITLES.loan, mediaAssetId: "exact-loan" },
    { title: "Loan Information Form", mediaAssetId: "other-loan" },
    { title: "Membership Enquiry", mediaAssetId: "other-membership" },
  ];
  check(findExactMemberServiceForm(collisionForms, MEMBER_SERVICE_FORM_TITLES.loan)?.mediaAssetId === "exact-loan", "Similar titles cannot replace the exact loan form");
  check(findExactMemberServiceForm(collisionForms, MEMBER_SERVICE_FORM_TITLES.membership) === null, "Similar titles cannot replace the exact membership form");
  check(findExactMemberServiceForm([...collisionForms, { title: MEMBER_SERVICE_FORM_TITLES.loan, mediaAssetId: "duplicate-loan" }], MEMBER_SERVICE_FORM_TITLES.loan) === null, "Duplicate exact titles fail closed");

  const pageSource = readFileSync("src/app/(public)/membership-services/page.tsx", "utf8");
  const adminSource = readFileSync("src/app/admin/page-content/page.tsx", "utf8");
  check(pageSource.includes("retirementMinimum &&"), "Blank minimum contribution is omitted publicly");
  check(adminSource.includes("Leave blank until SWCU confirms the current minimum contribution."), "Admin explains the optional minimum");
  for (const key of ["membership", "fullWithdrawal", "partialWithdrawal", "loan", "deathBenefit"]) {
    check(pageSource.includes(`MEMBER_SERVICE_FORM_TITLES.${key}`), `Public page uses the canonical ${key} form title`);
  }

  console.info(JSON.stringify({ script: "check-member-services", assertions }));
}

main().finally(() => db.$disconnect());