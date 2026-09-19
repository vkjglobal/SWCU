export function canServeMedia(input: {
  isPublished: boolean;
  membershipRole?: string | null;
  membershipActive?: boolean;
}) {
  if (input.isPublished) return true;
  return Boolean(
    input.membershipActive &&
      (input.membershipRole === "ADMINISTRATOR" || input.membershipRole === "EDITOR"),
  );
}