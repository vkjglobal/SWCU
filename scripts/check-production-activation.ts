import { readFile } from "node:fs/promises";
import {
  activationRequestMatchesCanonicalOrigin,
  activationSecretMatches,
  canonicalCredentialAccount,
  normalizedActivationIp,
} from "../src/lib/production-activation-guards";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const files = {
  service: await readFile("src/lib/production-admin-activation.ts", "utf8"),
  guards: await readFile("src/lib/production-activation-guards.ts", "utf8"),
  throttle: await readFile("src/lib/production-activation-throttle.ts", "utf8"),
  route: await readFile("src/app/api/admin/production-activation/route.ts", "utf8"),
  page: await readFile("src/app/admin/production-activation/page.tsx", "utf8"),
  form: await readFile("src/components/production-admin-activation-form.tsx", "utf8"),
  reset: await readFile("src/lib/staff-accounts.ts", "utf8"),
  proxy: await readFile("src/proxy.ts", "utf8"),
  env: await readFile("src/lib/env.ts", "utf8"),
};

check(files.service.includes('environment.NODE_ENV !== "production"'), "Activation must be production-only.");
check(files.service.includes("SWCU_PRODUCTION_ADMIN_ACTIVATION_SECRET"), "Activation must require the temporary environment secret.");
check(files.guards.includes("timingSafeEqual"), "Activation secret comparison must be timing-safe.");
check(files.guards.includes("isIP"), "Forwarded activation IPs must be validated.");
check(files.guards.includes("host === canonical.host.toLowerCase()"), "Activation must be restricted to the canonical production host.");
check(files.service.includes('"1CFu4jCYA21L2lSLumV90ZNwypivFKsb"'), "Activation must target the approved production user ID.");
check(files.service.includes('"buzzmefiji@gmail.com"'), "Activation must target the approved production email.");
check(files.service.includes("StaffRole.ADMINISTRATOR"), "Activation must require the Administrator role.");
check(files.service.includes("membership?.isActive"), "Activation must require an active membership.");
check(files.service.includes("if (credential?.password)"), "Activation must reject an already established password.");
check(files.service.includes('providerId: "credential"'), "Activation must create only the Better Auth credential account.");
check(files.service.includes("canonicalCredentialAccount"), "Activation must reject ambiguous or noncanonical credential accounts.");
check(files.service.includes("pg_advisory_xact_lock"), "Activation must serialize concurrent attempts.");
check(files.service.includes("prepareStaffPasswordReset"), "Activation must reuse the established reset-token preparation.");
check(files.service.includes("tx.verification.create"), "Activation must store the verification in the activation transaction.");
check(files.reset.includes('randomBytes(32).toString("hex")'), "Reset tokens must retain cryptographic randomness.");
check(files.reset.includes('createHash("sha256").update(rawToken).digest("hex")'), "Only the reset-token hash may be stored.");
check(files.reset.includes("60 * 60 * 1000"), "Reset token must retain the 60-minute expiry.");
check(files.reset.includes("timingSafeEqual"), "Reset completion must retain timing-safe token comparison.");
check(files.reset.includes("deleteUserSessions"), "Reset completion must continue clearing sessions.");
check(files.route.includes('method: "POST"') === false, "Server route must not proxy or log a secret-bearing URL.");
check(files.route.includes("request.json()"), "Activation secret must be accepted in the POST body.");
check(!files.route.includes("console."), "Activation endpoint must not log secrets or setup links.");
check(files.route.includes("productionActivationAllowed"), "Activation endpoint must be rate limited.");
check(files.throttle.includes("GLOBAL_THROTTLE_KEY"), "Activation must retain a global throttle that cannot be bypassed by rotating IP headers.");
check(files.route.includes('"Cache-Control": "no-store, max-age=0"'), "Activation response must not be cached.");
check(files.route.includes('"X-Robots-Tag": "noindex, nofollow, noarchive"'), "Activation response must not be indexed.");
check(files.route.includes('"Strict-Transport-Security"'), "Activation response must instruct browsers to retain HTTPS.");
check(files.page.includes('dynamic = "force-dynamic"'), "Activation page must evaluate availability at runtime.");
check(files.page.includes("notFound()"), "Unavailable activation page must fail closed.");
check(files.form.includes('method: "POST"'), "Browser must submit the activation secret by POST.");
check(files.form.includes('type="password"'), "Activation secret input must be concealed.");
check(files.form.includes('window.location.protocol !== "https:"'), "Browser must refuse to submit the secret over plaintext HTTP.");
check(!files.form.includes("?secret="), "Activation secret must never appear in a query string.");
check(files.proxy.includes('"/admin/production-activation"'), "Proxy must allow only the exact temporary page.");
check(files.env.includes("z.string().min(32).optional()"), "Temporary activation secret must require at least 32 characters.");

const expectedSecret = "correct-production-activation-secret";
check(activationSecretMatches(expectedSecret, expectedSecret), "Correct activation secret must match.");
check(!activationSecretMatches("incorrect-production-activation-secret", expectedSecret), "Incorrect activation secret must fail.");
check(normalizedActivationIp("203.0.113.9, 10.0.0.2") === "203.0.113.9", "Valid forwarded IPv4 must be normalized.");
check(normalizedActivationIp("2001:db8::1") === "2001:db8::1", "Valid forwarded IPv6 must be retained.");
check(normalizedActivationIp("x".repeat(128)) === "unknown", "Oversized or malformed forwarded IP must not reach storage.");
check(activationRequestMatchesCanonicalOrigin({
  canonicalUrl: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
  host: "nodejs-1672988-6683714.cloudwaysnodeapps.com",
  forwardedProto: "https",
  origin: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
}), "Canonical HTTPS production request must be accepted.");
check(!activationRequestMatchesCanonicalOrigin({
  canonicalUrl: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
  host: "example.invalid",
  forwardedProto: "https",
  origin: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
}), "An unapproved host must be rejected.");
check(!activationRequestMatchesCanonicalOrigin({
  canonicalUrl: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
  host: "nodejs-1672988-6683714.cloudwaysnodeapps.com",
  forwardedProto: "http",
  origin: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
}), "A non-HTTPS request must be rejected.");
check(!activationRequestMatchesCanonicalOrigin({
  canonicalUrl: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
  host: "nodejs-1672988-6683714.cloudwaysnodeapps.com",
  forwardedProto: "https",
  origin: "http://nodejs-1672988-6683714.cloudwaysnodeapps.com",
}), "A plaintext or conflicting browser origin must be rejected.");
check(!activationRequestMatchesCanonicalOrigin({
  canonicalUrl: "https://nodejs-1672988-6683714.cloudwaysnodeapps.com",
  host: "nodejs-1672988-6683714.cloudwaysnodeapps.com",
  forwardedProto: "https",
  origin: null,
}), "Activation POST requests without a browser origin must be rejected.");
check(canonicalCredentialAccount([], "approved-user") === undefined, "Missing credential must be eligible for creation.");
check(canonicalCredentialAccount([{ accountId: "approved-user", password: null }], "approved-user")?.password === null, "Canonical passwordless credential must be eligible.");
let duplicateCredentialsRejected = false;
try {
  canonicalCredentialAccount([
    { accountId: "approved-user", password: null },
    { accountId: "approved-user", password: "existing-hash" },
  ], "approved-user");
} catch {
  duplicateCredentialsRejected = true;
}
check(duplicateCredentialsRejected, "Duplicate credentials must be rejected.");
let noncanonicalCredentialRejected = false;
try {
  canonicalCredentialAccount([{ accountId: "another-user", password: null }], "approved-user");
} catch {
  noncanonicalCredentialRejected = true;
}
check(noncanonicalCredentialRejected, "Noncanonical credential must be rejected.");

console.info("Production Administrator activation checks passed.");