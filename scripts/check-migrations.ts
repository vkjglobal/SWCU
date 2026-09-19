import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const expected = [
  "20260919040546_foundation",
  "20260919045928_prompt2_cms_media",
  "20260919060000_prompt2_cms_drafts",
  "20260919070000_prompt3_staff_workflow",
  "20260919073000_prompt3a_login_attempts",
  "20260919080000_prompt3a_site_notice_backfill",
  "20260919081000_prompt3a_site_notice_unique_reconcile",
  "20260919090000_prompt3b_public_foundation",
  "20260919091000_prompt3b_contact_recipients",
  "20260919091100_prompt3b_contact_recipients_json",
  "20260919100000_prompt3_final_gate_content",
];
const actual = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
for (const name of expected) if (!actual.includes(name)) throw new Error(`Missing migration directory: ${name}`);
const status = execFileSync("npx", ["prisma", "migrate", "status"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (!/Database schema is up to date/i.test(status)) throw new Error(`Migration status is not current:\n${status}`);
console.info(JSON.stringify({ script: "check-migrations", assertions: expected.length + 1 }));