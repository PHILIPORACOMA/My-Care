#!/usr/bin/env node
// Enforces the project rule that packages/triage-engine has zero runtime
// dependencies and never touches React, fetch, localStorage, indexedDB,
// Date.now(), or Math.random(). Run via `npm run purity`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(packageRoot, "src");

const errors = [];

const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
  errors.push(
    `package.json has runtime dependencies: ${Object.keys(pkg.dependencies).join(", ")}. ` +
      "packages/triage-engine must have zero runtime dependencies."
  );
}

const BANNED_PATTERNS = [
  { pattern: /from\s+["']react["']/, label: "import from 'react'" },
  { pattern: /\bfetch\s*\(/, label: "fetch(...)" },
  { pattern: /\blocalStorage\b/, label: "localStorage" },
  { pattern: /\bindexedDB\b/, label: "indexedDB" },
  { pattern: /\bDate\.now\s*\(/, label: "Date.now()" },
  { pattern: /\bMath\.random\s*\(/, label: "Math.random()" },
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

for (const file of walk(srcDir)) {
  const contents = readFileSync(file, "utf8");
  for (const { pattern, label } of BANNED_PATTERNS) {
    if (pattern.test(contents)) {
      errors.push(`${file}: contains banned API ${label}`);
    }
  }
}

if (errors.length > 0) {
  console.error("engine-purity check failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log("engine-purity check passed: zero runtime dependencies, no banned APIs.");
