import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { getHomeData } from "../src/lib/home-data";
import { getPublishedResources } from "../src/lib/public-data";
import { approvedFaqs } from "./approved-faq-content";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" }, select: { id: true, slug: true, displayName: true } });
  const stored = await db.fAQ.findMany({ where: { tenantId: tenant.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  assert.equal(stored.length, 12, "Only the twelve approved SWCU FAQs exist");
  assert.equal(new Set(stored.map((faq) => faq.question)).size, 12, "No duplicate question");
  stored.forEach((faq, index) => {
    assert.equal(faq.question, approvedFaqs[index].question);
    assert.equal(faq.answer, approvedFaqs[index].answer);
    assert.equal(faq.sortOrder, index);
    assert.equal(faq.isEnabled, true);
  });
  const [home, resources] = await Promise.all([getHomeData(tenant), getPublishedResources(tenant)]);
  assert.deepEqual(home.faqs.map((faq) => faq.question), approvedFaqs.slice(0, 6).map((faq) => faq.question), "Home uses only the six approved leading questions");
  assert.deepEqual(resources.faqs.map((faq) => faq.question), approvedFaqs.map((faq) => faq.question), "Forms & Resources uses all twelve");
  const other = await db.tenant.findFirst({ where: { id: { not: tenant.id } }, select: { id: true, slug: true, displayName: true } });
  if (other) {
    const [otherHome, otherResources] = await Promise.all([getHomeData(other), getPublishedResources(other)]);
    assert.ok(otherHome.faqs.every((faq) => !approvedFaqs.some((approved) => approved.question === faq.question)), "Other Home is isolated");
    assert.ok(otherResources.faqs.every((faq) => !approvedFaqs.some((approved) => approved.question === faq.question)), "Other resources are isolated");
  }
  const text = stored.map((faq) => `${faq.question}\n${faq.answer}`).join("\n");
  for (const forbidden of [
    "info@swcu.finance", "qualifying share", "membership share", "effective annual", "establishment fee",
    "$20 per month", "lunch closure", "automatically qualifies", "minimum retirement contribution",
  ]) assert.ok(!text.toLowerCase().includes(forbidden.toLowerCase()), `No unconfirmed ${forbidden} claim`);
  for (const fact of ["1% per month on the reducing loan balance", "Interest is calculated daily", "swcu2016@gmail.com", "777 7345", "893 6901", "Monday to Thursday: 8.30 am–4.30 pm", "Friday: 8.30 am–4.00 pm"]) {
    assert.ok(text.includes(fact), `Missing approved fact: ${fact}`);
  }
  const homeSource = readFileSync("src/components/home-experience.tsx", "utf8");
  assert.ok(homeSource.includes("aria-expanded={faq === i}") && homeSource.includes("setFaq(faq === i ? null : i)"), "Home accordion exposes one expanded answer at a time");
  assert.ok(homeSource.includes("whitespace-pre-line"), "Home preserves plain-text answer paragraphs");
  const formsSource = readFileSync("src/app/(public)/_components.tsx", "utf8");
  assert.ok(formsSource.includes('name="common-questions"') && formsSource.includes("{faq.answer}"), "Forms accordion safely renders plain-text answers");
  const delta = readFileSync("reports/production-content-delta.md", "utf8");
  const entries = [...delta.matchAll(/### (\d+) — ([^\n]+)\n\n```text\n([\s\S]*?)\n```/g)];
  assert.equal(entries.length, approvedFaqs.length, "Production delta lists all approved FAQ records");
  entries.forEach((entry, index) => {
    assert.equal(Number(entry[1]), index);
    assert.equal(entry[2], approvedFaqs[index].question);
    assert.equal(entry[3], approvedFaqs[index].answer);
  });
  console.log("FAQ content, Home selection, public projections and policy guardrails passed.");
}

main().finally(() => db.$disconnect());