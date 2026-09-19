import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { assertSeedExecutionSafe } from "../src/lib/execution-safety";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function createIfMissing<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
) {
  const existing = await find();
  return existing ?? create();
}

const approvedPages = [
  {
    slot: "ABOUT_STORY",
    heading: "Our Story",
    body: "Service Worker Credit Union began on 23 August 2000, when a group of Fiji Public Service Association members met in Suva to establish a credit union for members. Today, SWCU serves its members from 300 Waimanu Road, Suva.",
  },
  {
    slot: "ABOUT_VISION",
    heading: "Our Vision",
    body: "To be a leading credit union providing financial services for our members.",
  },
  {
    slot: "ABOUT_MISSION",
    heading: "Our Mission",
    body: "To encourage members to save and provide financial assistance that helps improve the wellbeing of members and their families.",
  },
  {
    slot: "ABOUT_PURPOSE",
    heading: "Our Purpose",
    body: "To help members build savings, access financial assistance for provident and productive needs, and strengthen their financial wellbeing.",
  },
  {
    slot: "MEMBERSHIP_INTRO",
    heading: "Membership",
    body: "SWCU provides savings, loans and member benefit services to eligible members. Members and people interested in joining can use the Membership Application and contact SWCU for current membership requirements.",
  },
  {
    slot: "SAVINGS_INTRO",
    heading: "Savings",
    body: "Regular savings help members build funds for future needs and difficult times. SWCU provides members with a practical way to build their savings over time.",
  },
  {
    slot: "LOANS_INTRO",
    heading: "Loans",
    body: "SWCU provides member loans for provident or productive purposes. Applications are considered against repayment ability, income or salary, and the member’s account position.",
  },
  {
    slot: "RETIREMENT_INTRO",
    heading: "Retirement Savings",
    body: "SWCU’s Retirement Savings Fund helps members build additional savings and strengthen their financial position for the future.",
  },
  {
    slot: "DEATH_BENEFIT_INTRO",
    heading: "Death Benefit Scheme",
    body: "SWCU’s Special Death Benefit Scheme is designed to provide support to the families and beneficiaries of members who pass away. Claims are handled under the Scheme’s approved rules.",
  },
  {
    slot: "IMPORTANT_INFORMATION",
    heading: "Important Information",
    body: "Repayment figures are estimates only. Actual repayments, terms and loan approval are subject to SWCU requirements and approval.\n\nSWCU will never ask you to disclose your password, PIN or security/verification code by email, phone, chat or through an unsolicited link. If you are unsure, contact SWCU using the contact details published on this website.",
  },
] as const;

async function seed() {
  assertSeedExecutionSafe();

  const tenant = await createIfMissing(
    () => db.tenant.findUnique({ where: { slug: "swcu" } }),
    () => db.tenant.create({ data: { slug: "swcu", displayName: "Service Worker Credit Union" } }),
  );

  await createIfMissing(
    () => db.homeSettings.findUnique({ where: { tenantId: tenant.id } }),
    () => db.homeSettings.create({ data: { tenantId: tenant.id } }),
  );

  const highlights = [
    ["1,500+", "Members"],
    ["Member-owned", "A credit union for its members"],
    ["Since 2000", "Serving Fiji service workers"],
  ] as const;
  for (const [index, [value, label]] of highlights.entries()) {
    const id = `${tenant.id}-${value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
    await createIfMissing(
      () => db.homeHighlight.findUnique({ where: { id } }),
      () => db.homeHighlight.create({ data: { id, tenantId: tenant.id, value, label, sortOrder: index } }),
    );
  }

  const services = [
    ["Savings", "Build a steady savings habit with SWCU.", "piggy-bank"],
    ["Loans", "Access member loan support when you need it.", "hand-coins"],
    ["Retirement Savings", "Plan with a long-term savings mindset.", "sunset"],
    ["Death Benefit Scheme", "Member support for families when it matters.", "heart-handshake"],
  ] as const;
  for (const [index, [title, description, icon]] of services.entries()) {
    const id = `${tenant.id}-service-${index + 1}`;
    await createIfMissing(
      () => db.service.findUnique({ where: { id } }),
      () => db.service.create({ data: { id, tenantId: tenant.id, title, description, icon, sortOrder: index } }),
    );
  }

  const faqs = [
    ["Where can I find SWCU forms?", "Approved forms and documents are available in the Forms & Resources area when they are published."],
    ["How can I learn about joining SWCU?", "Visit the Membership & Services page for approved membership information and next steps."],
    ["How do I contact SWCU?", "Use the contact details published on this website so you know you are reaching SWCU through an official channel."],
  ] as const;
  for (const [index, [question, answer]] of faqs.entries()) {
    const id = `${tenant.id}-faq-${index + 1}`;
    await createIfMissing(
      () => db.fAQ.findUnique({ where: { id } }),
      () => db.fAQ.create({ data: { id, tenantId: tenant.id, question, answer, sortOrder: index } }),
    );
  }

  await createIfMissing(
    () => db.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
    () => db.tenantSettings.create({ data: { tenantId: tenant.id, organisationName: "Service Worker Credit Union" } }),
  );

  await createIfMissing(
    () => db.contactSettings.findUnique({ where: { tenantId: tenant.id } }),
    () => db.contactSettings.create({
      data: {
        tenantId: tenant.id,
        organisationName: "Service Worker Credit Union",
        streetAddress: "300 Waimanu Road, Suva",
        postalAddress: "GPO Box 1405, Suva",
        telephone: "(679) 7730445",
        publicEmail: "swcu2016@gmail.com",
        directionsUrl: "https://www.google.com/maps/search/?api=1&query=300+Waimanu+Road+Suva+Fiji",
      },
    }),
  );

  for (const page of approvedPages) {
    await createIfMissing(
      () => db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: page.slot } } }),
      () => db.pageContent.create({ data: { tenantId: tenant.id, ...page, isPublished: true, publishedAt: new Date() } }),
    );
  }

  await createIfMissing(
    () => db.calculatorSettings.findUnique({ where: { tenantId: tenant.id } }),
    () => db.calculatorSettings.create({ data: { tenantId: tenant.id } }),
  );

  const domains = [
    ["www.swcu.finance", true],
    ["swcu.finance", false],
    ["swcu.com.fj", false],
    ["www.swcu.com.fj", false],
  ] as const;
  for (const [hostname, isPrimary] of domains) {
    await createIfMissing(
      () => db.tenantDomain.findUnique({ where: { hostname } }),
      () => db.tenantDomain.create({ data: { tenantId: tenant.id, hostname, isPrimary } }),
    );
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