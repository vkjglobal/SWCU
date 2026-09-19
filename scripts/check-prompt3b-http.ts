import { spawn } from "node:child_process";
import { request } from "node:http";
import net from "node:net";
import { db } from "../src/lib/db";
import { uploadMedia, uploadDocument } from "../src/lib/media-service";
import { deleteMediaObject } from "../src/lib/r2";
import { assertQaExecutionSafe } from "../src/lib/execution-safety";

let assertions = 0;
const suffix = Date.now().toString(36);
let fixtureHost = "";
function assert(ok: boolean, message: string) { if (!ok) throw new Error(`HTTP 3B assertion failed: ${message}`); assertions++; }
function http(port: number, path: string, method: string, host: string, body?: unknown) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const effectiveHost = host === "www.swcu.finance" && fixtureHost ? fixtureHost : host;
    const req = request({ hostname: "127.0.0.1", port, path, method, headers: { Host: effectiveHost, "x-forwarded-host": effectiveHost, "x-forwarded-for": `qa-http-${Date.now()}-${Math.random()}`, ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}) } }, (res) => {
      const chunks: Buffer[] = []; res.on("data", (chunk) => chunks.push(chunk)); res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); if (payload) req.write(payload); req.end();
  });
}
async function freePort() { return new Promise<number>((resolve) => { const s = net.createServer().listen(0, () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); }); }
async function waitReady(port: number) { for (let i = 0; i < 160; i++) { try { await http(port, "/", "GET", "www.swcu.finance"); return; } catch { await new Promise((r) => setTimeout(r, 250)); } } throw new Error("Next server did not become ready."); }

async function main() {
  assertQaExecutionSafe();
  const fixtureSlug = `prompt3b-http-fixture-${suffix}`;
  const fixtureHostname = `prompt3b-http-${suffix}.qa.invalid`;
  if (await db.tenant.findUnique({ where: { slug: fixtureSlug }, select: { id: true } })) throw new Error("Exact HTTP fixture slug already exists; refusing to mutate it.");
  if (await db.tenantDomain.findUnique({ where: { hostname: fixtureHostname }, select: { id: true } })) throw new Error("Exact HTTP fixture hostname already exists; refusing to mutate it.");
  let tenant: { id: string; slug: string; displayName: string } | undefined;
  let domainId: string | undefined;
  const actor = `prompt3b-http-admin-${suffix}`; const createdMedia: string[] = []; const objectKeys: string[] = []; const createdDocs: string[] = []; const createdRefs: string[] = []; const createdLeadership: string[] = []; let contactSettingsId: string | undefined; let child: ReturnType<typeof spawn> | undefined;
  let oldPrivacy: Awaited<ReturnType<typeof db.pageContent.findUnique>> = null;
  const configuredPort = process.env.PROMPT3B_HTTP_PORT ? Number(process.env.PROMPT3B_HTTP_PORT) : undefined;
  if (configuredPort !== undefined && (!Number.isInteger(configuredPort) || configuredPort <= 0)) throw new Error("PROMPT3B_HTTP_PORT must be a positive integer.");
  try {
    tenant = await db.tenant.create({ data: { slug: fixtureSlug, displayName: "Prompt 3B HTTP Fixture QA" } });
    if (!tenant) throw new Error("HTTP fixture tenant was not created.");
    const domain = await db.tenantDomain.create({ data: { tenantId: tenant.id, hostname: fixtureHostname, isPrimary: true } });
    domainId = domain.id;
    fixtureHost = domain.hostname;
    const port = configuredPort ?? await freePort();
    if (configuredPort === undefined) child = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(port)], { env: { ...process.env, NODE_OPTIONS: "" }, stdio: "ignore" });
    await waitReady(port);
    oldPrivacy = await db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: "PRIVACY" } } });
    const staleMedia = await db.mediaAsset.findMany({ where: { tenantId: tenant.id, altText: { in: ["HTTP QA PDF", "HTTP QA image"] } }, select: { id: true, objectKey: true } });
    const staleForms = await db.formDocument.count({ where: { tenantId: tenant.id, title: "HTTP QA Annual" } });
    const staleLeadership = await db.leadershipRecord.count({ where: { tenantId: tenant.id, name: "HTTP QA" } });
    const staleContacts = await db.contactSubmission.count({ where: { tenantId: tenant.id, email: "http@example.com" } });
    const staleActor = await db.user.findUnique({ where: { id: actor }, select: { id: true } });
    if (staleMedia.length || staleForms || staleLeadership || staleContacts || staleActor || oldPrivacy?.body === "HTTP QA privacy" || oldPrivacy?.body === "QA privacy") throw new Error("HTTP QA residue exists; clean it with check:qa-residue before rerunning.");
    await db.user.create({ data: { id: actor, email: `${actor}@qa.invalid`, name: "HTTP QA" } });
    await db.staffMembership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: actor } }, update: { role: "ADMINISTRATOR", isActive: true }, create: { tenantId: tenant.id, userId: actor, role: "ADMINISTRATOR" } });
    const contactSettings = await db.contactSettings.create({ data: { tenantId: tenant.id, organisationName: "HTTP QA", streetAddress: "300 Waimanu Road, Suva, Fiji", postalAddress: "QA", telephone: "6797000000", publicEmail: "http@example.com" } }); contactSettingsId = contactSettings.id;
    await db.pageContent.upsert({ where: { tenantId_slot: { tenantId: tenant.id, slot: "PRIVACY" } }, update: { body: "HTTP QA privacy", isPublished: true, publishedAt: new Date() }, create: { tenantId: tenant.id, slot: "PRIVACY", body: "HTTP QA privacy", isPublished: true, publishedAt: new Date() } });
    const pdf = await uploadDocument({ tenant, actorUserId: actor, file: new File([Buffer.from("%PDF-1.4 QA\n%%EOF")], "qa.pdf", { type: "application/pdf" }), altText: "HTTP QA PDF" });
    objectKeys.push(pdf.objectKey);
    const image = await uploadMedia({ tenant, actorUserId: actor, file: new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")], "qa.png", { type: "image/png" }), purpose: "general", altText: "HTTP QA image" });
    objectKeys.push(image.objectKey);
    createdMedia.push(pdf.id, image.id);
    const mapImage = await uploadMedia({ tenant, actorUserId: actor, file: new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")], "map.png", { type: "image/png" }), purpose: "contact-map", altText: "Map showing the SWCU office at 300 Waimanu Road, Suva" });
    objectKeys.push(mapImage.objectKey); createdMedia.push(mapImage.id);
    await db.contactSettings.update({ where: { id: contactSettings.id }, data: { contactMapMediaAssetId: mapImage.id } });
    const annual = await db.formDocument.create({ data: { tenantId: tenant.id, title: "HTTP QA Annual", category: "ANNUAL_REPORT", isAnnualReport: true, isEnabled: true, mediaAssetId: pdf.id } }); createdDocs.push(annual.id);
    const leader = await db.leadershipRecord.create({ data: { tenantId: tenant.id, name: "HTTP QA", title: "QA", group: "QA", isEnabled: true, isPublished: true, mediaAssetId: image.id } }); createdLeadership.push(leader.id);
    let response = await http(port, "/api/contact", "POST", "www.swcu.finance", { name: "HTTP Callback", email: "http@example.com", phone: "6797000000", subject: "Request a Call Back", message: "", privacyAcknowledged: true, website: "" }); const createdReference = JSON.parse(response.body).reference; if (createdReference) createdRefs.push(createdReference); assert(response.status === 201 && createdReference, `contact callback 201/reference status=${response.status} error=${JSON.parse(response.body).error ?? "none"}`);
    await db.pageContent.update({ where: { tenantId_slot: { tenantId: tenant.id, slot: "PRIVACY" } }, data: { isPublished: false } });
    response = await http(port, "/api/contact", "POST", "www.swcu.finance", { name: "HTTP Callback", email: "http@example.com", phone: "6797000000", subject: "Request a Call Back", message: "", privacyAcknowledged: true, website: "" }); assert(response.status === 400, "privacy-off contact rejection");
    await db.pageContent.update({ where: { tenantId_slot: { tenantId: tenant.id, slot: "PRIVACY" } }, data: { body: "HTTP QA privacy", isPublished: true, publishedAt: new Date() } });
    response = await http(port, "/api/contact", "POST", "www.swcu.finance", { name: "HTTP Invalid", email: "invalid", subject: "Membership", message: "hello", privacyAcknowledged: true, website: "" }); assert(response.status === 400, "invalid contact rejection");
    response = await http(port, "/api/contact", "POST", "www.swcu.finance", { name: "HTTP Bot", email: "http@example.com", subject: "Membership", message: "hello", privacyAcknowledged: true, website: "bot" }); assert(response.status === 400, "honeypot contact rejection");
    response = await http(port, `/api/media/${pdf.id}`, "GET", "www.swcu.finance"); assert(response.status === 404, "annual unapproved 404");
    await db.formDocument.update({ where: { id: annual.id }, data: { publicApprovedAt: new Date() } });
    response = await http(port, `/api/media/${pdf.id}`, "GET", "www.swcu.finance"); assert(response.status === 200 && response.headers["content-type"] === "application/pdf" && response.headers["x-content-type-options"] === "nosniff", "annual approved 200 headers");
    await db.formDocument.update({ where: { id: annual.id }, data: { publicApprovedAt: null } }); response = await http(port, `/api/media/${pdf.id}`, "GET", "www.swcu.finance"); assert(response.status === 404, "annual revoked 404");
    const otherDomain = await db.tenantDomain.findFirst({ where: { tenantId: { not: tenant.id }, isActive: true }, select: { hostname: true } });
    if (otherDomain) { response = await http(port, `/api/media/${pdf.id}`, "GET", otherDomain.hostname); assert(response.status === 404, "wrong tenant media 404"); }
    response = await http(port, `/api/media/${pdf.id}`, "GET", "unknown.invalid"); assert(response.status === 404, "unknown media host 404");
    await db.mediaAsset.update({ where: { id: pdf.id }, data: { retiredAt: new Date() } }); response = await http(port, `/api/media/${pdf.id}`, "GET", "www.swcu.finance"); assert(response.status === 404, "retired media 404");
    response = await http(port, `/api/media/${image.id}`, "GET", "www.swcu.finance"); assert(response.status === 200 && response.headers["content-type"] === "image/png", "published leadership image 200");
    response = await http(port, `/api/media/${mapImage.id}`, "GET", "www.swcu.finance"); assert(response.status === 200 && response.headers["content-type"] === "image/png", "Contact Map reference serves image 200");
    await db.contactSettings.update({ where: { id: contactSettings.id }, data: { contactMapMediaAssetId: null } });
    response = await http(port, `/api/media/${mapImage.id}`, "GET", "www.swcu.finance"); assert(response.status === 404, "Contact Map is unavailable after reference removal");
    await db.contactSettings.update({ where: { id: contactSettings.id }, data: { contactMapMediaAssetId: mapImage.id } });
    await db.mediaAsset.update({ where: { id: mapImage.id }, data: { retiredAt: new Date() } });
    response = await http(port, `/api/media/${mapImage.id}`, "GET", "www.swcu.finance"); assert(response.status === 404, "retired Contact Map is unavailable");
    response = await http(port, "/api/contact", "POST", "unknown.invalid", {}); assert(response.status === 404, `unknown contact host 404 (got ${response.status})`);
    console.info(JSON.stringify({ script: "check-prompt3b-http", assertions }));
    void leader;
  } finally {
    if (child) child.kill("SIGTERM");
    const cleanupErrors: string[] = [];
    const attempt = async (label: string, action: () => Promise<unknown>) => { try { await action(); } catch (error) { cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); } };
     const cleanupTenant = tenant;
     if (cleanupTenant) {
     await attempt("privacy restore", async () => { if (oldPrivacy) await db.pageContent.upsert({ where: { tenantId_slot: { tenantId: cleanupTenant.id, slot: "PRIVACY" } }, update: { body: oldPrivacy.body, heading: oldPrivacy.heading, isPublished: oldPrivacy.isPublished, publishedAt: oldPrivacy.publishedAt }, create: { tenantId: cleanupTenant.id, slot: "PRIVACY", body: oldPrivacy.body, heading: oldPrivacy.heading, isPublished: oldPrivacy.isPublished, publishedAt: oldPrivacy.publishedAt } }); else await db.pageContent.deleteMany({ where: { tenantId: cleanupTenant.id, slot: "PRIVACY" } }); });
    await attempt("forms", () => db.formDocument.deleteMany({ where: { id: { in: createdDocs } } }));
    await attempt("leadership", () => db.leadershipRecord.deleteMany({ where: { id: { in: createdLeadership } } }));
     await attempt("contact settings", () => contactSettingsId ? db.contactSettings.delete({ where: { id: contactSettingsId } }) : Promise.resolve());
     await attempt("contacts", () => createdRefs.length ? db.contactSubmission.deleteMany({ where: { tenantId: cleanupTenant.id, reference: { in: createdRefs } } }) : Promise.resolve());
    await attempt("R2 objects", async () => { for (const key of objectKeys) await deleteMediaObject(key); });
    await attempt("media rows", () => db.mediaAsset.deleteMany({ where: { id: { in: createdMedia } } }));
     await attempt("membership", () => db.staffMembership.deleteMany({ where: { tenantId: cleanupTenant.id, userId: actor } }));
      const fixtureAuditIds = await db.auditLog.findMany({ where: { tenantId: cleanupTenant.id }, select: { id: true } });
      const fixtureRateIds = await db.contactRateLimit.findMany({ where: { tenantId: cleanupTenant.id }, select: { id: true } });
      const fixturePageIds = await db.pageContent.findMany({ where: { tenantId: cleanupTenant.id }, select: { id: true } });
     await attempt("rate limits", () => fixtureRateIds.length ? db.contactRateLimit.deleteMany({ where: { id: { in: fixtureRateIds.map((row) => row.id) } } }) : Promise.resolve());
     await attempt("audits", () => fixtureAuditIds.length ? db.auditLog.deleteMany({ where: { id: { in: fixtureAuditIds.map((row) => row.id) } } }) : Promise.resolve());
     await attempt("privacy page", () => fixturePageIds.length ? db.pageContent.deleteMany({ where: { id: { in: fixturePageIds.map((row) => row.id) } } }) : Promise.resolve());
     await attempt("user", () => db.user.deleteMany({ where: { id: actor } }));
      await attempt("domain", () => domainId ? db.tenantDomain.delete({ where: { id: domainId } }) : Promise.resolve());
      await attempt("fixture tenant", () => db.tenant.delete({ where: { id: cleanupTenant.id } }));
     } else {
       await attempt("orphan actor", () => db.user.deleteMany({ where: { id: actor } }));
     }
    if (cleanupErrors.length) throw new Error(`HTTP cleanup failures: ${cleanupErrors.join("; ")}`);
  }
}
main().finally(() => db.$disconnect());