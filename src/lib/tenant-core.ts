export type TenantResolutionInput = {
  hostname: string;
  nodeEnv: "development" | "test" | "production";
  developmentSlug?: string;
};

export function normaliseHostname(hostname: string): string {
  return hostname.toLowerCase().split(":")[0]?.trim() ?? "";
}

export function selectDevelopmentTenantSlug(
  input: TenantResolutionInput,
): string | undefined {
  if (input.nodeEnv === "production") {
    return undefined;
  }

  return input.developmentSlug?.trim() || undefined;
}