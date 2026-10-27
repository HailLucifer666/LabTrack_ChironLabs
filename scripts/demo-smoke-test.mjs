import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "labtrack-demo-"));

function compileModule(sourceFile, outputName, aliasMap = {}) {
  const source = fs.readFileSync(new URL(`../lib/${sourceFile}`, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [alias, target] of Object.entries(aliasMap)) {
    compiled = compiled.split(`"${alias}"`).join(`"${target}"`);
  }
  fs.writeFileSync(path.join(outDir, outputName), compiled, "utf8");
}

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
  compileModule("date.ts", "date.mjs");
  compileModule("types.ts", "types.mjs");
  compileModule("demo-state.ts", "demo-state.mjs", { "@/lib/date": "./date.mjs", "@/lib/types": "./types.mjs" });
  const { sanitizeStoredCases } = await import(pathToFileURL(path.join(outDir, "demo-state.mjs")).href);
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

  console.log("Demo-state sanitizer tests passed: hostile shapes, partial corruption, enums, calendar dates, dedupe.");
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
