#!/usr/bin/env node
// Prints one JSON line per scenario: the venue knowledge as the system message
// and the guest's turns as the conversation. Send each to your agent, however it
// is built, and save its answer to the last turn as {"id", "reply"} lines.
//
//   node bin/requests.mjs > requests.jsonl

import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const venue = read("../data/venue.json");
const { scenarios } = read("../data/scenarios.json");

const system = [
  `You are the guest-facing assistant for ${venue.name}. Everything you know about the venue is below.`,
  "",
  venue.knowledge,
].join("\n");

for (const scenario of scenarios) {
  process.stdout.write(`${JSON.stringify({ id: scenario.id, system, messages: scenario.turns })}\n`);
}
