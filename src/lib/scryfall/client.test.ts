import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  ScryfallError,
  scryfallGetCard,
  scryfallPrintingsForOracle,
  scryfallSearch,
  toSearchResult,
} from "./client";
import type { ScryfallCard } from "./normalize";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(
  t: TestContext,
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return handler(url, init);
    },
  );
  return calls;
}

const scryfallCard: ScryfallCard = {
  id: "scryfall-id",
  oracle_id: "oracle-id",
  name: "Delver of Secrets // Insectile Aberration",
  cmc: 1,
  type_line: "Creature — Human Wizard // Creature — Human Insect",
  colors: ["U"],
  color_identity: ["U"],
  rarity: "common",
  set_name: "Innistrad",
  image_uris: { art_crop: "art", normal: "normal.jpg" },
  card_faces: [
    {
      name: "Delver of Secrets",
      mana_cost: "{U}",
      type_line: "Creature — Human Wizard",
      oracle_text: "At the beginning of your upkeep, look at the top card of your library.",
      image_uris: { art_crop: "face-art", normal: "face.jpg" },
    },
  ],
  prices: { usd: "1.25" },
  legalities: { pauper: "legal", modern: "not_legal" },
};

test("toSearchResult maps a Scryfall card and its front face", () => {
  const result = toSearchResult(scryfallCard);
  assert.equal(result.oracle_id, "oracle-id");
  assert.equal(result.scryfall_id, "scryfall-id");
  assert.equal(result.name, scryfallCard.name);
  assert.equal(result.mana_cost, "{U}");
  assert.deepEqual(result.mana_costs, ["{U}"]);
  assert.equal(result.mana_value, 1);
  assert.equal(result.type_line, scryfallCard.type_line);
  assert.equal(result.oracle_text, scryfallCard.card_faces?.[0]?.oracle_text);
  assert.deepEqual(result.colors, ["U"]);
  assert.deepEqual(result.color_identity, ["U"]);
  assert.equal(result.rarity, "common");
  assert.equal(result.set_name, "Innistrad");
  assert.equal(result.art_crop, "art");
  assert.equal(result.image_normal, "normal.jpg");
  assert.equal(result.price_usd, 1.25);
  assert.equal(result.pauper_legal, true);
});

test("toSearchResult applies defaults and falls back to face images", () => {
  const result = toSearchResult({
    id: "fallback-id",
    name: "Fallback",
    card_faces: [
      {
        name: "Fallback",
        image_uris: { art_crop: "face-art", normal: "face.jpg" },
      },
    ],
  });
  assert.equal(result.oracle_id, "fallback-id");
  assert.equal(result.mana_cost, "");
  assert.deepEqual(result.mana_costs, []);
  assert.equal(result.mana_value, 0);
  assert.equal(result.type_line, "");
  assert.equal(result.oracle_text, "");
  assert.deepEqual(result.colors, []);
  assert.deepEqual(result.color_identity, []);
  assert.equal(result.rarity, "common");
  assert.equal(result.set_name, "");
  assert.equal(result.art_crop, "face-art");
  assert.equal(result.image_normal, "face.jpg");
  assert.equal(result.price_usd, null);
  assert.equal(result.pauper_legal, false);
});

test("scryfallSearch sends the expected query and maps results", async (t) => {
  const calls = mockFetch(t, () =>
    jsonResponse({
      total_cards: 1,
      has_more: false,
      data: [scryfallCard],
    }),
  );

  const result = await scryfallSearch('t:creature "delver"', 2);
  assert.equal(result.total, 1);
  assert.equal(result.has_more, false);
  assert.equal(result.cards[0].oracle_id, "oracle-id");
  assert.equal(calls.length, 1);

  const url = new URL(calls[0].url);
  assert.equal(url.origin, "https://api.scryfall.com");
  assert.equal(url.pathname, "/cards/search");
  assert.equal(url.searchParams.get("q"), 't:creature "delver"');
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("unique"), "cards");
  assert.equal(url.searchParams.get("order"), "name");
  assert.equal(url.searchParams.get("include_extras"), "false");
});

test("scryfallSearch treats not_found as an empty result", async (t) => {
  mockFetch(t, () =>
    jsonResponse({ code: "not_found", details: "No cards found" }, 404),
  );
  assert.deepEqual(await scryfallSearch("nothing"), {
    cards: [],
    total: 0,
    has_more: false,
  });
});

test("scryfallSearch surfaces other Scryfall errors", async (t) => {
  mockFetch(t, () =>
    jsonResponse({ code: "bad_request", details: "Bad query" }, 400),
  );
  await assert.rejects(
    () => scryfallSearch("bad"),
    (error: unknown) => {
      assert.ok(error instanceof ScryfallError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "bad_request");
      assert.equal(error.message, "Bad query");
      return true;
    },
  );
});

test("Scryfall errors with a non-JSON body keep the default message", async (t) => {
  mockFetch(t, () => new Response("upstream failure", { status: 500 }));
  await assert.rejects(
    () => scryfallGetCard("x"),
    (error: unknown) => {
      assert.ok(error instanceof ScryfallError);
      assert.equal(error.status, 500);
      assert.equal(error.code, "500");
      assert.equal(error.message, "Scryfall request failed (500)");
      return true;
    },
  );
});

test("scryfallGetCard encodes the card id and returns the card", async (t) => {
  const calls = mockFetch(t, () => jsonResponse(scryfallCard));
  const card = await scryfallGetCard("a/b c");
  assert.equal(card.id, "scryfall-id");
  assert.equal(calls[0].url, "https://api.scryfall.com/cards/a%2Fb%20c");
});

test("scryfallPrintingsForOracle requests every printing newest first", async (t) => {
  const calls = mockFetch(t, () =>
    jsonResponse({
      total_cards: 2,
      has_more: false,
      data: [scryfallCard, { ...scryfallCard, id: "older" }],
    }),
  );
  const printings = await scryfallPrintingsForOracle("oracle-id");
  assert.deepEqual(
    printings.map((card) => card.id),
    ["scryfall-id", "older"],
  );

  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/cards/search");
  assert.equal(url.searchParams.get("q"), "oracleid:oracle-id");
  assert.equal(url.searchParams.get("unique"), "prints");
  assert.equal(url.searchParams.get("order"), "released");
  assert.equal(url.searchParams.get("dir"), "desc");
});

test("requests send the default User-Agent and Accept headers", async (t) => {
  const previous = process.env.SCRYFALL_USER_AGENT;
  delete process.env.SCRYFALL_USER_AGENT;
  try {
    const calls = mockFetch(t, () => jsonResponse(scryfallCard));
    await scryfallGetCard("id");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(
      headers["User-Agent"],
      "spellstutter/0.1 (+https://github.com/spellstutter)",
    );
    assert.equal(headers.Accept, "application/json");
  } finally {
    if (previous === undefined) delete process.env.SCRYFALL_USER_AGENT;
    else process.env.SCRYFALL_USER_AGENT = previous;
  }
});

test("SCRYFALL_USER_AGENT overrides the default header", async (t) => {
  const previous = process.env.SCRYFALL_USER_AGENT;
  process.env.SCRYFALL_USER_AGENT = "test-agent/1.0";
  try {
    const calls = mockFetch(t, () => jsonResponse(scryfallCard));
    await scryfallGetCard("id");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["User-Agent"], "test-agent/1.0");
  } finally {
    if (previous === undefined) delete process.env.SCRYFALL_USER_AGENT;
    else process.env.SCRYFALL_USER_AGENT = previous;
  }
});
