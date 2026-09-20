import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sanitizeRichText } from "../src/lib/rich-text";
import { getServiceDestination } from "../src/lib/service-links";

const expectedDestinations = {
  Savings: "/membership-services#savings",
  Loans: "/membership-services#loans",
  "Retirement Savings": "/membership-services#retirement-savings",
  "Death Benefit Scheme": "/membership-services#death-benefit",
} as const;

for (const [title, href] of Object.entries(expectedDestinations)) {
  assert.equal(getServiceDestination(title), href);
}
assert.equal(getServiceDestination("Savings", "/custom-savings"), "/custom-savings");
assert.equal(getServiceDestination("Other service"), "/membership-services");

const malformedAccessibility = "<h2><h2>Accessibility</h2><p>Ordinary body text.</p><ul><li>List item</li></ul></h2>";
assert.equal(
  sanitizeRichText(malformedAccessibility),
  "<h2>Accessibility</h2><p>Ordinary body text.</p><ul><li>List item</li></ul>",
);
assert.equal(sanitizeRichText("<h2>Valid heading</h2><p>Body text.</p>"), "<h2>Valid heading</h2><p>Body text.</p>");

const homePage = await readFile("src/app/(public)/page.tsx", "utf8");
assert.match(homePage, /getServiceDestination\(item\.title, item\.destination\)/);
assert.doesNotMatch(homePage, /item\.destination \|\| "#services"/);

const membershipPage = await readFile("src/app/(public)/membership-services/page.tsx", "utf8");
for (const id of ["savings", "loans", "retirement-savings", "death-benefit"]) {
  assert.match(membershipPage, new RegExp(`"${id}"`));
}
assert.match(membershipPage, /<section id=\{id\} key=\{id\} className="scroll-mt-52">/);

console.log("owner UAT accessibility and service-link checks passed");