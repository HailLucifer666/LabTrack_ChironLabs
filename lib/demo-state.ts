import { isValidDateOnly } from "@/lib/date";
import type { CaseStatus, LabCase, NotificationStatus } from "@/lib/types";

/** localStorage key for the visitor's demo case list. */
export const DEMO_STORAGE_KEY = "labtrack-cases-v1";

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

/**
 * Persist the tour's demo cases. Storage is best-effort: a private-mode
 * browser or a full disk can make setItem throw, and the demo must stay usable
 * for the session anyway. The read side sanitizes whatever actually landed, so
 * a failed write can only cost persistence, never correctness.
 */
export function persistDemoCases(nextCases: LabCase[], storage: Pick<Storage, "setItem"> = globalThis.localStorage): void {
  try {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextCases));
  } catch {
    /* Demo remains usable for this session if storage is unavailable. */
  }
}

/** Best-effort counterpart to persistDemoCases, used by the demo reset flow. */
export function clearDemoCases(storage: Pick<Storage, "removeItem"> = globalThis.localStorage): void {
  try {
    storage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    /* Storage unavailable — reloading is still the right recovery. */
  }
}
