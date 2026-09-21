import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function activationSecretMatches(supplied: string, expected: string) {
  return timingSafeEqual(digest(supplied), digest(expected));
}

export function normalizedActivationIp(value?: string | null) {
  const candidate = value?.split(",")[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : "unknown";
}

export function activationRequestMatchesCanonicalOrigin(input: {
  canonicalUrl: string;
  host?: string | null;
  forwardedProto?: string | null;
  origin?: string | null;
}) {
  const canonical = new URL(input.canonicalUrl);
  const host = input.host?.split(",")[0]?.trim().toLowerCase() ?? "";
  const proto = input.forwardedProto?.split(",")[0]?.trim().toLowerCase() ?? "";
  const originMatches = input.origin === undefined || input.origin === canonical.origin;
  return canonical.protocol === "https:"
    && proto === "https"
    && host === canonical.host.toLowerCase()
    && originMatches;
}

export function canonicalCredentialAccount<T extends { accountId: string; password: string | null }>(
  accounts: T[],
  expectedAccountId: string,
) {
  if (accounts.length > 1) throw new Error("Credential account state is invalid.");
  const account = accounts[0];
  if (account && account.accountId !== expectedAccountId) throw new Error("Credential account state is invalid.");
  return account;
}