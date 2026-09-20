import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
let assertions = 0;
const check = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  assertions += 1;
};

const styles = source("src/app/globals.css");
const notice = source("src/components/site-notice-motion.tsx");
const home = source("src/components/home-experience.tsx");
const homePage = source("src/app/(public)/page.tsx");
const resources = source("src/app/(public)/forms-resources/page.tsx");
const media = source("src/app/admin/media/page.tsx");
const leadership = source("src/app/admin/leadership/page.tsx");
const forms = source("src/app/admin/forms/page.tsx");
const selector = source("src/components/admin-media-upload.tsx");
const adminActions = source("src/app/admin/actions.ts");
const siteNoticeAdmin = source("src/app/admin/site-notice/page.tsx");

check(styles.includes(".button-primary:hover") && styles.includes("background: #0f4f86"), "primary button hover is visibly darker");
check(styles.includes(".button-primary:active") && styles.includes("scale(0.98)"), "primary buttons have pressed feedback");
check(styles.includes(":focus-visible") && styles.includes("outline: 3px solid"), "keyboard focus remains visible");
check(styles.includes("a:not(.button-primary)") && styles.includes("text-decoration-thickness: 2px"), "ordinary links have visible hover feedback");

check(selector.includes("export function AdminFileSelector"), "shared file selector exists");
check(selector.includes("No file selected") && selector.includes("Change file"), "file selector reports selection state");
check(selector.includes('disabled={pending}') && selector.includes("useFormStatus"), "file selector disables during processing");
check(selector.includes("admin-file-control") && styles.includes(".admin-file-control:not(:disabled):hover") && styles.includes(".admin-file-control:not(:disabled):active"), "file selector has visible hover and pressed states");
check(selector.includes('aria-labelledby={`${inputId}-label`}'), "file selector has an accessible label");

check(media.includes("Website Images"), "staff image area is named Website Images");
check(media.includes('mimeType: { in: ["image/jpeg", "image/png", "image/webp"] }'), "Website Images query is image-only");
check(!media.includes("application/pdf"), "Website Images does not include PDF media");
check(selector.includes("AdminImagePreview") && selector.includes("Preview unavailable") && media.includes("AdminImagePreview"), "image cards have a safe preview fallback");
check(media.includes("asset.width > 0 && asset.height > 0"), "meaningless zero dimensions are hidden");
check(media.includes("Image use") && media.includes("Image description"), "Website Images uses plain-English labels");

for (const label of ["Name", "Role / Title", "Committee", "Profile / Short Biography", "Display Order", "Photo (optional)"]) {
  check(leadership.includes(label), `Leadership includes ${label}`);
}
check(!leadership.includes('name="mediaAssetId"'), "Leadership does not expose a media ID input");
check(leadership.includes("<option>Board</option>") && leadership.includes("<option>Credit Committee</option>") && leadership.includes("<option>Supervisory Committee</option>"), "Leadership uses the approved committee dropdown");
check(leadership.includes("Current photo") && leadership.includes("Remove current photo"), "Leadership supports photo preview and removal");
check(adminActions.includes('purpose: "general"') && adminActions.includes("retireIfUnreferenced"), "Leadership photo management uses the protected media lifecycle");

check(!forms.includes('name="mediaAssetId"'), "Forms & Documents does not expose PDF media IDs");
check(forms.includes('accept="application/pdf,.pdf"'), "Forms & Documents retains PDF upload and replacement");
check(forms.includes("Form name") && forms.includes("Document category") && forms.includes("Display order"), "Forms & Documents uses plain-English labels");

check(homePage.includes("excerpt: item.summary"), "Home receives approved CMS News content");
check(home.includes("line-clamp-3") && home.includes("item.excerpt"), "Home limits News excerpts without altering saved text");
check(home.includes('href="/forms-resources#news"') && home.includes("View News &amp; Notices"), "Home News has a real section destination");
check(!home.includes('href={item.href || "#help-resources"}'), "Home News title is not a dead fallback link");
check(resources.includes('<section id="news">') && resources.includes("n.summary"), "Forms & Resources renders full published News content");

check(styles.includes("linear infinite") && !styles.includes("infinite alternate"), "Site Notice always moves in one direction");
check(notice.includes("loopDistance / 60"), "Site Notice targets about 60 pixels per second");
check(notice.includes('className="ml-12"') && notice.includes("notice.message}</span><span"), "Site Notice uses two copies for a seamless loop");
check(notice.includes("paused || hoveredOrFocused") && notice.includes("prefers-reduced-motion: reduce"), "Site Notice retains pause and reduced-motion behavior");

check(styles.includes(".prose > div > h2") && styles.includes(".prose > div > h3"), "public utility headings have explicit typography");
check(styles.includes(".prose > div strong") && styles.includes("font-weight: 800"), "public utility strong text is visibly bold");
check(styles.includes(".prose > div a") && styles.includes("text-decoration: underline"), "public utility links remain recognizable");
check(siteNoticeAdmin.includes("Button Text") && siteNoticeAdmin.includes("Button Link") && siteNoticeAdmin.includes("Start Date") && siteNoticeAdmin.includes("End Date"), "Site Notice Admin labels use plain English");

console.info(JSON.stringify({ script: "check-prompt4b", assertions }));