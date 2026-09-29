export function getMemberAppHref(baseUrl: string | undefined = process.env.NEXT_PUBLIC_MEMBER_APP_URL): string | null {
  if (!baseUrl?.trim()) return null;
  try {
    const url = new URL(baseUrl.trim());
    // Only a secure base URL is accepted; never redirect to an arbitrary path or scheme.
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
        url.search || url.hash || !/^\/+$/.test(url.pathname)) return null;
    return `${url.origin}/login`;
  } catch {
    return null;
  }
}

export function formatTelephone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("679") ? digits.slice(3) : digits;
  return local.length === 7 ? `+679 ${local.slice(0, 3)} ${local.slice(3)}` : value;
}

export function formatLocalTelephone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("679") ? digits.slice(3) : digits;
  return local.length === 7 ? `${local.slice(0, 3)} ${local.slice(3)}` : value;
}

export function telephoneHref(value: string) {
  const digits = value.replace(/\D/g, "");
  return `tel:+${digits.startsWith("679") ? digits : `679${digits}`}`;
}