import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { notifyContact, submitContactEnquiry } from "../src/lib/contact";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";

let assertions = 0;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SendGrid contact assertion failed: ${message}`);
  assertions += 1;
}

const contactSource = await readFile("src/lib/contact.ts", "utf8");
const envSource = await readFile("src/lib/env.ts", "utf8");
const envExample = await readFile(".env.example", "utf8");
const adminContactSource = await readFile("src/app/admin/contact/page.tsx", "utf8");

const transactionIndex = contactSource.indexOf("const submission = await db.$transaction");
const recipientLookupIndex = contactSource.indexOf("const settings = await db.contactSettings.findUnique");
const notificationIndex = contactSource.indexOf("dependencies.notify ?? notifyContact");
check(transactionIndex >= 0 && transactionIndex < recipientLookupIndex && recipientLookupIndex < notificationIndex, "enquiry and audit transaction completes before notification");
check(contactSource.includes("select: { notificationRecipients: true }"), "recipient list comes from contact settings");
check(contactSource.includes("reference: submission.reference") && contactSource.includes("subject: submission.subject"), "notification receives only persisted reference and subject");
check(envSource.includes("SENDGRID_API_KEY") && envSource.includes("SENDGRID_FROM_EMAIL") && envSource.includes("SENDGRID_FROM_NAME"), "SendGrid environment contract is validated");
check(envSource.includes('z.email().optional()'), "optional SendGrid sender email is validated when supplied");
for (const variable of ["SENDGRID_API_KEY=", "SENDGRID_FROM_EMAIL=", "SENDGRID_FROM_NAME="]) {
  check(envExample.includes(variable), `${variable.slice(0, -1)} is documented without a value`);
}
check(adminContactSource.includes("environment.SENDGRID_API_KEY") && adminContactSource.includes("environment.SENDGRID_FROM_EMAIL"), "Admin readiness uses SendGrid configuration");

const configuration = { apiKey: "test-provider-key", fromEmail: "website@swcu.finance", fromName: "SWCU Website" };
let requestUrl = "";
let requestAuthorization = "";
let requestBody = "";
const successFetch = (async (url, init) => {
  requestUrl = String(url);
  requestAuthorization = new Headers(init?.headers).get("authorization") ?? "";
  requestBody = String(init?.body ?? "");
  return new Response(null, { status: 202 });
}) as typeof fetch;

const sent = await notifyContact(
  { recipients: ["admin@example.com", "second@example.com"], reference: "SWCU-C-TEST", subject: "Membership" },
  { configuration, fetch: successFetch },
);
check(sent.status === "SENT", "2xx provider response reports sent");
check(requestUrl === "https://api.sendgrid.com/v3/mail/send", "request uses SendGrid mail endpoint");
check(requestAuthorization === "Bearer test-provider-key", "request uses bearer authorization");

const payload = JSON.parse(requestBody) as {
  personalizations: Array<{ to: Array<{ email: string }> }>;
  from: { email: string; name: string };
  subject: string;
  content: Array<{ type: string; value: string }>;
  reply_to?: unknown;
};
const text = payload.content[0]?.value ?? "";
check(payload.personalizations[0]?.to.map(({ email }) => email).join(",") === "admin@example.com,second@example.com", "request contains configured notification recipients");
check(payload.from.email === "website@swcu.finance" && payload.from.name === "SWCU Website", "request contains configured sender");
check(payload.subject === "SWCU enquiry SWCU-C-TEST", "request contains expected subject");
check(text === "New SWCU website enquiry received.\nReference: SWCU-C-TEST\nSubject: Membership\nLog in to the SWCU Admin portal to review.", "plain-text body contains only approved notification content");
check(!("reply_to" in payload), "request does not set member reply-to");
for (const sensitive of ["Member Name", "member@example.com", "6797000000", "private enquiry text", "192.0.2.10", "privacyAcknowledged"]) {
  check(!requestBody.includes(sensitive), `request excludes ${sensitive}`);
}

let skippedFetchCalled = false;
const skippedFetch = (async () => {
  skippedFetchCalled = true;
  return new Response(null, { status: 202 });
}) as typeof fetch;
check((await notifyContact({ recipients: [], reference: "SWCU-C-NONE", subject: "Other" }, { configuration, fetch: skippedFetch })).status === "SKIPPED_NO_RECIPIENT", "no recipients reports skipped");
check(!skippedFetchCalled, "no recipients does not call provider");
check((await notifyContact({ recipients: ["admin@example.com"], reference: "SWCU-C-NOCONFIG", subject: "Other" }, { configuration: {}, fetch: skippedFetch })).status === "SKIPPED_NO_PROVIDER", "missing provider configuration reports skipped");
check(!skippedFetchCalled, "missing provider configuration does not call provider");
check((await notifyContact({ recipients: ["admin@example.com"], reference: "SWCU-C-FAIL", subject: "Loans" }, { configuration, fetch: (async () => new Response(null, { status: 500 })) as typeof fetch })).status === "FAILED", "non-2xx provider response reports failed");
check((await notifyContact({ recipients: ["admin@example.com"], reference: "SWCU-C-ERROR", subject: "Savings" }, { configuration, fetch: (async () => { throw new Error("provider unavailable"); }) as typeof fetch })).status === "FAILED", "provider network error reports failed");

let defaultNameBody = "";
await notifyContact(
  { recipients: ["admin@example.com"], reference: "SWCU-C-DEFAULT", subject: "Other" },
  {
    configuration: { apiKey: "test-provider-key", fromEmail: "website@swcu.finance" },
    fetch: (async (_url, init) => {
      defaultNameBody = String(init?.body ?? "");
      return new Response(null, { status: 202 });
    }) as typeof fetch,
  },
);
check((JSON.parse(defaultNameBody) as { from: { name: string } }).from.name === "SWCU Website", "sender name defaults safely");

assertQaExecutionSafe();
const fixtureSuffix = Date.now().toString(36);
const fixtureSlug = `sendgrid-contact-${fixtureSuffix}`;
const fixtureIp = `sendgrid-contact-${fixtureSuffix}`;
const tenant = await db.tenant.create({ data: { slug: fixtureSlug, displayName: "SendGrid Contact QA" } });
try {
  await Promise.all([
    db.pageContent.create({
      data: {
        tenantId: tenant.id,
        slot: "PRIVACY",
        body: "QA privacy content.",
        isPublished: true,
        publishedAt: new Date(),
      },
    }),
    db.contactSettings.create({
      data: {
        tenantId: tenant.id,
        organisationName: "SendGrid Contact QA",
        streetAddress: "QA address",
        postalAddress: "QA postal address",
        telephone: "000",
        publicEmail: "public@example.com",
        notificationRecipients: ["admin@example.com"],
      },
    }),
  ]);
  let notificationAttempted = false;
  const result = await submitContactEnquiry(
    {
      tenant,
      ipAddress: fixtureIp,
      value: {
        name: "QA Member",
        email: "member@example.com",
        phone: "6797000000",
        subject: "Membership",
        message: "Private QA enquiry.",
        privacyAcknowledged: true,
        website: "",
      },
    },
    {
      notify: async ({ recipients, reference, subject }) => {
        notificationAttempted = true;
        const [persisted, audit] = await Promise.all([
          db.contactSubmission.findFirst({ where: { tenantId: tenant.id, reference } }),
          db.auditLog.findFirst({ where: { tenantId: tenant.id, action: "CONTACT_ENQUIRY_RECEIVED", targetId: reference } }),
        ]);
        check(Boolean(persisted), "enquiry is committed before notification attempt");
        check(Boolean(audit), "audit record is committed before notification attempt");
        check(recipients.join(",") === "admin@example.com", "notification recipients come from contact settings");
        return { status: "FAILED", message: `Reference: ${reference} Subject: ${subject}` };
      },
    },
  );
  check(notificationAttempted && result.notification.status === "FAILED", "provider failure is reported after persistence");
  check(Boolean(await db.contactSubmission.findFirst({ where: { tenantId: tenant.id, reference: result.reference } })), "provider failure leaves enquiry stored");
  const throwingIp = `${fixtureIp}-throw`;
  const throwingResult = await submitContactEnquiry(
    {
      tenant,
      ipAddress: throwingIp,
      value: {
        name: "Second QA Member",
        email: "second-member@example.com",
        phone: "",
        subject: "Savings",
        message: "Another private QA enquiry.",
        privacyAcknowledged: true,
        website: "",
      },
    },
    { notify: async () => { throw new Error("unexpected notifier failure"); } },
  );
  check(throwingResult.notification.status === "FAILED", "unexpected notifier exception is isolated as failed");
  const [throwingSubmission, throwingAudit] = await Promise.all([
    db.contactSubmission.findFirst({ where: { tenantId: tenant.id, reference: throwingResult.reference } }),
    db.auditLog.findFirst({ where: { tenantId: tenant.id, action: "CONTACT_ENQUIRY_RECEIVED", targetId: throwingResult.reference } }),
  ]);
  check(Boolean(throwingSubmission && throwingAudit), "unexpected notifier exception leaves enquiry and audit stored");
} finally {
  await db.auditLog.deleteMany({ where: { tenantId: tenant.id } });
  await db.contactSubmission.deleteMany({ where: { tenantId: tenant.id } });
  await db.contactRateLimit.deleteMany({ where: { tenantId: tenant.id } });
  await db.pageContent.deleteMany({ where: { tenantId: tenant.id } });
  await db.contactSettings.deleteMany({ where: { tenantId: tenant.id } });
  await db.tenant.delete({ where: { id: tenant.id } });
  await db.$disconnect();
}

console.info(JSON.stringify({ script: "check-sendgrid-contact", assertions }));