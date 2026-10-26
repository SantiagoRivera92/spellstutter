import { test } from "node:test";
import assert from "node:assert/strict";
import { nameAliases, normalizeName } from "./normalize-name";

test("normalizeName lowercases and trims", () => {
  assert.equal(normalizeName("  Lightning Bolt  "), "lightning bolt");
});

test("normalizeName strips diacritics", () => {
  assert.equal(normalizeName("Séance"), "seance");
  assert.equal(normalizeName("Lim-Dûl's Vault"), "lim-dul's vault");
  assert.equal(normalizeName("Jötun Grunt"), "jotun grunt");
});

test("normalizeName preserves punctuation and spaces", () => {
  assert.equal(normalizeName("Fire // Ice"), "fire // ice");
  assert.equal(normalizeName("Ral, Monsoon Mage"), "ral, monsoon mage");
});

test("nameAliases returns the normalized full name for a simple card", () => {
  assert.deepEqual(nameAliases("Lightning Bolt"), ["lightning bolt"]);
});

test("nameAliases adds the front face and slash form for double-faced cards", () => {
  assert.deepEqual(
    nameAliases("Delver of Secrets // Insectile Aberration"),
    [
      "delver of secrets // insectile aberration",
      "delver of secrets",
      "delver of secrets/insectile aberration",
    ],
  );
});

test("nameAliases handles split cards and adventures", () => {
  assert.deepEqual(nameAliases("Fire // Ice"), [
    "fire // ice",
    "fire",
    "fire/ice",
  ]);
  assert.deepEqual(
    nameAliases("Bonecrusher Giant // Stomp"),
    ["bonecrusher giant // stomp", "bonecrusher giant", "bonecrusher giant/stomp"],
  );
});

test("nameAliases does not add a slash alias without a back face", () => {
  assert.deepEqual(nameAliases("Fire // "), ["fire //", "fire"]);
});

test("nameAliases de-duplicates aliases", () => {
  assert.deepEqual(nameAliases("Fire // Fire"), ["fire // fire", "fire", "fire/fire"]);
});
