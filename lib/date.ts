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

/** Returns today's calendar date in the lab's configured IANA time zone. */
export function todayDateInTimeZone(timeZone = process.env.LAB_TIME_ZONE || "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isCaseOverdue(dueDate: string, status: string, todayDate: string): boolean {
  return status !== "READY" && dueDate < todayDate;
}
