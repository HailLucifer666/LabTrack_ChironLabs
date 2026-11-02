import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/**
 * Shared smoke-test compiler: transpile one TS source file into an importable
 * .mjs sibling inside `outDir`, rewriting "@/..." alias imports to relative
 * paths so Node can resolve them. Used by every suite so the fixture plumbing
 * lives in exactly one place.
 */
export function compile(outDir, sourceFile, outputName, aliases = {}) {
  const source = fs.readFileSync(new URL(`../${sourceFile}`, import.meta.url), "utf8");
  let code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(aliases)) {
    code = code.split(`"${from}"`).join(`"${to}"`);
  }
  fs.writeFileSync(path.join(outDir, outputName), code, "utf8");
}
