import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDecklist } from "./parse-decklist";

test("parses quantity and name lines", () => {
  assert.deepEqual(parseDecklist("4 Lightning Bolt\n2 Counterspell"), [
    { quantity: 4, name: "Lightning Bolt", board: "main" },
    { quantity: 2, name: "Counterspell", board: "main" },
  ]);
});

test("accepts the x quantity suffix", () => {
  assert.deepEqual(parseDecklist("4x Lightning Bolt"), [
    { quantity: 4, name: "Lightning Bolt", board: "main" },
  ]);
});

test("ignores blank lines, comments, and unparseable lines", () => {
  assert.deepEqual(
    parseDecklist("\n// comment\nnot a card\n4\n0 Card\n-2 Card\n4 Card"),
    [{ quantity: 4, name: "Card", board: "main" }],
  );
});

test("switches boards on Sideboard and Mainboard headings", () => {
  assert.deepEqual(
    parseDecklist(
      "4 Main Card\nSideboard\n3 Side Card\nMainboard\n2 Main Again",
    ),
    [
      { quantity: 4, name: "Main Card", board: "main" },
      { quantity: 3, name: "Side Card", board: "side" },
      { quantity: 2, name: "Main Again", board: "main" },
    ],
  );
});

test("accepts side board as a heading", () => {
  assert.deepEqual(parseDecklist("Side Board\n1 Card"), [
    { quantity: 1, name: "Card", board: "side" },
  ]);
});

test("honours the SB: line prefix", () => {
  assert.deepEqual(
    parseDecklist("4 Main\nSB: 2 Side\nsb: 1 Lower Side"),
    [
      { quantity: 4, name: "Main", board: "main" },
      { quantity: 2, name: "Side", board: "side" },
      { quantity: 1, name: "Lower Side", board: "side" },
    ],
  );
});

test("uses the default board for the initial section", () => {
  assert.deepEqual(parseDecklist("2 Card", "side"), [
    { quantity: 2, name: "Card", board: "side" },
  ]);
});

test("strips set, collector, foil, and tag annotations", () => {
  assert.deepEqual(
    parseDecklist(
      [
        "4 Card (M21) 123",
        "3 Card (M21)",
        "2 Card *FOIL*",
        "1 Card #abc",
        "1 Card (M21) 123 *FOIL* #abc",
      ].join("\n"),
    ),
    [
      { quantity: 4, name: "Card", board: "main" },
      { quantity: 3, name: "Card", board: "main" },
      { quantity: 2, name: "Card", board: "main" },
      { quantity: 1, name: "Card", board: "main" },
      { quantity: 1, name: "Card", board: "main" },
    ],
  );
});

test("preserves card names containing slashes and punctuation", () => {
  assert.deepEqual(parseDecklist("4 Fire // Ice\n1 Ral, Monsoon Mage"), [
    { quantity: 4, name: "Fire // Ice", board: "main" },
    { quantity: 1, name: "Ral, Monsoon Mage", board: "main" },
  ]);
});

test("skips a line whose name is empty after cleaning", () => {
  assert.deepEqual(parseDecklist("4  \n1 Card"), [
    { quantity: 1, name: "Card", board: "main" },
  ]);
});

test("parses Windows line endings", () => {
  assert.deepEqual(parseDecklist("4 Card\r\n2 Other"), [
    { quantity: 4, name: "Card", board: "main" },
    { quantity: 2, name: "Other", board: "main" },
  ]);
});
