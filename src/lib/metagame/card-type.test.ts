import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryFor, frontFace } from "./card-type";

test("frontFace returns the front side of a double-faced card", () => {
  assert.equal(
    frontFace("Enchantment — Saga // Enchantment Creature — Spirit"),
    "Enchantment — Saga",
  );
});

test("frontFace passes simple type lines through unchanged", () => {
  assert.equal(frontFace("Instant"), "Instant");
  assert.equal(frontFace(""), "");
  assert.equal(frontFace(null), "");
  assert.equal(frontFace(undefined), "");
});

test("categoryFor uses the front face only", () => {
  assert.equal(
    categoryFor("Enchantment — Saga // Enchantment Creature — Spirit"),
    "Enchantments",
  );
});

test("categoryFor keeps adventures on their creature front", () => {
  assert.equal(
    categoryFor("Creature — Human Wizard // Instant — Adventure"),
    "Creatures",
  );
});

test("categoryFor priority order", () => {
  assert.equal(categoryFor("Artifact Creature — Golem"), "Creatures");
  assert.equal(categoryFor("Artifact Land"), "Lands");
  assert.equal(categoryFor("Sorcery"), "Spells");
  assert.equal(categoryFor("Artifact"), "Artifacts");
  assert.equal(categoryFor("Enchantment — Aura"), "Enchantments");
  assert.equal(categoryFor(""), "Other");
});
