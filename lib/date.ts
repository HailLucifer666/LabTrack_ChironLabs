const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a date-only ISO string without converting it into an instant.
 * Avoid `new Date("YYYY-MM-DD")`, which can shift the calendar day for users
 * west of UTC when later formatted in their local time zone.
 */
export function formatDateOnly(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return isoDate;
  return `${Number(day)} ${MONTHS[monthIndex]} ${year}`;
}

/**
 * True only when the string is a real calendar date in YYYY-MM-DD form.
 * Compared through UTC components so the check itself can never shift a day,
 * and so impossible dates (2026-02-31) are rejected at the boundary instead of
 * being rendered as plausible-looking nonsense.
 */
export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/**
 * Returns the configured IANA zone only when Intl accepts it; otherwise the
 * documented default. Callers that echo the zone back to the client must use
 * this, so the reported zone can never disagree with the date that was computed.
 */
export function resolveTimeZone(value: string | undefined = process.env.LAB_TIME_ZONE || DEFAULT_TIME_ZONE): string {
  const candidate = value || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    console.warn(`LAB_TIME_ZONE "${candidate}" is not a valid IANA time zone; falling back to ${DEFAULT_TIME_ZONE}.`);
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Returns today's calendar date in the lab's configured IANA time zone.
 *
 * `now` is injectable so the time-zone behaviour can be proven against a fixed
 * instant instead of whenever the test happens to run. An invalid configured
 * zone must never take every endpoint down with an uncaught RangeError: fall
 * back to the documented default and say so on the server.
 */
export function todayDateInTimeZone(
  timeZone = process.env.LAB_TIME_ZONE || DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): string {
  const effectiveZone = resolveTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: effectiveZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isCaseOverdue(dueDate: string, status: string, todayDate: string): boolean {
  return status !== "READY" && dueDate < todayDate;
}
