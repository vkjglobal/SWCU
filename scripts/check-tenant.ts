import {
  normaliseHostname,
  selectDevelopmentTenantSlug,
  selectTenantLookupHostname,
} from "../src/lib/tenant-core";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(normaliseHostname("WWW.SWCU.FINANCE:443") === "www.swcu.finance", "Hostname normalisation failed");
assert(
  selectTenantLookupHostname("nodejs-1672988-6683714.cloudwaysnodeapps.com") ===
    "www.swcu.finance",
  "Temporary Cloudways hostname must resolve through the primary SWCU domain",
);
assert(
  selectTenantLookupHostname("swcu.finance") === "swcu.finance" &&
    selectTenantLookupHostname("www.swcu.finance") === "www.swcu.finance",
  "Intended production hostnames must remain unchanged",
);
assert(
  selectTenantLookupHostname("unknown.cloudwaysnodeapps.com") ===
    "unknown.cloudwaysnodeapps.com",
  "Unknown Cloudways hostnames must remain unaliased",
);
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