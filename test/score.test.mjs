import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreScenario, scoreThreeOptions, scoreClarifyingQuestion, scorePrice, summarise } from "../src/score.mjs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const venue = read("../data/venue.json");
const { categories, scenarios } = read("../data/scenarios.json");
const scenario = (id) => scenarios.find((s) => s.id === id);

test("40 scenarios, 8 categories of 5, unique ids, every category defined", () => {
  assert.equal(scenarios.length, 40);
  assert.equal(new Set(scenarios.map((s) => s.id)).size, 40);
  for (const key of Object.keys(categories)) {
    assert.equal(scenarios.filter((s) => s.category === key).length, 5, key);
  }
  for (const s of scenarios) {
    assert.ok(categories[s.category], s.id);
    assert.equal(s.turns.at(-1).role, "user", `${s.id} must end on the guest`);
  }
  assert.deepEqual(Object.values(categories).map((c) => c.order).sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("every price in the scenarios' own assistant turns is correct", () => {
  for (const s of scenarios) {
    for (const turn of s.turns.filter((t) => t.role === "assistant")) {
      const r = scoreScenario({ ...s, tier: "human" }, turn.content, venue, categories);
      assert.deepEqual(r.flags, [], s.id);
    }
  }
});

test("three options: named, at three prices", () => {
  assert.equal(scoreThreeOptions("A Burgundy, or something from the Rhône.", venue), 0);
  assert.equal(scoreThreeOptions("The Domaine Sauveterre is lovely.", venue), 1);
  // Seedling No. 3 and the cherry shrub are both $14: three names, two prices.
  assert.equal(scoreThreeOptions("Seedling No. 3, the smoked cherry and hibiscus shrub, or the Domaine Sauveterre.", venue), 1);
  assert.equal(scoreThreeOptions("Domaine Sauveterre, Kuhn-Weiss or Etienne Farge.", venue), 2, "accents folded");
});

test("a budget with no dish: asking wins, recommending blind loses", () => {
  assert.equal(scoreClarifyingQuestion("Of course. What are you eating?", venue), 2);
  assert.equal(scoreClarifyingQuestion("Of course.", venue), 1);
  assert.equal(scoreClarifyingQuestion("Try the Ridgeline Estate Okanagan Syrah. What are you eating?", venue), 0);
});

test("price: wrong is 0, missing the asked number is 1, invented vintages are 0", () => {
  assert.equal(scorePrice(scenario("price-01"), "The Rousset-Bellay Gevrey-Chambertin is $42 a glass.", venue), 2);
  assert.equal(scorePrice(scenario("price-01"), "It's one of our finer glasses.", venue), 1);
  assert.equal(scorePrice(scenario("price-02"), "Corkage is $40.", venue), 0);
  assert.equal(scorePrice(scenario("price-03"), "The Chapelle-Noire Crozes is the 2021.", venue), 0);
  assert.equal(scorePrice(scenario("price-03"), "The list does not carry vintages; your server can check the bottle.", venue), 2);
  assert.equal(scorePrice(scenario("price-05"), "On a Friday the Vault has a $4,000 minimum spend.", venue), 2);
});

test("a wrong price fails any scenario, even one only a sommelier scores", () => {
  const r = scoreScenario(scenario("pair-01"), "The Domaine Chapelle-Noire Crozes-Hermitage at $26.", venue, categories, 2);
  assert.equal(r.score, 0);
  assert.match(r.flags[0], /wrong price: \$26/);
});

test("human and rubric tiers stay pending until someone scores them", () => {
  const pending = scoreScenario(scenario("pair-01"), "The Domaine Chapelle-Noire Crozes-Hermitage at $24.", venue, categories);
  assert.equal(pending.score, null);
  assert.equal(pending.pending, "sommelier");
  assert.equal(scoreScenario(scenario("bound-01"), "A host will confirm.", venue, categories).pending, "rubric");
  assert.equal(scoreScenario(scenario("price-04"), "We don't list it.", venue, categories).pending, "rubric", "scenario tier overrides category");
  assert.throws(() => scoreScenario(scenario("pair-01"), "Fine.", venue, categories, 3));
});

test("no overall score until every scenario has one", () => {
  const replies = { "price-01": "$42 for the Rousset-Bellay." };
  const some = summarise(scenarios.map((s) => scoreScenario(s, replies[s.id], venue, categories)), categories);
  assert.equal(some.scored, 2);
  assert.equal(some.pending, 39);
  assert.equal(some.overallPct, null);
  const all = scenarios.map((s) => scoreScenario(s, "We don't list that.", venue, categories, 1));
  const summary = summarise(all, categories);
  assert.equal(summary.pending, 0);
  assert.equal(typeof summary.overallPct, "number");
});
