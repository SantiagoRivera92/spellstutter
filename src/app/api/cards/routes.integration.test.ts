import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { closeTestDb, connectTestDb, hasTestMongo } from "@/test/mongo";

const skip = !hasTestMongo();

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { "x-forwarded-for": randomUUID() },
  });
}

function card(overrides: Record<string, unknown>) {
  return {
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    name_normalized: "lightning bolt",
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
      small: null,
      normal: "bolt.jpg",
      large: null,
      art_crop: "bolt-art",
    },
    card_faces: null,
    prices: { usd: 1.5, usd_foil: null },
    edhrec_rank: null,
    scryfall_uri: "",
    mtgo_id: 101,
    default_printing_id: "p-bolt",
    metagame_printing_id: "p-bolt",
    printings_count: 2,
    legalities: { pauper: "legal" },
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function printing(overrides: Record<string, unknown>) {
  return {
    scryfall_id: "p-bolt",
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    set: "lea",
    set_name: "Limited Edition Alpha",
    collector_number: "161",
    rarity: "common",
    released_at: "1993-08-05",
    image_uris: {
      small: null,
      normal: "bolt.jpg",
      large: null,
      art_crop: "bolt-art",
    },
    card_faces: null,
    prices: { usd: 1.5, usd_foil: null },
    finishes: ["nonfoil"],
    promo: false,
    digital: false,
    mtgo_id: 101,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("card API routes", { skip }, () => {
  let searchRoute: typeof import("./search/route");
  let lookupRoute: typeof import("./[oracleId]/route");
  let mongo: typeof import("@/lib/mongo/client");

  before(async () => {
    const db = await connectTestDb("api-cards");
    await db.collection("cards").insertMany([
      card({}),
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
        metagame_printing_id: null,
        prices: { usd: 0.5, usd_foil: null },
      }),
    ]);
    await db.collection("printings").insertMany([
      printing({}),
      printing({
        scryfall_id: "p-bolt-new",
        set: "m10",
        set_name: "Magic 2010",
        released_at: "2009-07-17",
      }),
      printing({
        scryfall_id: "p-counter",
        oracle_id: "o-counter",
        name: "Counterspell",
        set: "tmp",
        released_at: "1997-10-14",
      }),
    ]);
    searchRoute = await import("./search/route");
    lookupRoute = await import("./[oracleId]/route");
    mongo = await import("@/lib/mongo/client");
  });

  after(async () => {
    await mongo.closeDb();
    await closeTestDb();
  });

  test("GET /api/cards/search returns matching cards", async () => {
    const response = await searchRoute.GET(
      request("/api/cards/search?q=lightning&page_size=1"),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.page, 1);
    assert.equal(body.page_size, 1);
    assert.equal(body.cards[0].name, "Lightning Bolt");
    assert.equal(body.cards[0].pauper_legal, true);
  });

  test("GET /api/cards/search validates query parameters", async () => {
    for (const query of [
      "page=0",
      "page=1001",
      "page_size=0",
      "page_size=101",
      "sort=color",
      "dir=up",
      `q=${"x".repeat(201)}`,
    ]) {
      const response = await searchRoute.GET(
        request(`/api/cards/search?${query}`),
      );
      assert.equal(response.status, 400, query);
      const body = await response.json();
      assert.equal(body.error, "invalid_query");
      assert.ok(Array.isArray(body.issues));
    }
  });

  test("GET /api/cards/search returns 503 without Mongo", async () => {
    const previous = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    try {
      const response = await searchRoute.GET(request("/api/cards/search"));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "card_catalog_unavailable",
        message:
          "The card catalog is not configured. Set MONGODB_URI and run the Scryfall sync.",
      });
    } finally {
      if (previous === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = previous;
    }
  });

  test("GET /api/cards/[oracleId] returns the card and its printings", async () => {
    const response = await lookupRoute.GET(
      request("/api/cards/o-bolt"),
      {
        params: Promise.resolve({ oracleId: "o-bolt" }),
      } as unknown as Parameters<typeof lookupRoute.GET>[1],
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.card.name, "Lightning Bolt");
    assert.equal("_id" in body.card, false);
    assert.deepEqual(
      body.printings.map((entry: { scryfall_id: string }) => entry.scryfall_id),
      ["p-bolt-new", "p-bolt"],
    );
  });

  test("GET /api/cards/[oracleId] returns 404 for an unknown card", async () => {
    const response = await lookupRoute.GET(
      request("/api/cards/missing"),
      {
        params: Promise.resolve({ oracleId: "missing" }),
      } as unknown as Parameters<typeof lookupRoute.GET>[1],
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  });

  test("GET /api/cards/[oracleId] returns 503 without Mongo", async () => {
    const previous = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    try {
      const response = await lookupRoute.GET(
        request("/api/cards/o-bolt"),
        {
          params: Promise.resolve({ oracleId: "o-bolt" }),
        } as unknown as Parameters<typeof lookupRoute.GET>[1],
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "card_catalog_unavailable",
      });
    } finally {
      if (previous === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = previous;
    }
  });
});
