export function formatFijiDateTime(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Fiji", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatFijiDisplayDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Fiji",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(value);
}