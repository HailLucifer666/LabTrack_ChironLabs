import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "labtrack-notify-"));

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

try {
  compileModule("types.ts", "types.mjs");
  compileModule("notify-decision.ts", "notify-decision.mjs", { "@/lib/types": "./types.mjs" });
  const { decideNotification, isSyntheticRecipient, previewNotice } = await import(
    pathToFileURL(path.join(outDir, "notify-decision.mjs")).href
  );

  const real = "frontdesk@brightsmile.dental";
  const synthetic = "clinic-demo@example.com";
  const decide = (email, databaseConfigured, providerConfigured) =>
    decideNotification({ clinicEmail: email }, { databaseConfigured, providerConfigured });

  // Full matrix: database × provider × recipient. Exactly one cell may send.
  const matrix = [
    // Demo workspace: preview in every combination — this is the audit's F2 guard.
    [synthetic, false, false, "preview", "demo-workspace"],
    [synthetic, false, true, "preview", "demo-workspace"],
    [real, false, false, "preview", "demo-workspace"],
    [real, false, true, "preview", "demo-workspace"],
    // Database-backed: provider gate, then placeholder gate, then send.
    [real, true, false, "preview", "provider-not-configured"],
    [synthetic, true, false, "preview", "provider-not-configured"],
    [synthetic, true, true, "preview", "synthetic-recipient"],
    [real, true, true, "send", undefined],
  ];
  for (const [email, databaseConfigured, providerConfigured, action, reason] of matrix) {
    const result = decide(email, databaseConfigured, providerConfigured);
    assert.equal(result.action, action, `${email} db=${databaseConfigured} provider=${providerConfigured}`);
    if (reason) assert.equal(result.reason, reason);
    if (action === "send") assert.equal(result.recipient, email, "Send must address exactly the validated recipient");
  }

  // The exact regression being fixed: credentials present while still in demo mode.
  assert.equal(
    decide(real, false, true).action,
    "preview",
    "A demo workspace must never send, even with RESEND_API_KEY configured",
  );

  // Placeholder detection is case-insensitive and suffix-anchored.
  assert.equal(isSyntheticRecipient("CLINIC@EXAMPLE.COM"), true);
  assert.equal(isSyntheticRecipient("clinic@example.com.evil.test"), false, "Suffix match must be anchored");
  assert.equal(isSyntheticRecipient("notexample@corp.io"), false);

  // Every preview reason maps to an explicit, non-empty disclosure.
  for (const reason of ["demo-workspace", "provider-not-configured", "synthetic-recipient"]) {
    const notice = previewNotice(reason);
    assert.ok(notice.includes("TEST MODE"), `${reason} must keep the TEST MODE disclosure`);
    assert.ok(notice.includes("no email was delivered"), `${reason} must state nothing was delivered`);
  }
  assert.ok(previewNotice("demo-workspace").includes("never send real email"));

  console.log("Notify-decision matrix passed: demo never sends (even with credentials); live send requires database + provider + real recipient.");
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
