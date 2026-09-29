import "server-only";

export const CONTACT_UNAVAILABLE_MESSAGE = "Online enquiries are temporarily unavailable. Please contact SWCU using the details shown on this page.";
export const CONTACT_VERIFICATION_MESSAGE = "Please complete the security check and try again.";
const TEST_SITE_KEY = "1x00000000000000000000AA";

export type TurnstileConfiguration = { siteKey: string; secretKey: string };

export function resolveTurnstileConfiguration(
  values: { siteKey?: string; secretKey?: string },
  production: boolean,
): TurnstileConfiguration | null {
  const siteKey = values.siteKey?.trim();
  const secretKey = values.secretKey?.trim();
  if (!siteKey || !secretKey) return null;
  // Public test credentials are never valid production configuration.
  if (production && (siteKey === TEST_SITE_KEY || /^1x0+AA$/.test(secretKey))) return null;
  return { siteKey, secretKey };
}

export function getTurnstileConfiguration(): TurnstileConfiguration | null {
  return resolveTurnstileConfiguration({
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    secretKey: process.env.TURNSTILE_SECRET_KEY,
  }, process.env.NODE_ENV === "production");
}

export async function verifyContactTurnstile(
  token: string,
  hostname: string,
  configuration: TurnstileConfiguration,
  send: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await send("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: configuration.secretKey, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) return false;
    const fields = result as { hostname?: unknown; action?: unknown };
    // Cloudflare's public test widget reports a synthetic hostname/action.
    if (process.env.NODE_ENV !== "production" && configuration.siteKey === TEST_SITE_KEY) return true;
    return fields.hostname === hostname.toLowerCase() && fields.action === "contact";
  } catch {
    return false;
  }
}