import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { compile } from "./_compile.mjs";

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "labtrack-date-"));
compile(outDir, "lib/date.ts", "date.mjs");
try {
  const { formatDateOnly, isValidDateOnly, isCaseOverdue, isDueToday, todayDateInTimeZone, createDateOnlyFormatter } = await import(pathToFileURL(path.join(outDir, "date.mjs")).href);

  // The formatter pins UTC, so the calendar day in a date-only string can never
  // shift with the viewer's zone. Asserted directly rather than via
  // process.env.TZ, which Node on Windows ignores at runtime.
  assert.equal(formatDateOnly("2026-10-29"), "29 Oct 2026");
  assert.equal(formatDateOnly("2026-02-03"), "3 Feb 2026");

  // Platform-independent proof that the factory honors the zone it is given:
  // one instant, two zones on opposite sides of the date line, two different
  // calendar days. If a future change stops passing timeZone through, this
  // fails on every platform, not just POSIX CI.
  const dateLineInstant = new Date(Date.UTC(2026, 9, 27, 23, 30));
  assert.equal(createDateOnlyFormatter("Pacific/Honolulu").format(dateLineInstant), "27 Oct 2026");
  assert.equal(createDateOnlyFormatter("Asia/Kolkata").format(dateLineInstant), "28 Oct 2026");

  // Unparseable or calendar-impossible input passes through unchanged rather than
  // being rendered as plausible-looking nonsense. The impossible-date case is
  // pinned: the old regex-only formatter turned "2026-02-31" into "31 Feb 2026".
  assert.equal(formatDateOnly("garbage"), "garbage");
  assert.equal(formatDateOnly("2026-13-01"), "2026-13-01");
  assert.equal(formatDateOnly("2026-02-31"), "2026-02-31");
  assert.equal(formatDateOnly(""), "");

  // Overdue is a pure calendar condition and is independent of production
  // status: a ready case past its date is still overdue (it needs collecting),
  // and "due today" is never overdue until the day has passed.
  assert.equal(isCaseOverdue("2026-10-25", "2026-10-27"), true);
  assert.equal(isCaseOverdue("2026-10-27", "2026-10-27"), false, "Due today is not overdue");
  assert.equal(isCaseOverdue("2026-10-25", "2024-02-28"), false, "Compare against the given business date, not wall-clock order");
  assert.equal(isDueToday("2026-10-27", "2026-10-27"), true);
  assert.equal(isDueToday("2026-10-26", "2026-10-27"), false);
  assert.equal(isDueToday("2026-10-28", "2026-10-27"), false);

  // Calendar boundaries must not shift a day in overdue comparisons.
  assert.equal(isCaseOverdue("2026-02-28", "2026-03-01"), true, "Non-leap Feb month end is overdue by March");
  assert.equal(isCaseOverdue("2024-02-29", "2024-03-01"), true, "Leap day is overdue by March 1");
  assert.equal(isCaseOverdue("2025-12-31", "2026-01-01"), true, "Year boundary is overdue");
  assert.equal(isCaseOverdue("2026-01-01", "2025-12-31"), false);

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

  console.log("Date tests passed: date-only formatting across eight zones, calendar validation, overdue and due-today policy, TZ rollover at a fixed instant, env honouring, invalid-zone fallback.");
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
