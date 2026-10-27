import { isValidDateOnly } from "@/lib/date";
import type { CaseStatus, LabCase, NotificationStatus } from "@/lib/types";

const CASE_STATUSES: readonly string[] = ["IN_PROGRESS", "READY"] satisfies CaseStatus[];
const NOTIFICATION_STATUSES: readonly string[] = ["NOT_SENT", "PREVIEWED", "SENT", "FAILED"] satisfies NotificationStatus[];

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Demo cases live in the visitor's localStorage, so their shape is not ours to
 * trust: a previous session, a corrupted write, or a hand-edit can put anything
 * there. One non-string field used to throw during table render and unmount the
 * whole dashboard, so every entry is validated and anything malformed is dropped.
 *
 * Returns null when the stored value is unusable as a whole (not an array, or an
 * array where every entry was corrupt) so the caller falls back to the seeded
 * demo data. A partially valid list keeps its valid entries; a legitimately
 * empty list stays empty.
 */
export function sanitizeStoredCases(raw: unknown): LabCase[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const cases: LabCase[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const id = asString(candidate.id);
    const reference = asString(candidate.reference);
    const clinicName = asString(candidate.clinicName);
    const clinicEmail = asString(candidate.clinicEmail);
    const caseType = asString(candidate.caseType);
    const dueDate = asString(candidate.dueDate);
    const updatedAt = asString(candidate.updatedAt);
    const status = asString(candidate.status);
    const notificationStatus = asString(candidate.notificationStatus);
    if (!id || !reference || !clinicName || !clinicEmail || !caseType || !dueDate || !updatedAt) continue;
    if (!status || !CASE_STATUSES.includes(status)) continue;
    if (!notificationStatus || !NOTIFICATION_STATUSES.includes(notificationStatus)) continue;
    if (!isValidDateOnly(dueDate)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    cases.push({
      id,
      reference,
      clinicName,
      clinicEmail,
      caseType,
      dueDate,
      status: status as CaseStatus,
      notificationStatus: notificationStatus as NotificationStatus,
      updatedAt,
    });
  }
  if (cases.length === 0 && raw.length > 0) return null;
  return cases;
}
