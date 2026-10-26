import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuery, isQueryEmpty } from "./search-syntax";

test("collects bare words as name terms", () => {
  const parsed = parseQuery("lightning bolt");
  assert.deepEqual(parsed.nameTerms, ["lightning", "bolt"]);
  assert.equal(isQueryEmpty(parsed), false);
});

test("parses exact-name syntax", () => {
  assert.equal(parseQuery('!"Counterspell"').exactName, "Counterspell");
  assert.equal(parseQuery("!Counterspell").exactName, "Counterspell");
});

test("parses type, color, and mana-value filters", () => {
  const parsed = parseQuery("t:creature c:ub cmc<=3");
  assert.deepEqual(parsed.types, ["creature"]);
  assert.deepEqual(parsed.colors, ["U", "B"]);
  assert.equal(parsed.cmcMax, 3);
  assert.equal(parsed.cmcMin, null);
});

test("color aliases and identity filters", () => {
  const parsed = parseQuery("c:white id:wu");
  assert.deepEqual(parsed.colors, ["W"]);
  assert.deepEqual(parsed.colorIdentity, ["W", "U"]);
});

test("quoted oracle text stays together", () => {
  const parsed = parseQuery('o:"draw a card"');
  assert.deepEqual(parsed.oracleTerms, ["draw a card"]);
});

test("rarity validates against the known set", () => {
  assert.deepEqual(parseQuery("r:common").rarities, ["common"]);
  const bad = parseQuery("r:legendary");
  assert.equal(bad.rarities.length, 0);
  assert.ok(bad.errors.length > 0);
});

test("a value-less filter falls back to a name term", () => {
  const parsed = parseQuery("t:");
  assert.deepEqual(parsed.types, []);
  assert.deepEqual(parsed.nameTerms, ["t:"]);
});

test("isQueryEmpty is true for whitespace-only input", () => {
  assert.equal(isQueryEmpty(parseQuery("   ")), true);
});
