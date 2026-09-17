#!/usr/bin/env node
// Enforces the purity rule for the on-device logic packages: zero runtime
// dependencies, and no React, fetch, localStorage, indexedDB, Date.now() or
// Math.random() anywhere in src/. Run from a package directory:
//
//     node ../../scripts/check-purity.mjs
//
// Used by packages/triage-engine (the clinical safety argument, ADR-0001) and
// packages/lexicon-matcher (the NLP layer that proposes symptom codes). Both
// must return the same output for the same input, every time, on any device.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const packageRoot = process.cwd();
const srcDir = join(packageRoot, "src");
const name = basename(packageRoot);

const errors = [];

const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
  errors.push(
    `package.json has runtime dependencies: ${Object.keys(pkg.dependencies).join(", ")}. ` +
      `packages/${name} must have zero runtime dependencies.`
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
  console.error(`${name} purity check failed:\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(`${name} purity check passed: zero runtime dependencies, no banned APIs.`);
