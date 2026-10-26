import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { GET } from "./route";

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { "x-forwarded-for": randomUUID() },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(
  t: TestContext,
  handler: (url: string) => Response | Promise<Response>,
) {
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      return handler(url);
    },
  );
  return calls;
}

const card = {
  id: "scryfall-id",
  oracle_id: "oracle-id",
  name: "Delver of Secrets",
  cmc: 1,
  type_line: "Creature — Human Wizard",
  oracle_text: "Flying",
  colors: ["U"],
  color_identity: ["U"],
  rarity: "common",
  set_name: "Innistrad",
  image_uris: { art_crop: "art", normal: "normal.jpg" },
  prices: { usd: "1.00" },
  legalities: { pauper: "legal" },
};

test("GET /api/scryfall/search proxies a search", async (t) => {
  const calls = mockFetch(t, () =>
    jsonResponse({ total_cards: 1, has_more: false, data: [card] }),
  );

  const response = await GET(request("/api/scryfall/search?q=delver&page=2"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 1);
  assert.equal(body.has_more, false);
  assert.equal(body.cards[0].name, "Delver of Secrets");
  assert.equal(body.cards[0].pauper_legal, true);

  const url = new URL(calls[0]);
  assert.equal(url.searchParams.get("q"), "delver");
  assert.equal(url.searchParams.get("page"), "2");
});

test("GET /api/scryfall/search validates q and page", async (t) => {
  const calls = mockFetch(t, () =>
    jsonResponse({ total_cards: 0, has_more: false, data: [] }),
  );

  for (const query of [
    "",
    "q=",
    `q=${"x".repeat(301)}`,
    "q=delver&page=0",
    "q=delver&page=21",
  ]) {
    const response = await GET(request(`/api/scryfall/search?${query}`));
    assert.equal(response.status, 400, query);
    const body = await response.json();
    assert.equal(body.error, "invalid_query");
    assert.ok(Array.isArray(body.issues));
  }
  assert.equal(calls.length, 0);
});

test("GET /api/scryfall/search maps a 422 to 400", async (t) => {
  mockFetch(t, () =>
    jsonResponse({ code: "invalid_query", details: "Bad syntax" }, 422),
  );
  const response = await GET(request("/api/scryfall/search?q=bad"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "invalid_query",
    message: "Bad syntax",
  });
});

test("GET /api/scryfall/search maps upstream errors to 502", async (t) => {
  mockFetch(t, () => jsonResponse({ code: "server_error" }, 500));
  const response = await GET(request("/api/scryfall/search?q=delver"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "server_error",
    message: "Scryfall request failed (500)",
  });
});

test("GET /api/scryfall/search handles a network failure", async (t) => {
  t.mock.method(console, "error", () => {});
  mockFetch(t, () => {
    throw new Error("network down");
  });
  const response = await GET(request("/api/scryfall/search?q=delver"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "scryfall_unavailable",
    message: "Scryfall is unreachable.",
  });
});

test("GET /api/scryfall/search treats not_found as an empty result", async (t) => {
  mockFetch(t, () =>
    jsonResponse({ code: "not_found", details: "No cards found" }, 404),
  );
  const response = await GET(request("/api/scryfall/search?q=missing"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    cards: [],
    total: 0,
    has_more: false,
  });
});
