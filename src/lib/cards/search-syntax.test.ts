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

test("parses every mana-value comparison operator", () => {
  assert.equal(parseQuery("cmc<3").cmcMax, 2.5);
  assert.equal(parseQuery("cmc>3").cmcMin, 3.5);
  assert.equal(parseQuery("mv=4").cmcMin, 4);
  assert.equal(parseQuery("mv=4").cmcMax, 4);
  assert.equal(parseQuery("mv<=3.5").cmcMax, 3.5);
});

test("supports quoted type and keyword filters", () => {
  const parsed = parseQuery('t:"legendary creature" kw:flying');
  assert.deepEqual(parsed.types, ["legendary creature"]);
  assert.deepEqual(parsed.keywords, ["flying"]);
});

test("normalizes colors into WUBRG order and de-duplicates", () => {
  const parsed = parseQuery("c:gur c:u id:wubrg");
  assert.deepEqual(parsed.colors, ["U", "R", "G"]);
  assert.deepEqual(parsed.colorIdentity, ["W", "U", "B", "R", "G"]);
});

test("reports unknown colors", () => {
  const parsed = parseQuery("c:pink");
  assert.deepEqual(parsed.colors, []);
  assert.ok(parsed.errors.some((error) => error.includes("pink")));
});

test("ignores format filters that are implied by the catalog", () => {
  const parsed = parseQuery("legal:pauper banned:legacy f:commander");
  assert.deepEqual(parsed.nameTerms, []);
  assert.equal(isQueryEmpty(parsed), true);
});

test("accepts mixed-case rarity filters", () => {
  assert.deepEqual(parseQuery("r:MYTHIC").rarities, ["mythic"]);
});

test("collects multiple oracle terms", () => {
  const parsed = parseQuery('o:"draw a card" o:flying');
  assert.deepEqual(parsed.oracleTerms, ["draw a card", "flying"]);
});

test("isQueryEmpty is false for each filter category", () => {
  for (const query of [
    '!"Counterspell"',
    "bolt",
    "t:instant",
    "o:flying",
    "c:u",
    "id:wu",
    "kw:flying",
    "r:common",
    "cmc<=2",
  ]) {
    assert.equal(isQueryEmpty(parseQuery(query)), false, query);
  }
});
