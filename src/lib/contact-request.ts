import { isIP } from "node:net";

const MAX_BODY_BYTES = 16 * 1024;

function trustedContactProxy(environment: NodeJS.ProcessEnv): boolean {
  return environment.CONTACT_TRUST_PROXY === "true" ||
    (environment.NODE_ENV !== "production" && Boolean(environment.REPLIT_DEV_DOMAIN));
}

export function contactRequestHost(headers: Headers, environment: NodeJS.ProcessEnv = process.env): string | null {
  const host = headers.get("host")?.toLowerCase();
  const forwarded = headers.get("x-forwarded-host")?.toLowerCase();
  const trusted = trustedContactProxy(environment);
  if (forwarded && host && forwarded !== host && !trusted) return null;
  const chosen = (trusted && forwarded) || host;
  return chosen && /^[a-z0-9.-]+(?::[0-9]+)?$/.test(chosen) ? chosen : null;
}

export function contactOriginAllowed(headers: Headers, canonicalHost = contactRequestHost(headers)): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // Non-browser callers still require Turnstile verification.
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
    return Boolean(canonicalHost && parsed.host.toLowerCase() === canonicalHost.toLowerCase());
  } catch {
    return false;
  }
}

export function contactSourceAddress(headers: Headers, environment: NodeJS.ProcessEnv = process.env): string {
  // Trust proxy-added IP headers only when the deployment uses a trusted proxy.
  // Cloudways should enable CONTACT_TRUST_PROXY only after its origin is restricted
  // to the reverse proxy. Replit's development proxy supplies forwarded headers.
  const trusted = trustedContactProxy(environment);
  // No IP is safer than throttling every production visitor as one source.
  if (!trusted) return "";
  if (environment.CONTACT_TRUST_PROXY === "true" && headers.has("cf-ray")) {
    const cloudflareIp = headers.get("cf-connecting-ip")?.trim() ?? "";
    if (isIP(cloudflareIp)) return cloudflareIp;
  }
  // A trusted proxy appends the last hop; never use the first, client-supplied entry.
  const lastForwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
  if (isIP(lastForwarded)) return lastForwarded;
  const realIp = headers.get("x-real-ip")?.trim() ?? "";
  return isIP(realIp) ? realIp : "";
}

export async function readContactJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw Object.assign(new Error("Invalid request."), { status: 415 });
  }
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_BODY_BYTES) throw Object.assign(new Error("Request is too large."), { status: 413 });
  if (!request.body) throw new Error("Invalid request.");
  const reader = request.body.getReader();
  let size = 0;
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      void reader.cancel();
      throw Object.assign(new Error("Request is too large."), { status: 413 });
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); } catch { throw new Error("Invalid request."); }
}