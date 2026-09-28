/** No message mutation for an unchanged field; an empty edited field explicitly clears it. */
export function changedMemberMessage(initial: string, submitted: string): string | null | undefined {
  const next = submitted.trim();
  if (next === initial.trim()) return undefined;
  return next || null;
}