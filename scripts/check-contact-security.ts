import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { db } from "../src/lib/db";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";
import { ContactError, submitContactEnquiry } from "../src/lib/contact";
import { contactOriginAllowed, contactRequestHost, contactSourceAddress, readContactJson } from "../src/lib/contact-request";
import { resolveTurnstileConfiguration, verifyContactTurnstile } from "../src/lib/turnstile";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Contact security assertion failed: ${message}`);
  assertions++;
}
async function rejects(action: () => Promise<unknown>, message: string, status?: number) {
  try {
    await action();
  } catch (error) {
    if (status !== undefined) assert(error instanceof ContactError && error.status === status, `${message} status`);
    assertions++;
    return;
  }
  throw new Error(`Contact security assertion failed: ${message}`);
}

const token = "qa-turnstile-token";
const validInput = {
  name: "QA Contact",
  email: "qa-contact@example.invalid",
  phone: "6797000000",
  subject: "General Enquiry",
  message: "A safe test enquiry.",
  privacyAcknowledged: true,
  website: "",
  turnstileToken: token,
} as const;

async function main() {
  assertQaExecutionSafe();
  const previousSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const previousSecretKey = process.env.TURNSTILE_SECRET_KEY;
  const previousNodeEnv = process.env.NODE_ENV;
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const suffix = Date.now().toString(36);
  const slug = `contact-security-${suffix}`;
  const hostname = `contact-security-${suffix}.qa.invalid`;
  let tenantId: string | undefined;
  let failure: unknown;
  const cleanupErrors: string[] = [];
  try {
    const tenant = await db.tenant.create({ data: { slug, displayName: "Contact Security QA Fixture" } });
    tenantId = tenant.id;
    await db.tenantDomain.create({ data: { tenantId: tenant.id, hostname, isPrimary: true } });
    await db.pageContent.create({ data: { tenantId: tenant.id, slot: "PRIVACY", body: "QA privacy notice", isPublished: true, publishedAt: new Date() } });

    // The test exercises the injected verifier; these are deliberately synthetic, non-production settings.
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "qa-test-site-key";
    process.env.TURNSTILE_SECRET_KEY = "qa-test-secret-key";
    mutableEnvironment.NODE_ENV = "test";

    let notifications = 0;
    let verifierCalls = 0;
    const accepted = await submitContactEnquiry(
      { tenant, value: validInput, ipAddress: "192.0.2.41", hostname },
      {
        verifyTurnstile: async (receivedToken, receivedHostname, configuration) => {
          verifierCalls++;
          assert(receivedToken === token && receivedHostname === hostname, "verifier receives submitted token and hostname");
          assert(configuration.siteKey === "qa-test-site-key", "verifier receives configured settings");
          return true;
        },
        notify: async ({ reference }) => {
          notifications++;
          const [saved, audit] = await Promise.all([
            db.contactSubmission.findFirst({ where: { tenantId: tenant.id, reference } }),
            db.auditLog.findFirst({ where: { tenantId: tenant.id, targetId: reference, action: "CONTACT_ENQUIRY_RECEIVED" } }),
          ]);
          assert(Boolean(saved && audit), "submission and receipt audit persist before notification");
          return { status: "SENT", message: `Reference ${reference}` };
        },
      },
    );
    assert(Boolean(accepted.reference) && accepted.notification.status === "SENT", "valid contact accepted and notification outcome returned");
    assert(verifierCalls === 1 && notifications === 1, "valid contact verifies and notifies once");

    const saved = await db.contactSubmission.findFirstOrThrow({ where: { tenantId: tenant.id, reference: accepted.reference } });
    const auditCount = () => db.auditLog.count({ where: { tenantId: tenant.id, action: "CONTACT_ENQUIRY_RECEIVED" } });
    const submissionCount = () => db.contactSubmission.count({ where: { tenantId: tenant.id } });
    const initialSubmissionCount = await submissionCount();
    const initialAuditCount = await auditCount();
    assert(saved.reference === accepted.reference, "accepted fixture submission exists");

    const rejectedInput = { ...validInput, email: "rejected@example.invalid" };
    const verifyNo = async () => false;
    await rejects(() => submitContactEnquiry(
      { tenant, value: rejectedInput, ipAddress: "192.0.2.42", hostname },
      { verifyTurnstile: verifyNo, notify: async () => { notifications++; return { status: "SENT", message: "" }; } },
    ), "invalid verification is rejected", 400);
    await rejects(() => submitContactEnquiry(
      { tenant, value: { ...rejectedInput, turnstileToken: "" }, ipAddress: "192.0.2.43", hostname },
      { verifyTurnstile: async () => { verifierCalls++; return true; } },
    ), "missing token rejected before verification");
    let replayAccepted = true;
    const replayVerifier = async () => {
      if (replayAccepted) { replayAccepted = false; return true; }
      return false;
    };
    const replayInput = { ...validInput, email: "replay@example.invalid" };
    await submitContactEnquiry({ tenant, value: replayInput, ipAddress: "192.0.2.44", hostname }, { verifyTurnstile: replayVerifier, notify: async () => ({ status: "SENT", message: "" }) });
    await rejects(() => submitContactEnquiry({ tenant, value: replayInput, ipAddress: "192.0.2.44", hostname }, { verifyTurnstile: replayVerifier, notify: async () => { notifications++; return { status: "SENT", message: "" }; } }), "replayed token rejected", 400);
    assert(await submissionCount() === initialSubmissionCount + 1 && await auditCount() === initialAuditCount + 1, "invalid, missing and replayed verification create no submission or audit");
    assert(notifications === 1, "rejected verification never notifies");

    await rejects(() => submitContactEnquiry({ tenant, value: { ...validInput, website: "bot" }, ipAddress: "192.0.2.45", hostname }, { verifyTurnstile: async () => true }), "honeypot rejected");
    await rejects(() => submitContactEnquiry({ tenant, value: { ...validInput, email: "not-an-email" }, ipAddress: "192.0.2.46", hostname }, { verifyTurnstile: async () => true }), "invalid email rejected");
    await rejects(() => submitContactEnquiry({ tenant, value: { ...validInput, name: 15 } as never, ipAddress: "192.0.2.47", hostname }, { verifyTurnstile: async () => true }), "invalid field type rejected");
    await rejects(() => submitContactEnquiry({ tenant, value: { ...validInput, message: "x".repeat(4001) }, ipAddress: "192.0.2.48", hostname }, { verifyTurnstile: async () => true }), "overlength message rejected");
    assert(await submissionCount() === initialSubmissionCount + 1, "invalid form data does not persist");

    const xss = `<img src=x onerror="alert(1)">'; DROP TABLE contacts; --`;
    const inert = await submitContactEnquiry(
      { tenant, value: { ...validInput, name: xss, email: "inert@example.invalid", message: xss }, ipAddress: "192.0.2.49", hostname },
      { verifyTurnstile: async () => true, notify: async () => ({ status: "SENT", message: "" }) },
    );
    const inertStored = await db.contactSubmission.findFirstOrThrow({ where: { tenantId: tenant.id, reference: inert.reference } });
    assert(inertStored.name === xss && inertStored.message === xss, "XSS and SQL-like content is stored inertly as text");
    const renderText = (text: string) => execFileSync(process.execPath, [
      "-e",
      'const {renderToStaticMarkup}=require("react-dom/server");const {createElement}=require("react");process.stdout.write(renderToStaticMarkup(createElement("p",null,process.argv[1])))',
      text,
    ], { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } });
    const rendered = renderText(inertStored.message);
    assert(rendered.includes("&lt;img") && rendered.includes("&#x27;") && !rendered.includes("<img"), "React HTML rendering escapes stored user content");
    for (const [index, payload] of ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "' OR 1=1 --"].entries()) {
      const result = await submitContactEnquiry(
        { tenant, value: { ...validInput, email: `attack-${index}@example.invalid`, message: payload }, ipAddress: `192.0.2.${50 + index}`, hostname },
        { verifyTurnstile: async () => true, notify: async () => ({ status: "SKIPPED_NO_RECIPIENT", message: "" }) },
      );
      const stored = await db.contactSubmission.findFirstOrThrow({ where: { tenantId: tenant.id, reference: result.reference } });
      assert(stored.message === payload, "script-looking or SQL-like input remains ordinary stored data");
      const html = renderText(stored.message);
      assert(!html.includes("<script") && !html.includes("<img") && (payload.startsWith("<") ? html.includes("&lt;") : html.includes("&#x27;")), "stored visitor payload renders as inert React text");
    }

    const limitedIp = "192.0.2.99";
    for (let index = 0; index < 5; index++) {
      await submitContactEnquiry(
        { tenant, value: { ...validInput, email: `limit-${index}@example.invalid` }, ipAddress: limitedIp, hostname },
        { verifyTurnstile: async () => true, notify: async () => ({ status: "SENT", message: "" }) },
      );
    }
    await rejects(() => submitContactEnquiry(
      { tenant, value: { ...validInput, email: "limit-6@example.invalid" }, ipAddress: limitedIp, hostname },
      { verifyTurnstile: async () => true },
    ), "sixth attempt is rate limited", 429);
    const rateRows = await db.contactRateLimit.findMany({ where: { tenantId: tenant.id, ipAddress: null } });
    assert(rateRows.some((row) => row.attempts >= 5 && row.key.startsWith(`${tenant.id}:`)), "rate limit persists only hashed tenant-scoped key and null IP");
    for (let index = 0; index < 6; index++) {
      await submitContactEnquiry(
        { tenant, value: { ...validInput, email: `no-source-${index}@example.invalid` }, ipAddress: "", hostname },
        { verifyTurnstile: async () => true, notify: async () => ({ status: "SKIPPED_NO_RECIPIENT", message: "" }) },
      );
    }
    assert(!(await db.contactRateLimit.findMany({ where: { tenantId: tenant.id } })).some((row) => row.key.includes("unknown")), "missing trusted IP never creates a shared rate-limit bucket");

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "";
    process.env.TURNSTILE_SECRET_KEY = "";
    await rejects(() => submitContactEnquiry({ tenant, value: validInput, ipAddress: "192.0.2.100", hostname }, { verifyTurnstile: async () => true }), "missing configuration fails closed", 503);
    const publicTestSite = "1x00000000000000000000AA";
    const publicTestSecret = "1x0000AA"; // Representative test-key pattern, not a credential.
    assert(resolveTurnstileConfiguration({ siteKey: publicTestSite, secretKey: publicTestSecret }, true) === null, "public Turnstile test keys rejected in production");
    assert(resolveTurnstileConfiguration({ siteKey: "production-site", secretKey: publicTestSecret }, true) === null, "public test secret rejected in production");
    assert(resolveTurnstileConfiguration({ siteKey: publicTestSite, secretKey: "production-secret" }, true) === null, "public test site key rejected in production");
    assert(resolveTurnstileConfiguration({ siteKey: publicTestSite, secretKey: publicTestSecret }, false)?.siteKey === publicTestSite, "test-key pattern remains permitted outside production");
    const liveConfig = { siteKey: "production-site", secretKey: "example-not-a-credential" };
    const siteverify = (result: unknown) => (async (url: string | URL | Request, options?: RequestInit) => {
      assert(String(url).includes("/siteverify") && options?.method === "POST" && options.body instanceof URLSearchParams && options.body.get("response") === token, "siteverify sends the token via POST");
      return Response.json(result);
    }) as typeof fetch;
    assert(await verifyContactTurnstile(token, "www.swcu.finance", liveConfig, siteverify({ success: true, hostname: "www.swcu.finance", action: "contact" })), "valid production siteverify response accepted");
    for (const invalid of [
      { success: false, hostname: "www.swcu.finance", action: "contact" },
      { success: true, hostname: "other.invalid", action: "contact" },
      { success: true, hostname: "www.swcu.finance", action: "login" },
      { success: true, hostname: "www.swcu.finance" },
    ]) {
      assert(!(await verifyContactTurnstile(token, "www.swcu.finance", liveConfig, siteverify(invalid))), "failed, wrong-host or wrong-action verification rejected");
    }
    assert(!(await verifyContactTurnstile(token, "www.swcu.finance", liveConfig, (async () => { throw new Error("network unavailable"); }) as typeof fetch)), "siteverify network failure rejects");

    assert(contactOriginAllowed(new Headers({ host: "example.test", origin: "https://example.test" })), "matching origin is permitted");
    assert(!contactOriginAllowed(new Headers({ host: "example.test", origin: "https://attacker.test" })), "cross-origin request is rejected");
    assert(contactOriginAllowed(new Headers({ host: "example.test" })), "missing origin remains allowed for non-browser clients");
    const environment = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    assert(contactSourceAddress(new Headers({ "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2" }), environment) === "", "untrusted proxy source headers are ignored without a shared limit bucket");
    assert(contactRequestHost(new Headers({ host: "www.swcu.finance", "x-forwarded-host": "attacker.invalid" }), environment) === null, "untrusted forwarded host cannot choose a different tenant or verification hostname");
    assert(contactSourceAddress(new Headers({ "x-forwarded-for": "192.0.2.10, 198.51.100.3" }), { ...environment, CONTACT_TRUST_PROXY: "true" }) === "198.51.100.3", "trusted source uses validated last proxy hop");
    assert(contactSourceAddress(new Headers({ "cf-ray": "test", "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "198.51.100.3" }), { ...environment, CONTACT_TRUST_PROXY: "true" }) === "198.51.100.4", "trusted Cloudflare source header is validated");
    const parsedBody = await readContactJson(new Request("https://example.test/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...validInput }) }));
    assert(Boolean(parsedBody && typeof parsedBody === "object"), "JSON body helper reads valid JSON");
    await rejects(() => readContactJson(new Request("https://example.test/api/contact", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })), "JSON helper rejects non-JSON content type");
    await rejects(() => readContactJson(new Request("https://example.test/api/contact", { method: "POST", headers: { "content-type": "application/json", "content-length": "20000" }, body: "{}" })), "JSON helper rejects declared oversized body");

    const memberRequestsSource = await readFile("src/app/admin/member-requests/[id]/page.tsx", "utf8");
    const contactEnquirySource = await readFile("src/app/admin/contact-enquiries/[id]/page.tsx", "utf8");
    assert(memberRequestsSource.includes("requireStaffMembership(tenant, [\"ADMINISTRATOR\"])") && memberRequestsSource.includes("{fieldValue(field.value)}") && memberRequestsSource.includes("{response.message}") && memberRequestsSource.includes("{request.memberMessage") && memberRequestsSource.includes("{attachment.name}"), "member-request messages, form values and attachment filenames render as React text");
    assert(contactEnquirySource.includes("requireStaffMembership(tenant, [\"ADMINISTRATOR\"])") && contactEnquirySource.includes("openContactEnquiry({ tenant") && contactEnquirySource.includes("{enquiry.message}"), "contact source/sink requires administrator, audited opener and React text sink");
    console.info(JSON.stringify({ script: "check-contact-security", assertions }));
  } catch (error) {
    failure = error;
  } finally {
    if (previousSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previousSiteKey;
    if (previousSecretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = previousSecretKey;
    if (previousNodeEnv === undefined) delete mutableEnvironment.NODE_ENV; else mutableEnvironment.NODE_ENV = previousNodeEnv;
    const attempt = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
    };
    if (tenantId) {
      await attempt("contact submissions", () => db.contactSubmission.deleteMany({ where: { tenantId } }));
      await attempt("contact rate limits", () => db.contactRateLimit.deleteMany({ where: { tenantId } }));
      await attempt("audit events", () => db.auditLog.deleteMany({ where: { tenantId } }));
      await attempt("privacy page", () => db.pageContent.deleteMany({ where: { tenantId, slot: "PRIVACY" } }));
      await attempt("contact settings", () => db.contactSettings.deleteMany({ where: { tenantId } }));
      await attempt("domain", () => db.tenantDomain.deleteMany({ where: { tenantId } }));
      await attempt("fixture tenant", () => db.tenant.delete({ where: { id: tenantId } }));
    }
  }
  if (failure) {
    if (cleanupErrors.length) console.error(JSON.stringify({ cleanupErrors }));
    throw failure;
  }
  if (cleanupErrors.length) throw new Error(`Contact security cleanup failed: ${cleanupErrors.join("; ")}`);
}

main().finally(() => db.$disconnect());