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
  const { formatDateOnly, isCaseOverdue } = await import(pathToFileURL(tempFile).href);
  for (const timeZone of ["Asia/Kolkata", "Europe/London", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Honolulu"]) {
    process.env.TZ = timeZone;
    assert.equal(formatDateOnly("2026-10-29"), "29 Oct 2026", `Calendar date shifted in ${timeZone}`);
  }
  assert.equal(formatDateOnly("2026-02-03"), "3 Feb 2026");
  assert.equal(isCaseOverdue("2026-10-25", "IN_PROGRESS", "2026-10-27"), true);
  assert.equal(isCaseOverdue("2026-10-27", "IN_PROGRESS", "2026-10-27"), false);
  assert.equal(isCaseOverdue("2026-10-25", "READY", "2026-10-27"), false);
  console.log("Date-only smoke tests passed for five time zones and overdue boundaries.");
} finally {
  fs.rmSync(tempFile, { force: true });
}
