import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

/**
 * Route-level proof, not just a unit proof.
 *
 * `test:notify` covers the pure send/preview decision. It cannot see the route,
 * so a regression that hard-codes `databaseConfigured: true` or restores the old
 * "provider configured + real address = send" condition would stay green. This
 * suite imports the actual route handlers with only the framework edges stubbed
 * (NextResponse, the Supabase client) and calls them with real Request objects.
 *
 * The decisive cell: database absent + provider credentials present + a real
 * clinic address must still return a test preview, and global fetch must never
 * be called. A mutant that sends turns the fetch stub into a throw and fails.
 */

const require = createRequire(import.meta.url);
const ts = require("typescript");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "labtrack-routes-"));

function compile(sourceFile, outputName, aliases = {}) {
  const source = fs.readFileSync(new URL(`../${sourceFile}`, import.meta.url), "utf8");
  let code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(aliases)) {
    code = code.split(`"${from}"`).join(`"${to}"`);
  }
  fs.writeFileSync(path.join(outDir, outputName), code, "utf8");
}

function writeStub(name, body) {
  fs.writeFileSync(path.join(outDir, name), body, "utf8");
}

const LIB_ALIASES = {
  "@/lib/types": "./types.mjs",
  "@/lib/date": "./date.mjs",
  "@/lib/notify-decision": "./notify-decision.mjs",
  "@/lib/seed-data": "./seed-data.mjs",
  "@/lib/case-mapping": "./case-mapping.mjs",
  "@/lib/demo-state": "./demo-state.mjs",
  "@/lib/supabase-server": "./supabase-server.mjs",
};

const savedEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  LAB_TIME_ZONE: process.env.LAB_TIME_ZONE,
};
const realFetch = globalThis.fetch;
const realWarn = console.warn;
let fetchCalls = 0;

try {
  // Framework edge: the only thing NextResponse.json needs to do here.
  writeStub("next-server.mjs", `export const NextResponse = {
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    },
  };`);
  // If the route ever tries to build a database client in demo mode, fail loudly.
  writeStub("supabase-js-stub.mjs", `export function createClient() {
    throw new Error("Supabase client must not be created in demo mode");
  }`);

  compile("lib/types.ts", "types.mjs");
  compile("lib/date.ts", "date.mjs");
  compile("lib/notify-decision.ts", "notify-decision.mjs", LIB_ALIASES);
  compile("lib/seed-data.ts", "seed-data.mjs", LIB_ALIASES);
  compile("lib/case-mapping.ts", "case-mapping.mjs", LIB_ALIASES);
  compile("lib/demo-state.ts", "demo-state.mjs", LIB_ALIASES);
  compile("lib/supabase-server.ts", "supabase-server.mjs", {
    ...LIB_ALIASES,
    "@supabase/supabase-js": "./supabase-js-stub.mjs",
  });
  compile("app/api/cases/route.ts", "cases-route.mjs", {
    ...LIB_ALIASES,
    "next/server": "./next-server.mjs",
  });
  compile("app/api/cases/[id]/notify/route.ts", "notify-route.mjs", {
    ...LIB_ALIASES,
    "next/server": "./next-server.mjs",
  });

  // Demo mode with credentials deliberately present: the exact regression cell.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.RESEND_API_KEY = "re_demo_probe_should_not_send";
  process.env.EMAIL_FROM = "LabTrack <lab@verified.example>";
  process.env.LAB_TIME_ZONE = "Not/AZone";

  globalThis.fetch = () => {
    fetchCalls += 1;
    throw new Error("email provider must never be called in demo mode");
  };
  let warnings = 0;
  console.warn = () => { warnings += 1; };

  const casesRoute = await import(pathToFileURL(path.join(outDir, "cases-route.mjs")).href);
  const notifyRoute = await import(pathToFileURL(path.join(outDir, "notify-route.mjs")).href);

  const getRes = await casesRoute.GET();
  const list = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(list.dataMode, "demo");
  assert.equal(list.cases.length, 6, "Demo seed list must still be intact");
  assert.equal(list.labTimeZone, "Asia/Kolkata", "An invalid LAB_TIME_ZONE must not be echoed back as if used");
  assert.match(list.todayDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(warnings >= 1, "Invalid zone must be reported on the server");

  const postCase = (body) => casesRoute.POST(new Request("http://labtrack.test/api/cases", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

  const good = await postCase({
    clinicName: "  Westside Dental  ",
    clinicEmail: " frontdesk@westside.dental ",
    caseType: "  Ceramic crown  ",
    dueDate: "2026-11-10",
  });
  const created = await good.json();
  assert.equal(good.status, 201);
  assert.equal(created.case.clinicName, "Westside Dental", "Stored name must be the validated, trimmed value");
  assert.equal(created.case.clinicEmail, "frontdesk@westside.dental");
  assert.equal(created.case.caseType, "Ceramic crown");
  assert.match(created.case.id, /^case-\d+$/);

  for (const [label, body] of [
    ["whitespace-only case type", { clinicName: "A", clinicEmail: "a@b.co", caseType: "   ", dueDate: "2026-11-10" }],
    ["whitespace-only clinic", { clinicName: "  ", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-11-10" }],
    ["malformed clinic email", { clinicName: "A", clinicEmail: "not-an-email", caseType: "Crown", dueDate: "2026-11-10" }],
    ["empty supplied id", { id: "  ", clinicName: "A", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-11-10" }],
    ["non-string supplied id", { id: 7, clinicName: "A", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-11-10" }],
    ["empty supplied reference", { reference: "  ", clinicName: "A", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-11-10" }],
    ["non-string supplied reference", { reference: 7, clinicName: "A", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-11-10" }],
    ["impossible calendar date", { clinicName: "A", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-02-31" }],
  ]) {
    const res = await postCase(body);
    assert.equal(res.status, 400, `${label} must be rejected`);
  }

  const collision = await postCase({ id: "case-1001", clinicName: "A", clinicEmail: "a@b.co", caseType: "Crown", dueDate: "2026-11-10" });
  assert.equal(collision.status, 409, "A demo case may not reuse a seeded id");

  const readyCase = {
    id: "case-9001",
    reference: "LT-9001",
    clinicName: "Bright Smile Dental",
    clinicEmail: "frontdesk@brightsmile.dental",
    caseType: "Zirconia crown",
    dueDate: "2026-10-29",
    status: "READY",
    notificationStatus: "NOT_SENT",
    updatedAt: "2026-10-27T08:00:00.000Z",
  };
  const notify = (caseId, body) => notifyRoute.POST(
    new Request(`http://labtrack.test/api/cases/${caseId}/notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: caseId }) },
  );

  const previewRes = await notify("case-9001", { case: readyCase });
  const preview = await previewRes.json();
  assert.equal(previewRes.status, 200, "Demo + credentials + real address must not fail, it must preview");
  assert.equal(preview.mode, "test", "Demo workspaces must never issue a live send");
  assert.equal(preview.status, "PREVIEWED");
  assert.equal(preview.email.to, "frontdesk@brightsmile.dental");
  assert.ok(preview.notice.includes("never send real email"), "The response must disclose why nothing was sent");
  assert.equal(fetchCalls, 0, "The email provider must not be contacted in demo mode");

  const malformedRes = await notify("case-9001", { case: { ...readyCase, caseType: { evil: "object" } } });
  assert.equal(malformedRes.status, 400, "A malformed case payload is a bad request, not a 500");

  const sentRes = await notify("case-9001", { case: { ...readyCase, notificationStatus: "SENT" } });
  const sent = await sentRes.json();
  assert.equal(sentRes.status, 409);
  assert.ok(sent.error.includes("demo case"), "Demo-mode duplicate message must not claim a live send");

  const notReadyRes = await notify("case-9001", { case: { ...readyCase, status: "IN_PROGRESS" } });
  assert.equal(notReadyRes.status, 409);

  const mismatchRes = await notify("case-9002", { case: readyCase });
  assert.equal(mismatchRes.status, 400, "A body case whose id does not match the URL must be rejected");

  const missingRes = await notify("ghost-9", {});
  assert.equal(missingRes.status, 404);

  assert.equal(fetchCalls, 0, "No path in this suite may call the email provider");

  console.log("Route tests passed: demo never sends even with provider credentials; malformed payloads are 400; POST trims and validates; invalid time zone is not echoed.");
} finally {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(outDir, { recursive: true, force: true });
}
