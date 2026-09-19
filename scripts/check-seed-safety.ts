import { spawnSync } from "node:child_process";
import { db } from "../src/lib/db";

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Seed safety assertion failed: ${message}`);
  assertions += 1;
}

async function snapshot() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" } });
  const [home, highlights, services, faqs, heroes, notice, contact, pages] = await Promise.all([
    db.homeSettings.findUnique({ where: { tenantId: tenant.id } }),
    db.homeHighlight.findMany({ where: { tenantId: tenant.id }, orderBy: { id: "asc" } }),
    db.service.findMany({ where: { tenantId: tenant.id }, orderBy: { id: "asc" } }),
    db.fAQ.findMany({ where: { tenantId: tenant.id }, orderBy: { id: "asc" } }),
    db.homeHeroSlide.findMany({ where: { tenantId: tenant.id }, orderBy: { id: "asc" } }),
    db.siteNotice.findUnique({ where: { tenantId: tenant.id } }),
    db.contactSettings.findUnique({ where: { tenantId: tenant.id } }),
    db.pageContent.findMany({ where: { tenantId: tenant.id }, orderBy: { slot: "asc" } }),
  ]);
  return JSON.parse(JSON.stringify({ home, highlights, services, faqs, heroes, notice, contact, pages }));
}

function runSeed(extra: Record<string, string | undefined>) {
  return spawnSync("npm", ["run", "db:seed"], {
    env: { ...process.env, ...extra },
    encoding: "utf8",
  });
}

async function main() {
  const before = await snapshot();
  const denied = runSeed({ SEED_ALLOW_NON_PRODUCTION: undefined });
  assert(denied.status !== 0, "seed without explicit opt-in was not rejected");
  assert(`${denied.stdout}\n${denied.stderr}`.includes("SEED_ALLOW_NON_PRODUCTION"), "seed denial did not identify the required opt-in");
  const production = runSeed({ SEED_ALLOW_NON_PRODUCTION: "true", APP_STAGE: "production" });
  assert(production.status !== 0, "seed in production stage was not rejected");
  const first = runSeed({ SEED_ALLOW_NON_PRODUCTION: "true" });
  assert(first.status === 0, `seed with non-production opt-in failed: ${first.stderr}`);
  const second = runSeed({ SEED_ALLOW_NON_PRODUCTION: "true" });
  assert(second.status === 0, `second seed with non-production opt-in failed: ${second.stderr}`);
  const after = await snapshot();
  assert(JSON.stringify(before) === JSON.stringify(after), "seed changed existing CMS-managed records");
  console.info(JSON.stringify({ script: "check-seed-safety", assertions }));
}

main().finally(() => db.$disconnect());