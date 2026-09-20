import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db";

let assertions = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Release correction assertion failed: ${message}`);
  assertions++;
}
async function source(path: string) { return readFile(path, "utf8"); }
function count(text: string, value: string) { return text.split(value).length - 1; }

async function main() {
  const contact = await source("src/app/(public)/contact/page.tsx");
  for (const forbidden of ["<iframe", "google.com", "maps.google", "Mapbox", "mapbox", "OpenStreetMap", "openstreetmap", "tile.openstreetmap", "mapboxgl", "leaflet", "Get Directions", "directionsUrl"]) {
    assert(!contact.includes(forbidden), `Contact source must not contain ${forbidden}`);
  }
  assert(contact.includes("300 Waimanu Road, Suva, Fiji"), "placeholder has exact address");
  assert(contact.includes("/api/media/") && contact.includes('alt="Map showing the SWCU office at 300 Waimanu Road, Suva"'), "map image uses media route and exact alt");

  const adminContact = await source("src/app/admin/contact/page.tsx");
  const adminActions = await source("src/app/admin/actions.ts");
  for (const label of ["Upload map", "Replace map", "Remove map", "Preview"]) assert(adminContact.includes(label), `Contact Map admin UI has ${label}`);
  for (const action of ["uploadContactMap", "replaceContactMap", "removeContactMap"]) {
    const body = adminActions.slice(adminActions.indexOf(`export async function ${action}`), adminActions.indexOf("\n}", adminActions.indexOf(`export async function ${action}`)) + 2);
    assert(body.includes('staff(["ADMINISTRATOR"])'), `${action} requires Administrator`);
  }
  assert(adminContact.includes('name="expectedMediaId"'), "dedicated Contact Map forms carry generation");
  assert(adminActions.includes("expectedMediaId") && adminActions.includes("removeContactMapGeneration({ tenant, actorUserId: userId, expectedMediaId })"), "dedicated actions validate generation");
  const adminMedia = await source("src/app/admin/media/page.tsx");
  assert(adminMedia.includes('purpose: { not: "contact-map" }'), "generic media library excludes Contact Map assets");
  const publicData = await source("src/lib/public-data.ts");
  const mediaRoute = await source("src/app/api/media/[id]/route.ts");
  const mediaService = await source("src/lib/media-service.ts");
  for (const text of [publicData, mediaRoute, mediaService]) assert(text.includes("contactMap"), "media lifecycle recognizes Contact Map relation");
  assert(mediaService.includes('existing.purpose === "contact-map"'), "generic media mutations reject Contact Map assets");
  const workflow = await source("src/lib/cms-workflow.ts");
  assert(workflow.includes("Contact Map assets require the dedicated Contact Map workflow."), "generic CMS media workflow rejects Contact Map assets");

  const utility = await source("src/app/(public)/[utility]/page.tsx");
  const seed = await source("prisma/seed.ts");
  const disclaimer = "Repayment figures are estimates only. Actual repayments, terms and loan approval are subject to SWCU requirements and approval.";
  const security = "SWCU will never ask you to disclose your password, PIN or security/verification code by email, phone, chat or through an unsolicited link. If you are unsure, contact SWCU using the contact details published on this website.";
  assert(utility.includes('getPublishedPageContent(tenant, ["IMPORTANT_INFORMATION"])'), "Important Information reads published PageContent");
  assert(!utility.includes("getCalculatorSettings"), "Important Information does not render CalculatorSettings fallback");
  assert(!utility.includes("Stay safe when dealing with SWCU"), "Important Information has no unapproved hero wording");
  assert(!utility.includes("Please take care when sharing personal or security information."), "Important Information has no unapproved explanatory wording");
  assert(utility.includes('title={approved.heading || "Important Information"}'), "Important Information uses only its neutral published heading");
  assert(utility.includes("<Content body={approved.body}/>"), "Important Information renders locked body without a duplicate section heading");
  assert(count(seed, disclaimer) === 1 && count(seed, security) === 1, "seed contains each locked text exactly once");
  assert(count(utility, disclaimer) === 0 && count(utility, security) === 0, "utility does not hard-code locked text");
  const footer = await source("src/app/(public)/_components.tsx");
  assert(footer.includes('href="/important-information"'), "footer Important Information link exists");
  assert(utility.includes('isPublished: true') || publicData.includes('isPublished: true'), "utility publication is published-only");
  assert(!utility.includes("isPublished: false"), "utility does not expose drafts");
  assert(footer.includes('published.privacy') && footer.includes('published.terms') && footer.includes('published.accessibility') && footer.includes("published.importantInformation"), "all utility footer links are publication-gated");

  const adminPageContent = await source("src/app/admin/page-content/page.tsx");
  const utilityIndex = await source("src/app/admin/utility-pages/page.tsx");
  const utilityDetail = await source("src/app/admin/utility-pages/[slug]/page.tsx");
  const utilityDefinitions = await source("src/lib/utility-pages.ts");
  const adminDrafts = await source("src/app/admin/drafts/page.tsx");
  const cmsWorkflow = await source("src/lib/cms-workflow.ts");
  const bootstrapAdmin = await source("scripts/bootstrap-admin.ts");
  const proxy = await source("src/proxy.ts");
  const staffResetForm = await source("src/components/staff-reset-form.tsx");
  assert(adminPageContent.includes("PAGE_CONTENT_SLOTS.filter((slot) => !isUtilityPageSlot(slot))"), "generic page content excludes utility slots");
  assert(adminActions.includes("isUtilityPageSlot(slot)") && adminActions.includes("Only Administrators may manage utility pages."), "utility draft action is Administrator-only");
  assert(cmsWorkflow.includes("Only Administrators may manage utility pages."), "CMS workflow blocks Editor utility drafts");
  assert(utilityIndex.includes('requireStaffMembership(tenant, ["ADMINISTRATOR"])'), "utility page index is Administrator-only");
  assert(utilityDetail.includes('requireStaffMembership(tenant, ["ADMINISTRATOR"])'), "utility page editor is Administrator-only");
  for (const label of ["Privacy", "Terms of Use", "Accessibility", "Important Information"]) {
    assert(utilityDefinitions.includes(label), `utility admin area supports ${label}`);
  }
  assert(utilityDetail.includes("definition.label"), "utility detail route renders each fixed page definition");
  assert(utilityDetail.includes("Current published content") && utilityDetail.includes("Saved draft"), "utility admin area previews published and draft content");
  assert(utilityDetail.includes("submitCmsDraft") && utilityDetail.includes("withdrawCmsDraft"), "utility admin area uses existing draft workflow");
  assert(utilityDetail.includes("const footerVisible = Boolean(published?.isPublished)"), "utility admin footer state follows publication state");
  assert(adminDrafts.includes("isUtilityPageSlot") && adminDrafts.includes("allDrafts.filter"), "Editor draft list excludes utility pages");
  assert(!bootstrapAdmin.includes("BOOTSTRAP_ADMIN_PASSWORD"), "Administrator bootstrap does not accept a plaintext setup password");
  assert(bootstrapAdmin.includes("initiateStaffPasswordReset") && bootstrapAdmin.includes("BOOTSTRAP_ADMIN_OUTPUT_FILE"), "Administrator bootstrap uses the one-time reset flow and protected output");
  assert(proxy.includes('request.nextUrl.pathname !== "/admin/reset-password"'), "one-time password setup route remains available without an existing session");
  assert(staffResetForm.includes('useRef(\"\")') && staffResetForm.includes("retainedToken.current = fragmentToken") && staffResetForm.includes("history.replaceState"), "password setup retains the URL fragment across strict-mode effect replay");

  const quickActions = footer.slice(footer.indexOf("export function MobileQuickActions"), footer.indexOf("export function InnerHero"));
  assert(quickActions.indexOf("<span>Join</span>") < quickActions.indexOf("<span>Login</span>") && quickActions.indexOf("<span>Login</span>") < quickActions.indexOf("<span>Call</span>"), "mobile actions order is Join, Login, Call");
  assert(quickActions.includes('href="/membership-services#membership"') && quickActions.includes('href="/member-login"') && quickActions.includes("href={`tel:${phone}`}"), "mobile action links are correct");

  const schema = await source("prisma/schema.prisma");
  assert(schema.includes("contactMapMediaAssetId String? @unique") && schema.includes("contactMapSettings ContactSettings?") && schema.includes('relation("ContactMapMedia")'), "schema has unique singular Contact Map relation");
  const migration = await source("prisma/migrations/20260919110000_contact_map_media_slot/migration.sql");
  assert(migration.includes("contactMapMediaAssetId") && !migration.includes("contactMapMediaAssetId_idx"), "migration has only unique map lookup index");
  const tenantCount = await db.tenant.count();
  assert(tenantCount >= 0, "read-only database check completed");
  console.info(JSON.stringify({ script: "check-release-corrections", assertions }));
}

main().finally(() => db.$disconnect());