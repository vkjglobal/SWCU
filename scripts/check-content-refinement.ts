import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { sanitizeRichText } from "../src/lib/rich-text";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "swcu" }, select: { id: true } });
  const rows = await db.pageContent.findMany({
    where: { tenantId: tenant.id, slot: { in: ["ABOUT_STORY", "LOANS_INTRO"] }, isPublished: true },
    select: { slot: true, heading: true, body: true },
  });
  assert.equal(rows.length, 2, "Both existing SWCU content slots remain published");
  const story = rows.find((row) => row.slot === "ABOUT_STORY")!;
  const loans = rows.find((row) => row.slot === "LOANS_INTRO")!;
  assert.equal(story.heading, "Member-owned. Serving members since 2000.");
  for (const excerpt of [
    "was formed following an initiative of the National Council of the Fiji Public Service Association and was registered on 14 September 2000.",
    "From the beginning, SWCU has focused on helping members build savings, access financial assistance and strengthen the wellbeing of members and their families.",
    "<h3>Our Story</h3>",
    "regular saving, responsible borrowing and mutual support",
    "Today, SWCU continues to serve its members from 300 Waimanu Road, Suva.",
  ]) assert.ok(story.body?.includes(excerpt), `About is missing ${excerpt}`);
  assert.equal((story.body?.match(/14 September 2000/g) ?? []).length, 1, "History and date are not repeated in the story");
  assert.equal(loans.heading, "Loans");
  for (const excerpt of [
    "at least 3 months", "Tuesday at 4.30 pm", "The Credit Committee considers applications on Wednesday",
    "<h3>How loan interest works</h3>",
    "1% per month on the reducing loan balance",
    "Interest is calculated daily on the amount still owing and applied at the end of each calendar month.",
    "a member does not simply pay 12% of the original loan amount over a year.",
    "any applicable fees and SWCU’s approval.",
  ]) assert.ok(loans.body?.includes(excerpt), `Loans is missing ${excerpt}`);
  for (const body of [story.body!, loans.body!]) {
    const html = sanitizeRichText(body);
    assert.ok(html.includes("<h3>"), "CMS subheadings survive sanitization");
    assert.ok(!/298 Waimanu|money-lender|\$120|effective annual percentage/.test(html), "Unapproved historical details are absent");
  }
  console.log("About and loan-interest CMS content checks passed.");
}

main().finally(() => db.$disconnect());