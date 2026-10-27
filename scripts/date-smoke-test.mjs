import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(new URL("../lib/date.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tempFile = path.join(os.tmpdir(), `labtrack-date-${process.pid}.mjs`);
fs.writeFileSync(tempFile, compiled, "utf8");
try {
  const { formatDateOnly, isValidDateOnly, isCaseOverdue, todayDateInTimeZone } = await import(pathToFileURL(tempFile).href);

  // formatDateOnly must never route through an instant. The TZ loop below is
  // vacuous against today's pure-regex implementation by construction, but it
  // fails loudly if anyone reintroduces `new Date(isoDate)` here.
  for (const timeZone of ["Asia/Kolkata", "Europe/London", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Honolulu"]) {
    process.env.TZ = timeZone;
    assert.equal(formatDateOnly("2026-10-29"), "29 Oct 2026", `Calendar date shifted in ${timeZone}`);
  }
  assert.equal(formatDateOnly("2026-02-03"), "3 Feb 2026");
  assert.equal(isCaseOverdue("2026-10-25", "IN_PROGRESS", "2026-10-27"), true);
  assert.equal(isCaseOverdue("2026-10-27", "IN_PROGRESS", "2026-10-27"), false);
  assert.equal(isCaseOverdue("2026-10-25", "READY", "2026-10-27"), false);

  // Calendar-date validation (shared boundary for API and demo storage).
  assert.equal(isValidDateOnly("2026-10-29"), true);
  assert.equal(isValidDateOnly("2024-02-29"), true, "Leap day is valid");
  assert.equal(isValidDateOnly("2026-02-29"), false, "Non-leap Feb 29 is rejected");
  assert.equal(isValidDateOnly("2026-02-31"), false);
  assert.equal(isValidDateOnly("2026-13-01"), false);
  assert.equal(isValidDateOnly("2026-00-10"), false);
  assert.equal(isValidDateOnly("0999-12-31"), false, "Years below 1000 are rejected, not treated as plausible due dates");
  assert.equal(isValidDateOnly("2026-10-29T00:00:00Z"), false, "Only date-only strings are accepted");
  assert.equal(isValidDateOnly(20261029), false);

  // The overdue driver is time-zone sensitive; a fixed instant must cross the
  // calendar day between zones. 2026-10-27T23:30:00Z:
  //   Honolulu (UTC-10) still 27th; London (UTC+0) still 27th;
  //   Kolkata (UTC+5:30) and Kiritimati (UTC+14) already the 28th.
  const instant = new Date("2026-10-27T23:30:00Z");
  assert.equal(todayDateInTimeZone("Pacific/Honolulu", instant), "2026-10-27");
  assert.equal(todayDateInTimeZone("Europe/London", instant), "2026-10-27");
  assert.equal(todayDateInTimeZone("Asia/Kolkata", instant), "2026-10-28");
  assert.equal(todayDateInTimeZone("Pacific/Kiritimati", instant), "2026-10-28");

  // The configured zone is honoured when no argument is supplied.
  const previousZone = process.env.LAB_TIME_ZONE;
  process.env.LAB_TIME_ZONE = "Europe/London";
  try {
    assert.equal(todayDateInTimeZone(undefined, instant), "2026-10-27");
  } finally {
    if (previousZone === undefined) delete process.env.LAB_TIME_ZONE;
    else process.env.LAB_TIME_ZONE = previousZone;
  }

  // An invalid configured zone warns and falls back instead of throwing (the
  // old behaviour made every endpoint 500 on a typo in the env var).
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  try {
    assert.equal(todayDateInTimeZone("Not/AZone", instant), "2026-10-28", "Fallback uses the documented default zone");
    assert.equal(warned, true, "Invalid zone must be reported, not silently swallowed");
  } finally {
    console.warn = originalWarn;
  }

  console.log("Date tests passed: date-only formatting across five zones, calendar validation, TZ rollover at a fixed instant, env honouring, invalid-zone fallback.");
} finally {
  fs.rmSync(tempFile, { force: true });
}
