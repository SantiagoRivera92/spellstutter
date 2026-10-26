import { test } from "node:test";
import assert from "node:assert/strict";
import type { CardCategory, DeckCardView } from "./types";
import {
  CATEGORY_ORDER,
  compareDeckCards,
  computeDeckStats,
  deriveCategory,
  groupByCategory,
} from "./utils";

function deckCard(overrides: Partial<DeckCardView> = {}): DeckCardView {
  return {
    id: "card-1",
    deck_id: "deck-1",
    oracle_id: "oracle-1",
    printing_id: null,
    card_name: "Card",
    quantity: 1,
    board: "main",
    category: null,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    mana_cost: "{1}",
    mana_costs: [],
    mana_value: 1,
    type_line: "Creature",
    oracle_text: "",
    rarity: "common",
    mtgo_id: null,
    colors: [],
    color_identity: [],
    art_crop: null,
    image_normal: null,
    price_usd: null,
    category_group: "Creature",
    ...overrides,
  };
}

test("deriveCategory uses the front face and type priority", () => {
  const cases: [string, CardCategory][] = [
    ["Creature — Human Wizard", "Creature"],
    ["Artifact Creature — Golem", "Creature"],
    ["Enchantment Creature — Spirit", "Creature"],
    ["Planeswalker — Jace", "Planeswalker"],
    ["Artifact Land", "Land"],
    ["Basic Snow Land — Island", "Land"],
    ["Instant", "Instant"],
    ["Sorcery", "Sorcery"],
    ["Enchantment — Aura", "Enchantment"],
    ["Artifact", "Artifact"],
    ["Battle — Siege", "Battle"],
    ["Tribal — Elf", "Other"],
    ["", "Other"],
    ["Creature // Instant", "Creature"],
    ["Instant // Creature", "Instant"],
  ];
  for (const [typeLine, expected] of cases) {
    assert.equal(deriveCategory(typeLine), expected, typeLine);
  }
});

test("computeDeckStats counts boards and totals", () => {
  const stats = computeDeckStats([
    deckCard({ quantity: 4, board: "main" }),
    deckCard({ quantity: 2, board: "side" }),
  ]);
  assert.equal(stats.main_count, 4);
  assert.equal(stats.side_count, 2);
  assert.equal(stats.total_count, 6);
});

test("computeDeckStats computes average mana value for maindeck nonlands", () => {
  const stats = computeDeckStats([
    deckCard({ quantity: 2, mana_value: 1 }),
    deckCard({ quantity: 2, mana_value: 3 }),
    deckCard({ quantity: 4, category_group: "Land", mana_value: 0 }),
    deckCard({ quantity: 2, board: "side", mana_value: 10 }),
  ]);
  assert.equal(stats.average_mana_value, 2);
});

test("computeDeckStats returns zero average when there are no nonlands", () => {
  const stats = computeDeckStats([
    deckCard({ quantity: 20, category_group: "Land", mana_value: 0 }),
  ]);
  assert.equal(stats.average_mana_value, 0);
});

test("computeDeckStats totals prices across both boards and ignores nulls", () => {
  const stats = computeDeckStats([
    deckCard({ quantity: 2, price_usd: 1.5 }),
    deckCard({ quantity: 1, price_usd: null }),
    deckCard({ quantity: 3, board: "side", price_usd: 0.25 }),
  ]);
  assert.equal(stats.total_price, 3.75);
});

test("computeDeckStats builds the curve from maindeck nonlands only", () => {
  const stats = computeDeckStats([
    deckCard({ quantity: 4, mana_value: 1 }),
    deckCard({ quantity: 3, mana_value: 2 }),
    deckCard({ quantity: 2, mana_value: 3 }),
    deckCard({ quantity: 1, mana_value: 4 }),
    deckCard({ quantity: 1, mana_value: 5 }),
    deckCard({ quantity: 2, mana_value: 6 }),
    deckCard({ quantity: 4, category_group: "Land", mana_value: 0 }),
    deckCard({ quantity: 2, board: "side", mana_value: 2 }),
  ]);
  assert.deepEqual(stats.curve, [
    { bucket: "1 or less", count: 4 },
    { bucket: "2", count: 3 },
    { bucket: "3", count: 2 },
    { bucket: "4", count: 1 },
    { bucket: "5", count: 1 },
    { bucket: "6+", count: 2 },
  ]);
});

test("computeDeckStats counts colors in WUBRG order for maindeck nonlands", () => {
  const stats = computeDeckStats([
    deckCard({ quantity: 2, colors: ["G", "U"] }),
    deckCard({ quantity: 3, colors: ["U"] }),
    deckCard({ quantity: 4, colors: ["R"] }),
    deckCard({ quantity: 1, board: "side", colors: ["W"] }),
    deckCard({ quantity: 2, category_group: "Land", colors: ["B"] }),
  ]);
  assert.deepEqual(stats.color_counts, [
    { color: "W", count: 0 },
    { color: "U", count: 5 },
    { color: "B", count: 0 },
    { color: "R", count: 4 },
    { color: "G", count: 2 },
  ]);
});

test("compareDeckCards orders by category, mana value, quantity, then name", () => {
  const cards = [
    deckCard({ card_name: "Z", category_group: "Land", mana_value: 0 }),
    deckCard({ card_name: "B", category_group: "Creature", mana_value: 2, quantity: 2 }),
    deckCard({ card_name: "A", category_group: "Creature", mana_value: 2, quantity: 2 }),
    deckCard({ card_name: "C", category_group: "Creature", mana_value: 2, quantity: 4 }),
    deckCard({ card_name: "D", category_group: "Creature", mana_value: 1, quantity: 1 }),
    deckCard({ card_name: "E", category_group: "Instant", mana_value: 1, quantity: 1 }),
  ];
  assert.deepEqual(
    [...cards].sort(compareDeckCards).map((card) => card.card_name),
    ["D", "C", "A", "B", "E", "Z"],
  );
});

test("groupByCategory keeps only present categories in category order", () => {
  const groups = groupByCategory([
    deckCard({ card_name: "Land", category_group: "Land" }),
    deckCard({ card_name: "Creature", category_group: "Creature" }),
    deckCard({ card_name: "Instant", category_group: "Instant" }),
  ]);
  assert.deepEqual(
    groups.map((group) => group.category),
    ["Creature", "Instant", "Land"],
  );
  assert.deepEqual(
    groups.map((group) => group.cards.map((card) => card.card_name)),
    [["Creature"], ["Instant"], ["Land"]],
  );
});

test("CATEGORY_ORDER lists every category once", () => {
  assert.equal(new Set(CATEGORY_ORDER).size, CATEGORY_ORDER.length);
});
