export type TenantResolutionInput = {
  hostname: string;
  nodeEnv: "development" | "test" | "production";
  developmentSlug?: string;
};

export function normaliseHostname(hostname: string): string {
  return hostname.toLowerCase().split(":")[0]?.trim() ?? "";
}

export function selectTenantLookupHostname(hostname: string): string {
  const normalisedHostname = normaliseHostname(hostname);

  if (normalisedHostname === "nodejs-1672988-6683714.cloudwaysnodeapps.com") {
    return "www.swcu.finance";
  }

  return normalisedHostname;
}

export function selectDevelopmentTenantSlug(
  input: TenantResolutionInput,
): string | undefined {
  if (input.nodeEnv === "production") {
    return undefined;
  }

  return input.developmentSlug?.trim() || undefined;
}