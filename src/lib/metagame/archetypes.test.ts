import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDeck, archetypeName } from "./archetypes";

test("classifies mono-blue delver from its core cards", () => {
  const result = classifyDeck(
    ["Delver of Secrets", "Counterspell", "Brainstorm", "Ponder"],
    ["U"],
  );
  assert.equal(result.slug, "delver");
});

test("classifies burn from burn spells", () => {
  const result = classifyDeck(
    ["Lightning Bolt", "Chain Lightning", "Fireblast", "Lava Spike"],
    ["R"],
  );
  assert.equal(result.slug, "burn");
});

test("classifies bogles from the hexproof shell", () => {
  const result = classifyDeck(
    ["Slippery Bogle", "Ethereal Armor", "Rancor", "Ancestral Mask"],
    ["W", "G"],
  );
  assert.equal(result.slug, "bogles");
});

test("spy combo requires Balustrade Spy", () => {
  const withSpy = classifyDeck(
    ["Balustrade Spy", "Dread Return", "Lotleth Giant"],
    ["B"],
  );
  assert.equal(withSpy.slug, "spy-combo");

  const withoutSpy = classifyDeck(["Dread Return", "Lotleth Giant"], ["B"]);
  assert.notEqual(withoutSpy.slug, "spy-combo");
});

test("respects colour gates (delver is mono-blue only)", () => {
  const monoblue = classifyDeck(
    ["Delver of Secrets", "Counterspell", "Brainstorm", "Ponder"],
    ["U"],
  );
  const izzet = classifyDeck(
    ["Delver of Secrets", "Counterspell", "Brainstorm", "Ponder"],
    ["U", "R"],
  );
  assert.equal(monoblue.slug, "delver");
  assert.notEqual(izzet.slug, "delver");
});

test("returns the fallback archetype when nothing matches", () => {
  const result = classifyDeck(["Some Unrelated Card"], ["W"]);
  assert.equal(result.slug, "other");
});

test("archetypeName returns a human label or the slug", () => {
  assert.equal(archetypeName("delver"), "Mono-Blue Delver");
  assert.equal(archetypeName("not-a-real-slug"), "not-a-real-slug");
});
