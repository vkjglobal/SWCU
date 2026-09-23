export const LEADERSHIP_GROUPS = [
  "General Manager",
  "Board",
  "Credit Committee",
  "Supervisory Committee",
] as const;

export type LeadershipGroup = (typeof LEADERSHIP_GROUPS)[number];

export function leadershipGroupLabel(group: string) {
  return group === "Board" ? "Board of Directors" : group;
}

export function leadershipGroupRank(group: string) {
  const index = LEADERSHIP_GROUPS.indexOf(group as LeadershipGroup);
  return index === -1 ? LEADERSHIP_GROUPS.length : index;
}