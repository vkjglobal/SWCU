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

  await db.homeSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  const highlights = [
    ["1,500+", "Members"],
    ["Member-owned", "A credit union for its members"],
    ["Since 2000", "Serving Fiji service workers"],
  ] as const;
  for (const [value, label] of highlights) {
    await db.homeHighlight.upsert({
      where: { id: `${tenant.id}-${value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}` },
      update: { value, label, isEnabled: true },
      create: { id: `${tenant.id}-${value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, tenantId: tenant.id, value, label },
    });
  }

  const services = [
    ["Savings", "Build a steady savings habit with SWCU.", "piggy-bank"],
    ["Loans", "Access member loan support when you need it.", "hand-coins"],
    ["Retirement Savings", "Plan with a long-term savings mindset.", "sunset"],
    ["Death Benefit Scheme", "Member support for families when it matters.", "heart-handshake"],
  ] as const;
  for (const [index, [title, description, icon]] of services.entries()) {
    await db.service.upsert({
      where: { id: `${tenant.id}-service-${index + 1}` },
      update: { title, description, icon, sortOrder: index, isEnabled: true },
      create: { id: `${tenant.id}-service-${index + 1}`, tenantId: tenant.id, title, description, icon, sortOrder: index },
    });
  }

  const faqs = [
    [
      "Where can I find SWCU forms?",
      "Approved forms and documents are available in the Forms & Resources area when they are published.",
    ],
    [
      "How can I learn about joining SWCU?",
      "Visit the Membership & Services page for approved membership information and next steps.",
    ],
    [
      "How do I contact SWCU?",
      "Use the contact details published on this website so you know you are reaching SWCU through an official channel.",
    ],
  ] as const;
  for (const [index, [question, answer]] of faqs.entries()) {
    await db.fAQ.upsert({
      where: { id: `${tenant.id}-faq-${index + 1}` },
      update: { question, answer, sortOrder: index, isEnabled: true },
      create: {
        id: `${tenant.id}-faq-${index + 1}`,
        tenantId: tenant.id,
        question,
        answer,
        sortOrder: index,
      },
    });
  }

  await db.contactSettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      organisationName: "Service Worker Credit Union",
      streetAddress: "300 Waimanu Road, Suva",
      postalAddress: "GPO Box 1405, Suva",
      telephone: "(679) 7730445",
      publicEmail: "swcu2016@gmail.com",
    },
    create: {
      tenantId: tenant.id,
      organisationName: "Service Worker Credit Union",
      streetAddress: "300 Waimanu Road, Suva",
      postalAddress: "GPO Box 1405, Suva",
      telephone: "(679) 7730445",
      publicEmail: "swcu2016@gmail.com",
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