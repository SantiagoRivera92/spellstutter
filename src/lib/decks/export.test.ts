import { test } from "node:test";
import assert from "node:assert/strict";
import type { DeckCardView } from "./types";
import { deckToMtgoDek, deckToText } from "./export";

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
    mtgo_id: 1,
    colors: [],
    color_identity: [],
    art_crop: null,
    image_normal: null,
    price_usd: null,
    category_group: "Creature",
    ...overrides,
  };
}

test("deckToMtgoDek writes a valid deck skeleton", () => {
  const { text, missing } = deckToMtgoDek([]);
  assert.deepEqual(missing, []);
  assert.match(text, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(text, /<NetDeckID>0<\/NetDeckID>/);
  assert.match(text, /<PreconstructedDeckID>0<\/PreconstructedDeckID>/);
  assert.match(text, /<\/Deck>\n$/);
});

test("deckToMtgoDek writes maindeck and sideboard entries", () => {
  const { text, missing } = deckToMtgoDek([
    deckCard({ card_name: "Zap", quantity: 4, mtgo_id: 11 }),
    deckCard({
      card_name: "Counterspell",
      quantity: 2,
      board: "side",
      mtgo_id: 22,
    }),
  ]);
  assert.deepEqual(missing, []);
  assert.match(
    text,
    /<Cards CatID="11" Quantity="4" Sideboard="false" Name="Zap" Annotation="0" \/>/,
  );
  assert.match(
    text,
    /<Cards CatID="22" Quantity="2" Sideboard="true" Name="Counterspell" Annotation="0" \/>/,
  );
});

test("deckToMtgoDek sorts maindeck before sideboard, then by name", () => {
  const { text } = deckToMtgoDek([
    deckCard({ card_name: "Beta", mtgo_id: 2 }),
    deckCard({ card_name: "Alpha", mtgo_id: 1 }),
    deckCard({ card_name: "Side", board: "side", mtgo_id: 3 }),
  ]);
  const alpha = text.indexOf('Name="Alpha"');
  const beta = text.indexOf('Name="Beta"');
  const side = text.indexOf('Name="Side"');
  assert.ok(alpha < beta);
  assert.ok(beta < side);
});

test("deckToMtgoDek escapes XML-sensitive characters in names", () => {
  const { text } = deckToMtgoDek([
    deckCard({ card_name: `A&B <C> "D" 'E'`, mtgo_id: 1 }),
  ]);
  assert.match(
    text,
    /Name="A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;"/,
  );
});

test("deckToMtgoDek reports cards without an MTGO printing", () => {
  const { text, missing } = deckToMtgoDek([
    deckCard({ card_name: "Paper Only", mtgo_id: null }),
    deckCard({ card_name: "Paper Only", mtgo_id: null, board: "side" }),
    deckCard({ card_name: "Online", mtgo_id: 5 }),
  ]);
  assert.deepEqual(missing, ["Paper Only"]);
  assert.doesNotMatch(text, /Paper Only/);
  assert.match(text, /Name="Online"/);
});

test("deckToText groups maindeck cards by category and adds a sideboard", () => {
  const text = deckToText([
    deckCard({ card_name: "Zap", quantity: 4, category_group: "Instant" }),
    deckCard({ card_name: "Bear", quantity: 2, category_group: "Creature" }),
    deckCard({ card_name: "Island", quantity: 10, category_group: "Land" }),
    deckCard({
      card_name: "Pyroblast",
      quantity: 3,
      board: "side",
      category_group: "Instant",
    }),
  ]);
  assert.equal(
    text,
    [
      "// Creatures",
      "2 Bear",
      "",
      "// Instants",
      "4 Zap",
      "",
      "// Lands",
      "10 Island",
      "",
      "Sideboard",
      "3 Pyroblast",
      "",
    ].join("\n"),
  );
});

test("deckToText sorts cards by name within a category", () => {
  const text = deckToText([
    deckCard({ card_name: "Zeta", category_group: "Creature" }),
    deckCard({ card_name: "Alpha", category_group: "Creature" }),
    deckCard({ card_name: "Beta", category_group: "Creature" }),
  ]);
  assert.equal(text, "// Creatures\n1 Alpha\n1 Beta\n1 Zeta\n");
});

test("deckToText returns a newline for an empty deck", () => {
  assert.equal(deckToText([]), "\n");
});
