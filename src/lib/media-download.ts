export function safeDownloadFilename(filename: string, mimeType: string) {
  const fallback = mimeType === "application/pdf" ? "document.pdf" : "download";
  const cleaned = filename
    .normalize("NFKC")
    .replace(/[\r\n"]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\/]/g, "_")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

export function buildMediaDownloadHeaders(input: {
  mimeType: string;
  filename: string;
  isPdf: boolean;
  cacheControl: string;
}) {
  const headers = new Headers({
    "Content-Type": input.isPdf ? "application/pdf" : input.mimeType,
    "Cache-Control": input.cacheControl,
    "X-Content-Type-Options": "nosniff",
  });
  if (input.isPdf) {
    headers.set("Content-Disposition", `attachment; filename="${safeDownloadFilename(input.filename, input.mimeType)}"`);
  }
  return headers;
}