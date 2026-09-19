import {
  normaliseHostname,
  selectDevelopmentTenantSlug,
} from "../src/lib/tenant-core";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(normaliseHostname("WWW.SWCU.FINANCE:443") === "www.swcu.finance", "Hostname normalisation failed");
assert(
  selectDevelopmentTenantSlug({
    hostname: "preview.example",
    nodeEnv: "development",
    developmentSlug: "swcu",
  }) === "swcu",
  "Development override failed",
);
assert(
  selectDevelopmentTenantSlug({
    hostname: "unknown.example",
    nodeEnv: "production",
    developmentSlug: "swcu",
  }) === undefined,
  "Production must ignore the development override",
);

console.info("Tenant resolution guardrail checks passed.");