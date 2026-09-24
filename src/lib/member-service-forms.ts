export const MEMBER_SERVICE_FORM_TITLES = {
  membership: "Application for Membership Form",
  fullWithdrawal: "Full Withdrawal Form",
  partialWithdrawal: "Partial Withdrawal Form",
  loan: "Loan Application Form",
  deathBenefit: "Special Death Benefit Claim Form",
} as const;

export function findExactMemberServiceForm<T extends { title: string; mediaAssetId: string | null }>(
  forms: readonly T[],
  title: string,
) {
  const matches = forms.filter((form) => form.title === title && Boolean(form.mediaAssetId));
  return matches.length === 1 ? matches[0] : null;
}