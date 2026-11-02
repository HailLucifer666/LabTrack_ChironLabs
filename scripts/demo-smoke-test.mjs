import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { compile } from "./_compile.mjs";

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "labtrack-demo-"));

const validCase = (overrides = {}) => ({
  id: "case-1",
  reference: "LT-1",
  clinicName: "Clinic",
  clinicEmail: "clinic@example.com",
  caseType: "Zirconia crown",
  dueDate: "2026-10-29",
  status: "IN_PROGRESS",
  notificationStatus: "NOT_SENT",
  updatedAt: "2026-10-27T08:15:00.000Z",
  ...overrides,
});

try {
  compile(outDir, "lib/date.ts", "date.mjs");
  compile(outDir, "lib/types.ts", "types.mjs");
  compile(outDir, "lib/demo-state.ts", "demo-state.mjs", { "@/lib/date": "./date.mjs", "@/lib/types": "./types.mjs" });
  const { sanitizeStoredCases, persistDemoCases, clearDemoCases } = await import(pathToFileURL(path.join(outDir, "demo-state.mjs")).href);
  const { isValidDateOnly } = await import(pathToFileURL(path.join(outDir, "date.mjs")).href);

  // Unusable shapes fall back to seeded data (null).
  for (const raw of [null, undefined, 42, "text", {}, { cases: [] }]) {
    assert.equal(sanitizeStoredCases(raw), null, `Expected null for ${JSON.stringify(raw)}`);
  }

  // A well-formed list passes through untouched.
  const good = [validCase(), validCase({ id: "case-2", reference: "LT-2" })];
  assert.deepEqual(sanitizeStoredCases(good), good);

  // The crash shape from the audit: one non-string field among valid rows.
  const mixed = [validCase(), validCase({ id: "case-3", caseType: { evil: "object" } })];
  assert.deepEqual(sanitizeStoredCases(mixed), [validCase()], "Malformed row must be dropped, valid rows kept");

  // A list where every entry is corrupt is unusable (fall back to seeds).
  assert.equal(sanitizeStoredCases([validCase({ caseType: 42 }), { nonsense: true }]), null);

  // A legitimately empty list stays empty.
  assert.deepEqual(sanitizeStoredCases([]), []);

  // Enum and field-level validation.
  assert.equal(sanitizeStoredCases([validCase({ status: "DONE" })]), null);
  assert.equal(sanitizeStoredCases([validCase({ notificationStatus: "MAYBE" })]), null);
  assert.equal(sanitizeStoredCases([validCase({ dueDate: "2026-2-3" })]), null);
  assert.equal(sanitizeStoredCases([validCase({ dueDate: "2026-02-31" })]), null, "Impossible calendar dates are rejected");
  assert.equal(sanitizeStoredCases([validCase({ id: "" })]), null);
  assert.equal(sanitizeStoredCases([validCase({ reference: 7 })]), null);

  // Duplicate ids: first occurrence wins, no duplicate React keys.
  const deduped = sanitizeStoredCases([validCase(), validCase({ reference: "LT-DUP" })]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].reference, "LT-1");

  // Calendar-date validation in isolation (boundary used by the API routes too).
  assert.equal(isValidDateOnly("2026-10-29"), true);
  assert.equal(isValidDateOnly("2024-02-29"), true, "Leap day is valid");
  assert.equal(isValidDateOnly("2026-02-29"), false, "Non-leap Feb 29 is rejected");
  assert.equal(isValidDateOnly("2026-02-31"), false);
  assert.equal(isValidDateOnly("2026-13-01"), false);
  assert.equal(isValidDateOnly("2026-00-10"), false);
  assert.equal(isValidDateOnly("2026-10-29T00:00:00Z"), false, "Only date-only strings are accepted");
  assert.equal(isValidDateOnly(20261029), false);

  // Persistence helpers must write the exact shared key, survive a throwing
  // storage (private-mode / quota), and clear the same key again.
  const stored = [];
  const goodStorage = {
    setItem(key, value) { stored.push([key, String(value)]); },
    removeItem(key) {
      const index = stored.findIndex(([entryKey]) => entryKey === key);
      if (index !== -1) stored.splice(index, 1);
    },
  };
  const throwingStorage = {
    setItem() { throw new Error("quota exceeded"); },
    removeItem() { throw new Error("storage unavailable"); },
  };
  persistDemoCases([validCase()], goodStorage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0][0], "labtrack-cases-v1", "Persistence must use the shared DEMO_STORAGE_KEY");
  assert.equal(stored[0][1], JSON.stringify([validCase()]));
  persistDemoCases([validCase({ id: "case-2" })], goodStorage);
  assert.equal(stored.length, 2);
  clearDemoCases(goodStorage);
  assert.equal(stored.length, 1, "clear must remove the demo key, not unrelated keys");
  persistDemoCases([validCase()], throwingStorage); // must not throw
  clearDemoCases(throwingStorage); // must not throw

  console.log("Demo-state tests passed: hostile shapes, partial corruption, enums, calendar dates, dedupe, persist/clear with good and throwing storage.");
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
