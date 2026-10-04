#!/usr/bin/env node
// Run before every push. Fails if any file names a real venue, employer or place
// this test set must not carry, or uses a dash the house style does not.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const FORBIDDEN = [
  "Calgary", "Vancouver", "Wilde", "Dorian", "Prologue", "AGLC", "Kendall", "Autograph",
  "Concord", "Michelin", "Origo", "Richmond", "Impark",
];
const DASHES = /[–—]/;
const SKIP = new Set([".git", "node_modules"]);
const SELF = "scripts/check-public.mjs";

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const problems = [];
for (const path of files(root)) {
  const rel = relative(root, path);
  if (rel === SELF) continue;
  const text = readFileSync(path, "utf8");
  for (const word of FORBIDDEN) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) problems.push(`${rel}: names ${word}`);
  }
  if (DASHES.test(text)) problems.push(`${rel}: contains an en or em dash`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("clean: no forbidden names, no en or em dashes");
