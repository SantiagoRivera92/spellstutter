import { after, test } from "node:test";
import assert from "node:assert/strict";
import {
  deckSourceFilter,
  enabledSources,
  eventSourceFilter,
  isSourceEnabled,
  withDeckSources,
  withEventSources,
} from "./sources";

const ENV_NAMES = [
  "METAGAME_MTGO_ENABLED",
  "METAGAME_MELEE_ENABLED",
  "METAGAME_CARDSREALM_ENABLED",
  "METAGAME_MTGTOP8_ENABLED",
  "METAGAME_ENDSTEP_ENABLED",
] as const;

function clearEnv() {
  for (const name of ENV_NAMES) delete process.env[name];
}

after(clearEnv);

test("sources default to MTGO, Melee, Cardsrealm and MTGTop8 with endstep off", () => {
  clearEnv();
  assert.equal(isSourceEnabled("mtgo"), true);
  assert.equal(isSourceEnabled("melee"), true);
  assert.equal(isSourceEnabled("cardsrealm"), true);
  assert.equal(isSourceEnabled("mtgtop8"), true);
  assert.equal(isSourceEnabled("endstep"), false);
  assert.deepEqual(enabledSources(), [
    "mtgo",
    "melee",
    "cardsrealm",
    "mtgtop8",
  ]);
});

test("source env flags accept false-like values", () => {
  clearEnv();
  process.env.METAGAME_MELEE_ENABLED = "false";
  process.env.METAGAME_CARDSREALM_ENABLED = "0";
  process.env.METAGAME_MTGTOP8_ENABLED = "off";
  process.env.METAGAME_ENDSTEP_ENABLED = "YES";
  assert.equal(isSourceEnabled("melee"), false);
  assert.equal(isSourceEnabled("cardsrealm"), false);
  assert.equal(isSourceEnabled("mtgtop8"), false);
  assert.equal(isSourceEnabled("endstep"), true);
  assert.deepEqual(enabledSources(), ["mtgo", "endstep"]);
});

test("event filters exclude disabled sources", () => {
  clearEnv();
  process.env.METAGAME_MTGO_ENABLED = "false";
  process.env.METAGAME_CARDSREALM_ENABLED = "false";
  process.env.METAGAME_MTGTOP8_ENABLED = "false";

  const filter = eventSourceFilter();
  assert.deepEqual(filter, {
    $or: [{ $or: [{ slug: /^melee-/ }, { url: /melee\.gg/ }] }],
  });
  assert.deepEqual(withEventSources({ date: "2026-01-01" }), {
    $and: [
      { date: "2026-01-01" },
      { $or: [{ $or: [{ slug: /^melee-/ }, { url: /melee\.gg/ }] }] },
    ],
  });
});

test("deck filters exclude disabled sources", () => {
  clearEnv();
  process.env.METAGAME_MTGO_ENABLED = "false";
  process.env.METAGAME_CARDSREALM_ENABLED = "false";
  process.env.METAGAME_MTGTOP8_ENABLED = "false";

  assert.deepEqual(deckSourceFilter(), { event_slug: /^melee-/ });
  assert.deepEqual(withDeckSources({ "archetype.slug": "affinity" }), {
    $and: [
      { "archetype.slug": "affinity" },
      { event_slug: /^melee-/ },
    ],
  });
});

test("all event sources disabled hides everything", () => {
  clearEnv();
  process.env.METAGAME_MTGO_ENABLED = "false";
  process.env.METAGAME_MELEE_ENABLED = "false";
  process.env.METAGAME_CARDSREALM_ENABLED = "false";
  process.env.METAGAME_MTGTOP8_ENABLED = "false";
  assert.deepEqual(eventSourceFilter(), { slug: { $in: [] } });
  assert.deepEqual(deckSourceFilter(), { event_slug: { $in: [] } });
});

test("MTGTop8 filters select only MTGTop8 data", () => {
  clearEnv();
  process.env.METAGAME_MTGO_ENABLED = "false";
  process.env.METAGAME_MELEE_ENABLED = "false";
  process.env.METAGAME_CARDSREALM_ENABLED = "false";

  assert.deepEqual(eventSourceFilter(), {
    $or: [{ $or: [{ slug: /^mtgtop8-/ }, { url: /mtgtop8\.com/ }] }],
  });
  assert.deepEqual(deckSourceFilter(), { event_slug: /^mtgtop8-/ });
});
