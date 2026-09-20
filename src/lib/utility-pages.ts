export const UTILITY_PAGE_DEFINITIONS = [
  { slug: "privacy", slot: "PRIVACY", label: "Privacy" },
  { slug: "terms-of-use", slot: "TERMS_OF_USE", label: "Terms of Use" },
  { slug: "accessibility", slot: "ACCESSIBILITY", label: "Accessibility" },
  { slug: "important-information", slot: "IMPORTANT_INFORMATION", label: "Important Information" },
] as const;

export const UTILITY_PAGE_SLOTS = UTILITY_PAGE_DEFINITIONS.map(({ slot }) => slot);

export function getUtilityPageDefinition(slug: string) {
  return UTILITY_PAGE_DEFINITIONS.find((page) => page.slug === slug);
}

export function isUtilityPageSlot(slot: string) {
  return UTILITY_PAGE_SLOTS.includes(slot as (typeof UTILITY_PAGE_SLOTS)[number]);
}