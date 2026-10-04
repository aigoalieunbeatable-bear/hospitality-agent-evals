#!/usr/bin/env node
// Scores an agent's replies.
//
//   node bin/score.mjs replies.jsonl                      code-tier scores, the rest pending
//   node bin/score.mjs replies.jsonl --scores scores.json with a person's or judge's 0/1/2s
//   node bin/score.mjs replies.jsonl --sheet > review.md  a review sheet for the pending ones
//   node bin/score.mjs replies.jsonl --json               the full result as JSON
//
// replies.jsonl: one {"id": "pair-01", "reply": "..."} per line.
// scores.json:   {"pair-01": 2, "guest-03": 1, ...}

import { readFileSync } from "node:fs";
import { scoreScenario, summarise } from "../src/score.mjs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const venue = read("../data/venue.json");
const { categories, scenarios } = read("../data/scenarios.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const repliesPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--scores");
if (!repliesPath) {
  console.error("usage: node bin/score.mjs replies.jsonl [--scores scores.json] [--sheet | --json]");
  process.exit(2);
}

const replies = new Map();
for (const [n, line] of readFileSync(repliesPath, "utf8").split(/\r?\n/).entries()) {
  if (!line.trim()) continue;
  const row = JSON.parse(line);
  if (typeof row.id !== "string" || typeof row.reply !== "string") {
    throw new Error(`line ${n + 1}: expected {"id": string, "reply": string}`);
  }
  replies.set(row.id, row.reply);
}
const unknown = [...replies.keys()].filter((id) => !scenarios.some((s) => s.id === id));
if (unknown.length) throw new Error(`replies for scenarios that do not exist: ${unknown.join(", ")}`);

const given = option("--scores") ? JSON.parse(readFileSync(option("--scores"), "utf8")) : {};
const results = scenarios.map((s) => scoreScenario(s, replies.get(s.id), venue, categories, given[s.id]));
const summary = summarise(results, categories);

if (flag("--json")) {
  console.log(JSON.stringify({ venue: venue.id, summary, results }, null, 2));
} else if (flag("--sheet")) {
  console.log(`# Review sheet: ${venue.name}\n`);
  console.log("Score each reply 0, 1 or 2 against its rubric, then save the scores as {\"id\": score} JSON and pass them with --scores.\n");
  for (const r of results.filter((r) => r.score === null && r.pending !== "no reply")) {
    const scenario = scenarios.find((s) => s.id === r.id);
    const rubric = scenario.rubric
      ? [`- ${scenario.rubric}`]
      : Object.entries(categories[r.category].rubric).sort(([a], [b]) => b - a).map(([k, v]) => `- **${k}**: ${v}`);
    console.log(`## ${r.id} · ${r.categoryName} · ${r.probe}\n`);
    for (const turn of scenario.turns) console.log(`> **${turn.role}:** ${turn.content}\n>`);
    console.log(`\n**Reply:**\n\n${replies.get(r.id)}\n\n**Rubric (${r.pending}):**\n\n${rubric.join("\n")}\n\n**Score:** \n`);
  }
} else {
  const pad = (v, n) => String(v).padEnd(n);
  console.log(`${venue.name}: ${replies.size} of ${scenarios.length} scenarios answered\n`);
  console.log(`${pad("Category", 28)}${pad("Tier", 9)}${pad("Score", 9)}Pending`);
  for (const c of summary.categories) {
    console.log(`${pad(c.name, 28)}${pad(c.tier, 9)}${pad(c.possible ? `${c.scored}/${c.possible}` : "-", 9)}${c.pending}`);
  }
  console.log("");
  console.log(summary.overallPct === null
    ? `No overall score: ${summary.pending} scenarios still need a score. Run with --sheet to review them.`
    : `Overall: ${summary.scored}/${summary.possible} (${summary.overallPct.toFixed(1)}%)`);
  if (summary.wrongPrices.length) {
    console.log(`\nWrong prices (each fails its scenario):\n${summary.wrongPrices.map((w) => `  ${w}`).join("\n")}`);
  }
}
