import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "br"] as const;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plainTextToHtml(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const sanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  parseStyleAttributes: false,
  enforceHtmlBoundary: true,
  transformTags: {
    b: "strong",
    i: "em",
    h1: "h2",
    a: (_tagName, attribs) => {
      const next: Record<string, string> = {};
      if (attribs.href) next.href = attribs.href.trim();
      return { tagName: "a", attribs: next };
    },
  },
};

/** Normalise the deliberately small, approved CMS rich-content subset. */
export function sanitizeRichText(input: string) {
  const value = input.trim();
  if (!value) return "";
  // Existing utility records are plain text. Handle them before sanitize-html
  // so entities such as "&" and quotes are escaped exactly once.
  if (!/<\/?[a-z][^>]*>/i.test(value)) return plainTextToHtml(value);
  const sanitized = sanitizeHtml(value, sanitizerOptions).trim();
  return sanitized;
}

export function richTextToPlainText(input: string) {
  return input.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|h2|h3|li)>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}