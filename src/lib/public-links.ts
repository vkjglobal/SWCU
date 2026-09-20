export const MEMBER_APP_HOLDING_PATH = "/member-login";

export function getMemberAppHref(settings?: { memberAppStatus?: string | null; memberAppUrl?: string | null } | null) {
  if (settings?.memberAppStatus?.toUpperCase() === "LIVE") {
    return "https://app.swcu.finance";
  }
  return MEMBER_APP_HOLDING_PATH;
}

export function formatTelephone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("679") ? digits.slice(3) : digits;
  return local.length === 7 ? `+679 ${local.slice(0, 3)} ${local.slice(3)}` : value;
}

export function telephoneHref(value: string) {
  const digits = value.replace(/\D/g, "");
  return `tel:+${digits.startsWith("679") ? digits : `679${digits}`}`;
}