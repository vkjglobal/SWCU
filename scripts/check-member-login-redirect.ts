import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberLoginAction } from "../src/components/member-login-action";
import MemberLoginPage from "../src/app/(public)/member-login/page";
import { getMemberAppHref, telephoneHref } from "../src/lib/public-links";

let assertions = 0;
function check(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  assertions++;
}
function source(path: string) { return readFileSync(path, "utf8"); }

const example = "https://member-app.example.invalid";
const prior = process.env.NEXT_PUBLIC_MEMBER_APP_URL;
try {
  process.env.NEXT_PUBLIC_MEMBER_APP_URL = `${example}///`;
  check(getMemberAppHref() === `${example}/login`, "configured base URL joins /login without duplicate slashes");
  check(getMemberAppHref(`${example}/`) === `${example}/login`, "single trailing slash works");
  for (const invalid of ["", "javascript:alert(1)", "http://member-app.example.invalid", `${example}/old-path`, `${example}/?next=bad`, "https://user:pass@member-app.example.invalid"]) {
    check(getMemberAppHref(invalid) === null, "invalid or non-base URLs are not destinations");
  }

  let redirectDigest = "";
  try {
    MemberLoginPage();
  } catch (error) {
    redirectDigest = error && typeof error === "object" && "digest" in error ? String(error.digest) : "";
  }
  check(redirectDigest.startsWith(`NEXT_REDIRECT;replace;${example}/login;`), "bookmarked holding route issues a real Next redirect to configured login");

  const link = renderToStaticMarkup(createElement(MemberLoginAction, { href: getMemberAppHref(), className: "button-primary" }, "Member Login"));
  check(link.includes(`href="${example}/login"`) && !link.includes("aria-disabled"), "shared desktop/mobile action is a usable login link when configured");

  process.env.NEXT_PUBLIC_MEMBER_APP_URL = "";
  check(getMemberAppHref() === null, "missing configuration does not guess a production or DEV host");
  const unavailable = renderToStaticMarkup(MemberLoginPage());
  check(unavailable.includes("Member login temporarily unavailable") && !unavailable.toLowerCase().includes("coming soon"), "old route has friendly no-key state without holding-page copy");
  const disabled = renderToStaticMarkup(createElement(MemberLoginAction, { href: getMemberAppHref(), className: "button-primary" }, "Login"));
  check(disabled.includes('aria-disabled="true"') && !disabled.includes("href="), "missing configuration disables login instead of navigating incorrectly");

  const shell = source("src/app/(public)/_components.tsx");
  const home = source("src/components/home-experience.tsx");
  const layout = source("src/app/(public)/layout.tsx");
  const homePage = source("src/app/(public)/page.tsx");
  const alternateHeader = source("src/components/site-header.tsx");
  check(shell.includes('<MemberLoginAction href={memberAppHref} className="button-primary header-member-login') &&
    shell.includes('<MemberLoginAction href={memberAppHref} ariaLabel="Sign in to Member Login"'), "desktop and mobile Login use the same configured destination");
  check(home.includes('<MemberLoginAction href={memberApp.href}') && homePage.includes("href: getMemberAppHref()"), "both homepage login actions use the central destination");
  check(layout.includes("getMemberAppHref()") && alternateHeader.includes("getMemberAppHref()"), "public and alternate header do not retain a holding-page fallback");
  check(!shell.slice(shell.indexOf("export function PublicFooter"), shell.indexOf("export function ContactForm")).includes("member-login"), "footer has no separate stale Member Login link");
  check(shell.includes('href="/membership-services#membership"') && home.includes('href="/membership-services#membership"'), "Join destinations unchanged");
  check(shell.includes("telephoneHref(phone)") && telephoneHref("6797000000") === "tel:+6797000000", "Call destination unchanged");
  check(!home.toLowerCase().includes("coming soon") && !source("src/app/(public)/member-login/page.tsx").toLowerCase().includes("coming soon"), "obsolete Member App copy removed");
  check(![shell, home, homePage, layout, alternateHeader].some((text) => /https?:\/\/[^\s"'`]*\.replit\.dev/.test(text)), "no temporary Member App DEV hostname in changed public source");

  console.info(JSON.stringify({ script: "check-member-login-redirect", assertions }));
} finally {
  if (prior === undefined) delete process.env.NEXT_PUBLIC_MEMBER_APP_URL;
  else process.env.NEXT_PUBLIC_MEMBER_APP_URL = prior;
}