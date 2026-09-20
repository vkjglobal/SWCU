import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";

const source = (path: string) => readFileSync(path, "utf8");
let assertions = 0;
const check = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  assertions += 1;
};

async function main() {
  const home = source("src/components/home-experience.tsx");
  const about = source("src/app/(public)/about-swcu/page.tsx");
  const membership = source("src/app/(public)/membership-services/page.tsx");
  const resources = source("src/app/(public)/forms-resources/page.tsx");
  const contact = source("src/app/(public)/contact/page.tsx");
  const memberLogin = source("src/app/(public)/member-login/page.tsx");
  const shell = source("src/app/(public)/_components.tsx");
  const utility = source("src/app/(public)/[utility]/page.tsx");
  const metadata = source("src/app/(public)/metadata.ts");

  for (const removed of [
    "A member-owned future, built together.",
    "Why members choose SWCU",
    "We are here to help ordinary working people",
    "Member-owned, member-focused",
    "What we offer",
    "A simple starting point",
    "Plan your next step with clarity.",
    "No invented rates or figures.",
    "A simple journey",
    "Learn more about joining SWCU.",
    "A future digital member experience",
    "Welcome back",
    "Your member home",
    "Your details, in one place",
    "Useful to have nearby",
  ]) check(!home.includes(removed), `Home removed: ${removed}`);

  for (const required of [
    "A Credit Union Built Around Its Members",
    "Develop regular savings for today and the future.",
    "Services for Every Stage of Membership",
    "Plan Your Loan",
    "See an estimated repayment before you apply.",
    "Calculator status: Awaiting SWCU configuration",
    "Actual repayments, terms and loan approval",
    "Become an SWCU Member",
    "Your SWCU. Wherever You Are.",
    "Member App — Coming Soon",
    "Help & Resources",
    "How Can We Help?",
  ]) check(home.includes(required), `Home includes: ${required}`);

  for (const description of [
    "Build a steady savings habit with SWCU.",
    "Access member loan support when you need it.",
    "Plan with a long-term savings mindset.",
    "Member support for families when it matters.",
  ]) {
    const seed = source("prisma/seed.ts");
    check(seed.includes(description), `Owner-approved service description retained: ${description}`);
  }

  check(about.includes('title="About SWCU"'), "About uses the approved page title");
  check(about.includes("Our Leadership") && about.includes("Annual Reports"), "About conditional headings are simplified");
  for (const removed of ["People of SWCU", ">Leadership<", "SWCU leadership", ">Reports<", "Annual reports"]) {
    check(!about.includes(removed), `About removed duplicate label: ${removed}`);
  }

  check(membership.includes("Everything you need to know about joining SWCU, saving, borrowing and your member benefits."), "Membership uses locked subheading");
  for (const removed of ["Joining SWCU", "Start with the approved information", "Visit the resources page", "Use the published contact details.", "Published information"]) {
    check(!membership.includes(removed), `Membership removed filler: ${removed}`);
  }

  check(resources.includes('title="Forms & Resources"'), "Resources uses locked page title");
  for (const heading of ["Forms", "News &amp; Notices", "Annual Reports", "Common Questions"]) {
    check(resources.includes(heading), `Resources includes locked heading: ${heading}`);
  }
  for (const removed of ["Forms and helpful resources", "Approved information, documents and answers", "Forms for members", "News from SWCU", "Answers for members"]) {
    check(!resources.includes(removed), `Resources removed duplicate label: ${removed}`);
  }

  check(contact.includes('title="Contact SWCU"'), "Contact uses approved page title");
  check(contact.includes("The contact form is temporarily unavailable. Please use the contact details on this page to reach SWCU."), "Contact uses approved privacy fallback");
  check(memberLogin.includes("The SWCU Member App is coming soon. Until then, you can use this website"), "Member Login uses owner-approved wording");
  check(memberLogin.includes("index: false, follow: false"), "Member Login remains no-indexed");
  check(shell.includes("Service Worker Credit Union. A member-owned credit union in Fiji."), "Footer uses owner-approved wording");
  check(utility.includes("Information from Service Worker Credit Union."), "Utility metadata uses approved generic description");
  check(metadata.includes("title: { absolute: title }"), "Public metadata titles bypass the global suffix and remain exact");
  check(utility.includes('title: { absolute: `${title} | SWCU` }'), "Utility metadata titles remain exact");

  const seedQuestions = [
    "Where can I find SWCU forms?",
    "How can I learn about joining SWCU?",
    "How do I contact SWCU?",
  ];
  const records = await db.fAQ.findMany({
    where: { question: { in: seedQuestions } },
    select: { question: true, isEnabled: true },
  });
  check(records.length === 3, "All three seeded FAQ records remain stored");
  check(records.every((record) => !record.isEnabled), "All three seeded FAQ records are publicly disabled");

  console.info(JSON.stringify({ script: "check-content-closure", assertions }));
}

main().finally(() => db.$disconnect());