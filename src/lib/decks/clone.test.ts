import { test } from "node:test";
import assert from "node:assert/strict";
import type { MetagameDeck } from "@/lib/metagame/types";
import { buildCloneRows } from "./clone";

function metagameDeck(overrides: Partial<MetagameDeck> = {}): MetagameDeck {
  return {
    event_slug: "event",
    event_name: "Event",
    event_type: "league",
    event_date: "2026-10-01",
    player: "player",
    rank: 1,
    wins: 5,
    losses: 0,
    color_identity: ["U"],
    mainboard: [],
    sideboard: [],
    archetype: { slug: "delver", name: "Delver", confidence: 1 },
    classification_version: "v1",
    scraped_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildCloneRows merges duplicate oracle ids within a board", () => {
  const { rows, skipped } = buildCloneRows(
    metagameDeck({
      mainboard: [
        { name: "Card", quantity: 2, oracle_id: "o1", printing_id: "p1" },
        { name: "Card", quantity: 3, oracle_id: "o1", printing_id: "p1" },
      ],
    }),
    "deck-1",
  );
  assert.deepEqual(skipped, []);
  assert.deepEqual(rows, [
    {
      deck_id: "deck-1",
      oracle_id: "o1",
      printing_id: "p1",
      card_name: "Card",
      quantity: 5,
      board: "main",
    },
  ]);
});

test("buildCloneRows keeps main and side entries separate", () => {
  const { rows } = buildCloneRows(
    metagameDeck({
      mainboard: [{ name: "Card", quantity: 4, oracle_id: "o1", printing_id: null }],
      sideboard: [{ name: "Card", quantity: 2, oracle_id: "o1", printing_id: null }],
    }),
    "deck-1",
  );
  assert.deepEqual(
    rows.map((row) => [row.board, row.quantity]),
    [
      ["main", 4],
      ["side", 2],
    ],
  );
});

test("buildCloneRows caps merged and initial quantities at 999", () => {
  const { rows } = buildCloneRows(
    metagameDeck({
      mainboard: [
        { name: "A", quantity: 999, oracle_id: "o1", printing_id: null },
        { name: "A", quantity: 10, oracle_id: "o1", printing_id: null },
        { name: "B", quantity: 1000, oracle_id: "o2", printing_id: null },
      ],
    }),
    "deck-1",
  );
  assert.deepEqual(
    rows.map((row) => [row.card_name, row.quantity]),
    [
      ["A", 999],
      ["B", 999],
    ],
  );
});

test("buildCloneRows skips unresolved cards and de-duplicates skipped names", () => {
  const { rows, skipped } = buildCloneRows(
    metagameDeck({
      mainboard: [
        { name: "Unknown", quantity: 1, oracle_id: null, printing_id: null },
        { name: "Unknown", quantity: 1, oracle_id: null, printing_id: null },
        { name: "Known", quantity: 1, oracle_id: "o1", printing_id: null },
      ],
      sideboard: [
        { name: "Unknown", quantity: 1, oracle_id: null, printing_id: null },
      ],
    }),
    "deck-1",
  );
  assert.deepEqual(skipped, ["Unknown"]);
  assert.deepEqual(
    rows.map((row) => row.card_name),
    ["Known"],
  );
});

test("buildCloneRows returns no rows for empty boards", () => {
  assert.deepEqual(buildCloneRows(metagameDeck(), "deck-1"), {
    rows: [],
    skipped: [],
  });
});
