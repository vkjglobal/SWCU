export function mediaCacheControl(isPublished: boolean) {
  return isPublished ? "public, max-age=3600" : "private, no-store";
}