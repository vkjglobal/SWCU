import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seed() {
  const tenant = await db.tenant.upsert({
    where: { slug: "swcu" },
    update: {
      displayName: "Service Worker Credit Union",
      isActive: true,
    },
    create: {
      slug: "swcu",
      displayName: "Service Worker Credit Union",
    },
  });

  await db.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: { organisationName: "Service Worker Credit Union" },
    create: {
      tenantId: tenant.id,
      organisationName: "Service Worker Credit Union",
    },
  });

  const domains = [
    ["www.swcu.finance", true],
    ["swcu.finance", false],
    ["swcu.com.fj", false],
    ["www.swcu.com.fj", false],
  ] as const;

  for (const [hostname, isPrimary] of domains) {
    await db.tenantDomain.upsert({
      where: { hostname },
      update: { tenantId: tenant.id, isPrimary, isActive: true },
      create: { tenantId: tenant.id, hostname, isPrimary },
    });
  }

  console.info("SWCU tenant foundation is ready.");
}

seed()
  .finally(async () => {
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });