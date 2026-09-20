import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeRichText } from "../src/lib/rich-text";

const hostile = `<p class="MsoNormal" style="color:red" onclick="alert(1)">Safe <strong>bold</strong></p>
<script>alert(document.cookie)</script><iframe src="https://evil.example"></iframe>
<a href="javascript:alert(1)" data-x="bad">unsafe</a>
<a href=" HTTPS://example.com/path ">safe link</a><img src=x onerror=alert(1)>`;
const result = sanitizeRichText(hostile);

assert.match(result, /<p>Safe <strong>bold<\/strong><\/p>/);
assert.match(result, /<a href="HTTPS:\/\/example\.com\/path">safe link<\/a>/);
assert.doesNotMatch(result, /script|iframe|img|style=|class=|onclick|data-x|javascript:/i);
const malformed = sanitizeRichText(`<p><strong>unclosed<a href="//evil.example">bad</a></p><a href="ftp://evil.example">ftp</a><a href="mailto:test@example.com" target="_blank">mail</a>`);
assert.match(malformed, /<p><strong>unclosed<a>bad<\/a><\/strong><\/p>/);
assert.match(malformed, /<a>ftp<\/a><a href="mailto:test@example.com">mail<\/a>/);
assert.doesNotMatch(malformed, /target=|ftp:|\/\/evil/i);
assert.equal(sanitizeRichText("First line\n\nSecond line"), "<p>First line<\/p><p>Second line<\/p>");
assert.equal(sanitizeRichText("<p>2 &lt; 3</p>"), "<p>2 &lt; 3</p>");
assert.equal(sanitizeRichText("Fish & Chips\n\nCompare 2 < 3\n\"quoted\""), "<p>Fish &amp; Chips<\/p><p>Compare 2 &lt; 3<br>&quot;quoted&quot;<\/p>");
const word = sanitizeRichText(`<h1 class="MsoTitle">Heading</h1><p style="color:red"><b>Bold</b> <i>italic</i> <a href="https://example.com">link</a></p>`);
assert.equal(word, `<h2>Heading</h2><p><strong>Bold</strong> <em>italic</em> <a href="https://example.com">link</a></p>`);
const legacyPolicy = sanitizeRichText("Privacy\r\nWhat we collect\r\nWe collect only what we need.\r\n•\tName\r\n•\tEmail\r\nHow we use it\r\nWe use it to respond.");
assert.equal(legacyPolicy, "<h2>Privacy</h2><h3>What we collect</h3><p>We collect only what we need.</p><ul><li>Name</li><li>Email</li></ul><h3>How we use it</h3><p>We use it to respond.</p>");

const actions = readFileSync("src/app/admin/actions.ts", "utf8");
assert.match(actions, /isUtilityPageSlot\(slot\) \? sanitizeRichText\(rawBody\) : rawBody/);
const notice = readFileSync("src/components/site-notice-motion.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");
assert.match(notice, /messageWidth > viewport\.clientWidth/);
assert.match(notice, /loopDistance \/ 60/);
assert.match(notice, /prefers-reduced-motion/);
assert.match(notice, /animationPaused \? " is-paused"/);
assert.match(styles, /\.prose > div strong[\s\S]*font-weight: 800/);
assert.match(styles, /\.prose > div > h2[\s\S]*font-size:/);
assert.match(styles, /\.prose > div > h3[\s\S]*font-size:/);
assert.match(styles, /animation: swcu-notice-ticker var\(--notice-duration\) linear infinite/);
assert.doesNotMatch(styles, /site-notice-track[\s\S]{0,160}alternate/);

console.log("rich-text, utility storage, and notice motion checks passed");