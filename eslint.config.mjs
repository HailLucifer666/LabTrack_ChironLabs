import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // kee preflight checks the branch out into .worktrees/ with its own .next.
      // Without these, `npm run lint` in the main checkout scans generated types
      // and reports hundreds of errors in files nobody wrote.
      ".worktrees/**",
      ".cache/**",
    ],
  },
];

export default eslintConfig;
