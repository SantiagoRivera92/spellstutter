import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBetterCanonical,
  isBetterEarliestPrinting,
  isBetterMetagamePrinting,
  isScryfallPauperLegal,
  normalizeImages,
  printingRank,
  scryfallToCanonical,
  scryfallToPrinting,
  toPrice,
  type PrintingRank,
  type ScryfallCard,
} from "./normalize";

const NOW = "2026-10-26T00:00:00.000Z";

function card(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: "scryfall-id",
    oracle_id: "oracle-id",
    name: "Lightning Bolt",
    layout: "normal",
    mana_cost: "{R}",
    cmc: 1,
    type_line: "Instant",
    oracle_text: "Lightning Bolt deals 3 damage to any target.",
    colors: ["R"],
    color_identity: ["R"],
    keywords: [],
    rarity: "common",
    set: "lea",
    set_name: "Limited Edition Alpha",
    collector_number: "161",
    released_at: "1993-08-05",
    image_uris: {
      small: "small.jpg",
      normal: "normal.jpg",
      large: "large.jpg",
      art_crop: "art.jpg",
    },
    prices: { usd: "1.50", usd_foil: null },
    edhrec_rank: 123,
    scryfall_uri: "https://scryfall.com/card/lea/161",
    mtgo_id: 1234,
    legalities: { pauper: "legal", legacy: "legal", vintage: "restricted" },
    finishes: ["nonfoil", "foil"],
    promo: false,
    digital: false,
    ...overrides,
  };
}

test("normalizeImages maps optional image URLs to null", () => {
  assert.deepEqual(normalizeImages(), {
    small: null,
    normal: null,
    large: null,
    art_crop: null,
  });
  assert.deepEqual(normalizeImages({ normal: "n.jpg" }), {
    small: null,
    normal: "n.jpg",
    large: null,
    art_crop: null,
  });
});

test("toPrice parses numeric strings and rejects missing or invalid values", () => {
  assert.equal(toPrice("1.25"), 1.25);
  assert.equal(toPrice("0"), 0);
  assert.equal(toPrice("-2.5"), -2.5);
  assert.equal(toPrice(null), null);
  assert.equal(toPrice(undefined), null);
  assert.equal(toPrice(""), null);
  assert.equal(toPrice("not-a-number"), null);
});

test("isScryfallPauperLegal reads the pauper legality", () => {
  assert.equal(isScryfallPauperLegal(card()), true);
  assert.equal(
    isScryfallPauperLegal(card({ legalities: { pauper: "banned" } })),
    false,
  );
  assert.equal(isScryfallPauperLegal(card({ legalities: {} })), false);
});

test("scryfallToPrinting normalizes printing fields", () => {
  const printing = scryfallToPrinting(card(), NOW);
  assert.equal(printing.scryfall_id, "scryfall-id");
  assert.equal(printing.oracle_id, "oracle-id");
  assert.equal(printing.name, "Lightning Bolt");
  assert.equal(printing.set, "lea");
  assert.equal(printing.set_name, "Limited Edition Alpha");
  assert.equal(printing.collector_number, "161");
  assert.equal(printing.rarity, "common");
  assert.equal(printing.released_at, "1993-08-05");
  assert.deepEqual(printing.prices, { usd: 1.5, usd_foil: null });
  assert.deepEqual(printing.finishes, ["nonfoil", "foil"]);
  assert.equal(printing.mtgo_id, 1234);
  assert.equal(printing.updated_at, NOW);
  assert.equal(printing.card_faces, null);
});

test("scryfallToPrinting keeps double-faced card art", () => {
  const printing = scryfallToPrinting(
    card({
      card_faces: [
        { name: "Front", image_uris: { normal: "front.jpg" } },
        { name: "Back", image_uris: { normal: "back.jpg" } },
      ],
      image_uris: undefined,
    }),
    NOW,
  );
  assert.deepEqual(printing.card_faces, [
    {
      name: "Front",
      image_uris: {
        small: null,
        normal: "front.jpg",
        large: null,
        art_crop: null,
      },
    },
    {
      name: "Back",
      image_uris: {
        small: null,
        normal: "back.jpg",
        large: null,
        art_crop: null,
      },
    },
  ]);
  assert.equal(printing.image_uris.normal, null);
});

test("scryfallToCanonical normalizes a card", () => {
  const canonical = scryfallToCanonical(card(), NOW);
  assert.equal(canonical.oracle_id, "oracle-id");
  assert.equal(canonical.name_normalized, "lightning bolt");
  assert.equal(canonical.layout, "normal");
  assert.equal(canonical.cmc, 1);
  assert.deepEqual(canonical.colors, ["R"]);
  assert.deepEqual(canonical.color_identity, ["R"]);
  assert.deepEqual(canonical.legalities, {
    pauper: "legal",
    legacy: "legal",
    vintage: "restricted",
  });
  assert.equal(canonical.default_printing_id, "scryfall-id");
  assert.equal(canonical.metagame_printing_id, null);
  assert.equal(canonical.printings_count, 0);
  assert.equal(canonical.mtgo_id, 1234);
  assert.equal(canonical.updated_at, NOW);
});

test("scryfallToCanonical applies defaults and filters unknown legalities", () => {
  const canonical = scryfallToCanonical(
    card({
      oracle_id: undefined,
      layout: undefined,
      mana_cost: undefined,
      cmc: undefined,
      type_line: undefined,
      oracle_text: undefined,
      colors: undefined,
      color_identity: undefined,
      keywords: undefined,
      rarity: undefined,
      set: undefined,
      set_name: undefined,
      collector_number: undefined,
      released_at: undefined,
      image_uris: undefined,
      prices: undefined,
      edhrec_rank: undefined,
      scryfall_uri: undefined,
      mtgo_id: undefined,
      legalities: { pauper: "legal", future: "unknown" },
    }),
    NOW,
  );
  assert.equal(canonical.oracle_id, "scryfall-id");
  assert.equal(canonical.layout, "normal");
  assert.equal(canonical.mana_cost, "");
  assert.equal(canonical.cmc, 0);
  assert.equal(canonical.type_line, "");
  assert.equal(canonical.oracle_text, "");
  assert.deepEqual(canonical.colors, []);
  assert.deepEqual(canonical.color_identity, []);
  assert.deepEqual(canonical.keywords, []);
  assert.equal(canonical.rarity, "common");
  assert.equal(canonical.set, "");
  assert.equal(canonical.set_name, "");
  assert.equal(canonical.collector_number, "");
  assert.equal(canonical.released_at, "");
  assert.equal(canonical.edhrec_rank, null);
  assert.equal(canonical.scryfall_uri, "");
  assert.equal(canonical.mtgo_id, null);
  assert.deepEqual(canonical.legalities, { pauper: "legal" });
  assert.deepEqual(canonical.prices, { usd: null, usd_foil: null });
});

test("printingRank extracts ranking fields", () => {
  assert.deepEqual(printingRank(card()), {
    releasedAt: "1993-08-05",
    promo: false,
    digital: false,
    rarity: "common",
    set: "lea",
  });
});

test("isBetterEarliestPrinting prefers earlier non-promo printings", () => {
  const early: PrintingRank = {
    releasedAt: "1993-08-05",
    promo: false,
    digital: false,
    rarity: "common",
    set: "lea",
  };
  const late: PrintingRank = { ...early, releasedAt: "2020-01-01" };
  const promo: PrintingRank = { ...early, releasedAt: "1990-01-01", promo: true };

  assert.equal(isBetterEarliestPrinting(early, null), true);
  assert.equal(isBetterEarliestPrinting(early, late), true);
  assert.equal(isBetterEarliestPrinting(late, early), false);
  assert.equal(isBetterEarliestPrinting(promo, null), false);
});

test("isBetterCanonical prefers non-zeta, non-promo, non-digital, newest", () => {
  const base: PrintingRank = {
    releasedAt: "2020-01-01",
    promo: false,
    digital: false,
    rarity: "common",
    set: "m21",
  };
  assert.equal(
    isBetterCanonical({ ...base, set: "slz" }, base),
    false,
  );
  assert.equal(
    isBetterCanonical(base, { ...base, set: "slz" }),
    true,
  );
  assert.equal(
    isBetterCanonical({ ...base, promo: true }, base),
    false,
  );
  assert.equal(
    isBetterCanonical(base, { ...base, promo: true }),
    true,
  );
  assert.equal(
    isBetterCanonical({ ...base, digital: true }, base),
    false,
  );
  assert.equal(
    isBetterCanonical(base, { ...base, digital: true }),
    true,
  );
  assert.equal(
    isBetterCanonical({ ...base, releasedAt: "2021-01-01" }, base),
    true,
  );
  assert.equal(
    isBetterCanonical({ ...base, releasedAt: "2019-01-01" }, base),
    false,
  );
  assert.equal(isBetterCanonical(base, base), false);
});

test("isBetterMetagamePrinting prefers the earliest common non-promo printing", () => {
  const common: PrintingRank = {
    releasedAt: "2020-01-01",
    promo: false,
    digital: false,
    rarity: "common",
    set: "m21",
  };
  assert.equal(isBetterMetagamePrinting(common, null), true);
  assert.equal(
    isBetterMetagamePrinting({ ...common, releasedAt: "2019-01-01" }, common),
    true,
  );
  assert.equal(
    isBetterMetagamePrinting({ ...common, releasedAt: "2021-01-01" }, common),
    false,
  );
  assert.equal(
    isBetterMetagamePrinting({ ...common, promo: true }, common),
    false,
  );
  assert.equal(
    isBetterMetagamePrinting({ ...common, rarity: "uncommon" }, common),
    false,
  );
});
