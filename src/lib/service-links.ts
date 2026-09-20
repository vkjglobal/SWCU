const SERVICE_DESTINATIONS: Record<string, string> = {
  Savings: "/membership-services#savings",
  Loans: "/membership-services#loans",
  "Retirement Savings": "/membership-services#retirement-savings",
  "Death Benefit Scheme": "/membership-services#death-benefit",
};

export function getServiceDestination(title: string, destination?: string | null) {
  const configuredDestination = destination?.trim();
  return configuredDestination || SERVICE_DESTINATIONS[title] || "/membership-services";
}