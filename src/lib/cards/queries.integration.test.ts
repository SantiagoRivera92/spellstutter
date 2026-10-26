import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Card, Printing } from "./types";
import { closeTestDb, connectTestDb, hasTestMongo } from "@/test/mongo";

const skip = !hasTestMongo();

function card(overrides: Partial<Card>): Card {
  return {
    oracle_id: "oracle",
    name: "Card",
    name_normalized: "card",
    layout: "normal",
    mana_cost: "{1}",
    cmc: 1,
    type_line: "Instant",
    oracle_text: "",
    colors: [],
    color_identity: [],
    keywords: [],
    rarity: "common",
    set: "tst",
    set_name: "Test Set",
    collector_number: "1",
    released_at: "2026-01-01",
    image_uris: {
      small: null,
      normal: null,
      large: null,
      art_crop: null,
    },
    card_faces: null,
    prices: { usd: null, usd_foil: null },
    edhrec_rank: null,
    scryfall_uri: "",
    mtgo_id: null,
    default_printing_id: "printing",
    metagame_printing_id: null,
    printings_count: 1,
    legalities: { pauper: "legal" },
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function printing(overrides: Partial<Printing>): Printing {
  return {
    scryfall_id: "printing",
    oracle_id: "oracle",
    name: "Card",
    set: "tst",
    set_name: "Test Set",
    collector_number: "1",
    rarity: "common",
    released_at: "2026-01-01",
    image_uris: {
      small: null,
      normal: null,
      large: null,
      art_crop: null,
    },
    card_faces: null,
    prices: { usd: null, usd_foil: null },
    finishes: [],
    promo: false,
    digital: false,
    mtgo_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const cards: Card[] = [
  card({
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    name_normalized: "lightning bolt",
    mana_cost: "{R}",
    cmc: 1,
    oracle_text: "Lightning Bolt deals 3 damage to any target.",
    colors: ["R"],
    color_identity: ["R"],
    rarity: "common",
    default_printing_id: "p-bolt",
    metagame_printing_id: "p-bolt",
    image_uris: {
      small: null,
      normal: "bolt.jpg",
      large: null,
      art_crop: "bolt-art",
    },
    prices: { usd: 1.5, usd_foil: 3 },
    mtgo_id: 101,
  }),
  card({
    oracle_id: "o-counter",
    name: "Counterspell",
    name_normalized: "counterspell",
    mana_cost: "{U}{U}",
    cmc: 2,
    oracle_text: "Counter target spell.",
    colors: ["U"],
    color_identity: ["U"],
    default_printing_id: "p-counter",
    prices: { usd: 0.5, usd_foil: null },
  }),
  card({
    oracle_id: "o-delver",
    name: "Delver of Secrets // Insectile Aberration",
    name_normalized: "delver of secrets // insectile aberration",
    mana_cost: "",
    cmc: 1,
    type_line: "Creature — Human Wizard // Creature — Human Insect",
    oracle_text: "",
    colors: ["U"],
    color_identity: ["U"],
    default_printing_id: "p-delver",
    image_uris: { small: null, normal: null, large: null, art_crop: null },
    card_faces: [
      {
        name: "Delver of Secrets",
        mana_cost: "{U}",
        type_line: "Creature — Human Wizard",
        oracle_text: "At the beginning of your upkeep, look at the top card of your library.",
        image_uris: {
          small: null,
          normal: "delver-face.jpg",
          large: null,
          art_crop: "delver-face-art",
        },
      },
    ],
  }),
  card({
    oracle_id: "o-pyro",
    name: "Pyroblast",
    name_normalized: "pyroblast",
    mana_cost: "{R}",
    cmc: 1,
    oracle_text: "Counter target blue spell or destroy target blue permanent.",
    colors: ["R"],
    color_identity: ["R"],
    rarity: "uncommon",
    default_printing_id: "p-pyro",
    prices: { usd: 2, usd_foil: null },
  }),
  card({
    oracle_id: "o-island",
    name: "Island",
    name_normalized: "island",
    mana_cost: "",
    cmc: 0,
    type_line: "Basic Land — Island",
    colors: [],
    color_identity: ["U"],
    rarity: "common",
    default_printing_id: "p-island",
    image_uris: {
      small: null,
      normal: "island.jpg",
      large: null,
      art_crop: "island-art",
    },
  }),
  card({
    oracle_id: "o-multi",
    name: "Azorius Skyguard",
    name_normalized: "azorius skyguard",
    mana_cost: "{1}{W}{U}",
    cmc: 3,
    type_line: "Creature — Bird Soldier",
    oracle_text: "Flying",
    colors: ["W", "U"],
    color_identity: ["W", "U"],
    keywords: ["Flying"],
    rarity: "rare",
    default_printing_id: "p-multi",
  }),
  card({
    oracle_id: "o-banned",
    name: "Banned Card",
    name_normalized: "banned card",
    legalities: { pauper: "banned" },
    default_printing_id: "p-banned",
  }),
];

const printings: Printing[] = [
  printing({
    scryfall_id: "p-bolt",
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    set: "lea",
    released_at: "1993-08-05",
    mtgo_id: 101,
    image_uris: {
      small: null,
      normal: "bolt-print.jpg",
      large: null,
      art_crop: "bolt-print-art",
    },
  }),
  printing({
    scryfall_id: "p-bolt-new",
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    set: "m10",
    released_at: "2009-07-17",
    mtgo_id: 102,
  }),
  printing({
    scryfall_id: "p-counter",
    oracle_id: "o-counter",
    name: "Counterspell",
    set: "tmp",
    released_at: "1997-10-14",
  }),
  printing({
    scryfall_id: "p-delver",
    oracle_id: "o-delver",
    name: "Delver of Secrets // Insectile Aberration",
    released_at: "2011-09-30",
  }),
  printing({
    scryfall_id: "p-pyro",
    oracle_id: "o-pyro",
    name: "Pyroblast",
    released_at: "1997-06-09",
  }),
  printing({
    scryfall_id: "p-island",
    oracle_id: "o-island",
    name: "Island",
    released_at: "1993-08-05",
  }),
  printing({
    scryfall_id: "p-multi",
    oracle_id: "o-multi",
    name: "Azorius Skyguard",
    released_at: "2019-01-25",
  }),
  printing({
    scryfall_id: "p-banned",
    oracle_id: "o-banned",
    name: "Banned Card",
    released_at: "2020-01-01",
  }),
];

describe("card queries", { skip }, () => {
  let queries: typeof import("./queries");
  let mongo: typeof import("@/lib/mongo/client");

  before(async () => {
    const db = await connectTestDb("cards");
    await db.collection("cards").insertMany(cards);
    await db.collection("printings").insertMany(printings);
    queries = await import("./queries");
    mongo = await import("@/lib/mongo/client");
  });

  after(async () => {
    await mongo.closeDb();
    await closeTestDb();
  });

  test("searchCards returns every card sorted by normalized name", async () => {
    const result = await queries.searchCards({});
    assert.equal(result.total, cards.length);
    assert.equal(result.page, 1);
    assert.equal(result.page_size, 50);
    assert.deepEqual(
      result.cards.map((entry) => entry.name),
      [
        "Azorius Skyguard",
        "Banned Card",
        "Counterspell",
        "Delver of Secrets // Insectile Aberration",
        "Island",
        "Lightning Bolt",
        "Pyroblast",
      ],
    );
  });

  test("searchCards matches name terms", async () => {
    const result = await queries.searchCards({ q: "lightning bolt" });
    assert.equal(result.total, 1);
    assert.equal(result.cards[0].oracle_id, "o-bolt");
  });

  test("searchCards supports exact names", async () => {
    const result = await queries.searchCards({ q: '!"Lightning Bolt"' });
    assert.equal(result.total, 1);
    assert.equal(result.cards[0].name, "Lightning Bolt");
  });

  test("searchCards filters by type", async () => {
    const result = await queries.searchCards({ q: "t:instant" });
    assert.deepEqual(
      result.cards.map((entry) => entry.name).sort(),
      ["Banned Card", "Counterspell", "Lightning Bolt", "Pyroblast"],
    );
  });

  test("searchCards filters by oracle text", async () => {
    const result = await queries.searchCards({ q: 'o:"counter target"' });
    assert.deepEqual(
      result.cards.map((entry) => entry.name).sort(),
      ["Counterspell", "Pyroblast"],
    );
  });

  test("searchCards filters by color and color identity", async () => {
    const byColor = await queries.searchCards({ q: "c:ub" });
    assert.deepEqual(
      byColor.cards.map((entry) => entry.name).sort(),
      ["Azorius Skyguard", "Counterspell", "Delver of Secrets // Insectile Aberration"],
    );

    const byIdentity = await queries.searchCards({ q: "id:u" });
    assert.deepEqual(
      byIdentity.cards.map((entry) => entry.name).sort(),
      [
        "Banned Card",
        "Counterspell",
        "Delver of Secrets // Insectile Aberration",
        "Island",
      ],
    );
  });

  test("searchCards filters by rarity and keyword", async () => {
    const rare = await queries.searchCards({ q: "r:rare" });
    assert.deepEqual(rare.cards.map((entry) => entry.name), ["Azorius Skyguard"]);

    const flying = await queries.searchCards({ q: "kw:flying" });
    assert.deepEqual(flying.cards.map((entry) => entry.name), ["Azorius Skyguard"]);
  });

  test("searchCards filters by mana value", async () => {
    const result = await queries.searchCards({ q: "cmc<=1" });
    assert.deepEqual(
      result.cards.map((entry) => entry.name).sort(),
      [
        "Banned Card",
        "Delver of Secrets // Insectile Aberration",
        "Island",
        "Lightning Bolt",
        "Pyroblast",
      ],
    );
  });

  test("searchCards sorts by cmc, price, rarity, and name direction", async () => {
    const byCmc = await queries.searchCards({ sort: "cmc" });
    assert.deepEqual(
      byCmc.cards.map((entry) => entry.mana_value),
      [0, 1, 1, 1, 1, 2, 3],
    );

    const byPrice = await queries.searchCards({ sort: "price", dir: "desc" });
    assert.equal(byPrice.cards[0].name, "Pyroblast");
    assert.equal(byPrice.cards[1].name, "Lightning Bolt");

    const byRarity = await queries.searchCards({ sort: "rarity" });
    assert.equal(byRarity.cards[0].rarity, "common");

    const byNameDesc = await queries.searchCards({ sort: "name", dir: "desc" });
    assert.equal(byNameDesc.cards[0].name, "Pyroblast");
    assert.equal(byNameDesc.cards.at(-1)?.name, "Azorius Skyguard");
  });

  test("searchCards clamps pagination", async () => {
    const result = await queries.searchCards({ page: 0, pageSize: 0 });
    assert.equal(result.page, 1);
    assert.equal(result.page_size, 1);
    assert.equal(result.cards.length, 1);

    const huge = await queries.searchCards({ pageSize: 500 });
    assert.equal(huge.page_size, 100);
  });

  test("searchCards maps card faces and pauper legality", async () => {
    const result = await queries.searchCards({ q: "delver" });
    const delver = result.cards[0];
    assert.equal(delver.pauper_legal, true);
    assert.equal(delver.mana_cost, "{U}");
    assert.deepEqual(delver.mana_costs, ["{U}"]);
    assert.equal(delver.type_line, "Creature — Human Wizard // Creature — Human Insect");
    assert.equal(delver.oracle_text, "At the beginning of your upkeep, look at the top card of your library.");
    assert.equal(delver.art_crop, "delver-face-art");
    assert.equal(delver.image_normal, "delver-face.jpg");
  });

  test("getCardByOracleId returns a card without _id", async () => {
    const found = await queries.getCardByOracleId("o-bolt");
    assert.ok(found);
    assert.equal(found.name, "Lightning Bolt");
    assert.equal("_id" in found, false);

    assert.equal(await queries.getCardByOracleId("missing"), null);
  });

  test("getCardsByOracleIds handles empty and missing ids", async () => {
    assert.deepEqual(await queries.getCardsByOracleIds([]), []);
    const found = await queries.getCardsByOracleIds(["o-bolt", "o-counter", "missing"]);
    assert.deepEqual(
      found.map((entry) => entry.name).sort(),
      ["Counterspell", "Lightning Bolt"],
    );
    assert.equal(found.some((entry) => "_id" in entry), false);
  });

  test("getCardsByNames normalizes names and ignores empties", async () => {
    assert.deepEqual(await queries.getCardsByNames([]), []);
    assert.deepEqual(await queries.getCardsByNames(["  ", ""]), []);
    const found = await queries.getCardsByNames(["  Lightning Bolt ", "COUNTERSPELL", "Missing"]);
    assert.deepEqual(
      found.map((entry) => entry.name).sort(),
      ["Counterspell", "Lightning Bolt"],
    );
  });

  test("getPrintingsByIds handles empty and returns matching printings", async () => {
    assert.deepEqual(await queries.getPrintingsByIds([]), []);
    const found = await queries.getPrintingsByIds(["p-bolt", "p-counter", "missing"]);
    assert.deepEqual(
      found.map((entry) => entry.scryfall_id).sort(),
      ["p-bolt", "p-counter"],
    );
    assert.equal(found.some((entry) => "_id" in entry), false);
  });

  test("getPrintings sorts printings newest first", async () => {
    const found = await queries.getPrintings("o-bolt");
    assert.deepEqual(
      found.map((entry) => entry.scryfall_id),
      ["p-bolt-new", "p-bolt"],
    );
  });

  test("getCardArtByName prefers the metagame printing art", async () => {
    assert.equal(await queries.getCardArtByName("Lightning Bolt"), "bolt-print-art");
    assert.equal(await queries.getCardArtByName("lightning bolt"), "bolt-print-art");
  });

  test("getCardArtByName falls back to face art and null", async () => {
    assert.equal(
      await queries.getCardArtByName("Delver of Secrets // Insectile Aberration"),
      "delver-face-art",
    );
    assert.equal(await queries.getCardArtByName("Island"), "island-art");
    assert.equal(await queries.getCardArtByName("Missing"), null);
  });
});
