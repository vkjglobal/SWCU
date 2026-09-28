export function formatFijiDateTime(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Fiji", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const fijiPartsFormatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
  timeZone: "Pacific/Fiji",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type LocalDateTimeParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function utcMillis(parts: LocalDateTimeParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.getTime();
}

function fijiParts(timestamp: number): LocalDateTimeParts {
  const parts = fijiPartsFormatter.formatToParts(new Date(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function sameMinute(left: LocalDateTimeParts, right: LocalDateTimeParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

/** Convert a datetime-local wall time in Pacific/Fiji to its UTC instant. */
export function fijiLocalDateTimeToUtcIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Invalid Fiji local date and time.");
  const requested: LocalDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  if (
    requested.year < 1 || requested.year > 9999
    || requested.month < 1 || requested.month > 12
    || requested.day < 1 || requested.day > 31
    || requested.hour < 0 || requested.hour > 23
    || requested.minute < 0 || requested.minute > 59
  ) {
    throw new RangeError("Invalid Fiji local date and time.");
  }

  const wallTime = utcMillis(requested);
  const checkDate = new Date(wallTime);
  if (
    checkDate.getUTCFullYear() !== requested.year
    || checkDate.getUTCMonth() + 1 !== requested.month
    || checkDate.getUTCDate() !== requested.day
  ) {
    throw new RangeError("Invalid Fiji local date and time.");
  }

  // Gather timezone offsets around the wall time. Intl supplies the IANA
  // Pacific/Fiji rules, including any historic or future offset changes.
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 3) {
    const sample = wallTime + hours * 60 * 60 * 1000;
    const local = fijiParts(sample);
    offsets.add(utcMillis(local) - sample);
  }

  const matches = new Set<number>();
  for (const offset of offsets) {
    const candidate = wallTime - offset;
    if (sameMinute(fijiParts(candidate), requested)) matches.add(candidate);
  }
  if (matches.size !== 1) throw new RangeError("Invalid or ambiguous Fiji local date and time.");
  return new Date([...matches][0]).toISOString();
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