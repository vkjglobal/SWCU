import fs from "node:fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260923143000_loan_calculator_settings/migration.sql");
const adminAction = read("src/app/admin/actions.ts");
const adminPage = read("src/app/admin/calculator/page.tsx");
const publicRoute = read("src/app/api/calculator/estimate/route.ts");
const adminRoute = read("src/app/api/admin/calculator/estimate/route.ts");
const publicPage = read("src/app/(public)/page.tsx");
const homeData = read("src/lib/home-data.ts");
const publicForm = read("src/components/loan-calculator-form.tsx");
const homeExperience = read("src/components/home-experience.tsx");
const adminSettings = read("src/components/admin-calculator-settings.tsx");
const availability = read("src/components/calculator-availability.tsx");

// 20: missing/new settings are safely OFF and the public endpoint refuses calculation while OFF.
assert(/isEnabled Boolean @default\(false\)/.test(schema), "Calculator schema default is not OFF");
assert(/if \(!settings\.isEnabled\).*Calculator unavailable/.test(publicRoute), "Public endpoint does not fail closed while calculator is OFF");
assert(/enabled: data\.calculatorSettings\?\.isEnabled \?\? false/.test(publicPage), "Missing public settings do not default OFF");

// 21 and 25: availability and settings are resolved through the request tenant only.
assert(/resolveTenant\(request\.headers\.get\("host"\)/.test(publicRoute), "Public calculation does not resolve the trusted request host");
assert(!/x-forwarded-host/.test(publicRoute + adminRoute), "Calculator routes trust a client-controlled forwarded host");
assert(/where: \{ tenantId: tenant\.id \}/.test(homeData), "Homepage calculator settings are not tenant scoped");
assert(/tenantId String @unique/.test(schema), "Calculator settings are not one-per-tenant");
assert(/tenantId String @unique/.test(schema), "Calculator settings do not preserve tenant uniqueness");

// 22: the browser receives only scenario/result fields, never the private rate or fee configuration.
assert(/estimatedRepayment: estimate\.regularRepayment[\s\S]*payrollPeriod: estimate\.payrollPeriod[\s\S]*repayments: estimate\.repayments/.test(publicRoute), "Public response does not use the approved minimal result shape");
for (const source of [publicPage, publicForm, homeExperience]) {
  assert(!/monthlyInterestRate|monthlyRate|takeHomePayPercentage|establishmentFee(Value|Type|Financed)/.test(source), "Private calculator settings are exposed in public client/page code");
}

// 23–24: both settings mutation and preview are enforced server-side for administrators.
assert(/saveCalculatorSettingsAction\(form: FormData\)[\s\S]*staff\(\["ADMINISTRATOR"\]\)/.test(adminAction), "Calculator settings action is not administrator-only");
assert(/requireStaffMembership\(tenant, \["ADMINISTRATOR"\]\)/.test(adminPage), "Calculator settings page is not administrator-only");
assert(/requireStaffMembership\(tenant, \["ADMINISTRATOR"\]\)/.test(adminRoute), "Admin test calculator endpoint is not administrator-only");
assert(!/staff\(\["EDITOR"\]\)/.test(adminAction.slice(adminAction.indexOf("saveCalculatorSettingsAction"), adminAction.indexOf("saveLeadershipAction"))), "Editor access was added to calculator settings");

assert(/changeMetadata:[\s\S]*before:[\s\S]*after:/.test(adminAction.slice(adminAction.indexOf("saveCalculatorSettingsAction"), adminAction.indexOf("saveLeadershipAction"))), "Calculator changes are not meaningfully audit logged");
const availabilityAction = adminAction.slice(adminAction.indexOf("setCalculatorAvailabilityAction"), adminAction.indexOf("saveCalculatorSettingsAction"));
const settingsAction = adminAction.slice(adminAction.indexOf("saveCalculatorSettingsAction"), adminAction.indexOf("saveLeadershipAction"));
assert(/staff\(\["ADMINISTRATOR"\]\)/.test(availabilityAction), "Availability action is not Administrator-only");
assert(/z\.boolean\(\)\.parse\(desired\)/.test(availabilityAction), "Availability mutation must receive an explicit boolean");
assert(/where: \{ tenantId: tenant\.id \}/.test(availabilityAction), "Availability mutation is not tenant scoped");
assert(/update: \{ isEnabled: enabled \}/.test(availabilityAction), "Availability must update only the ON/OFF field");
assert(/changeMetadata: \{ before: before\?\.isEnabled \?\? false, after: record\.isEnabled \}/.test(availabilityAction), "Availability change must audit old and new states");
assert(/revalidatePath\("\/admin\/calculator"\)/.test(availabilityAction) && /revalidatePath\("\/"\)/.test(availabilityAction), "Availability change must invalidate Admin and public pages");
assert(!/\bisEnabled\b/.test(settingsAction.slice(0, settingsAction.indexOf("const record = await db.$transaction"))), "Main settings save must not overwrite availability");
assert(!/name="isEnabled"/.test(adminSettings), "Availability switch must not be submitted with the settings form");
assert(/action\(desired\)/.test(availability) && /setEnabled\(result\.enabled\)/.test(availability), "Switch must use the server-confirmed persisted value");
assert(/setEnabled\(persisted\)/.test(availability) && /router\.refresh\(\)/.test(availability), "Switch must recover from errors using persisted state");
assert(/PERCENTAGE[\s\S]*establishmentFeeValue > 100/.test(adminAction.slice(adminAction.indexOf("saveCalculatorSettingsAction"), adminAction.indexOf("saveLeadershipAction"))), "Percentage fee validation does not prevent unusable configuration");
assert(!/minimumLoanAmount\.toFixed|maximumLoanAmount\.toFixed|Enter at least \$\{settings\.minimumRepayments/.test(publicRoute), "Public API exposes configured limit values");
assert(/scenarioLimitError\(settings/.test(publicRoute) && /scenarioLimitError\(settings/.test(adminRoute), "Public and Admin preview do not share scenario limit validation");
assert(/ADD COLUMN IF NOT EXISTS/.test(migration) && !/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i.test(migration), "Calculator migration is not purely additive");

console.info("Loan calculator integration guards passed (OFF/ON, public exposure, authorization, tenant isolation, audit, migration).");