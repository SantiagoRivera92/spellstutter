import { before, test, mock } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "@/lib/cards/types";
import type { ArchetypeBreakdown, MetagameDeck } from "@/lib/metagame/types";
import type { EndstepArchetype } from "@/lib/metagame/types";
import type { Deck, DeckCard } from "@/lib/supabase/types";

interface TestSession {
  id: string;
  email: string;
  profile: { username: string } | null;
}

interface Call {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  select?: string;
  filters: { column: string; value: unknown }[];
}

interface Result {
  data?: unknown;
  error?: { message: string } | null;
}

type Handler = (call: Call) => Result | undefined;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

class FakeQuery {
  private op: Call["op"] = "select";
  private payload: unknown;
  private selectColumns: string | undefined;
  private filters: { column: string; value: unknown }[] = [];

  constructor(
    private table: string,
    private handler: Handler,
    private calls: Call[],
  ) {}

  select(columns?: string) {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: unknown) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.op = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.finish());
  }

  single() {
    return Promise.resolve(this.finish());
  }

  then(
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve(this.finish()).then(resolve, reject);
  }

  private finish(): QueryResult {
    const call: Call = {
      table: this.table,
      op: this.op,
      payload: this.payload,
      select: this.selectColumns,
      filters: this.filters,
    };
    this.calls.push(call);
    const result = this.handler(call) ?? {};
    return { data: result.data ?? null, error: result.error ?? null };
  }
}

function fakeSupabase(handler: Handler = () => undefined) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return new FakeQuery(table, handler, calls);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function filter(call: Call, column: string): unknown {
  return call.filters.find((entry) => entry.column === column)?.value;
}

function payloadObject(call: Call): Record<string, unknown> {
  return call.payload as Record<string, unknown>;
}

function payloadArray(call: Call): Record<string, unknown>[] {
  return call.payload as Record<string, unknown>[];
}

type MockModuleOptions = Parameters<typeof mock.module>[1];

function mockModule(
  specifier: string,
  options: { exports: Record<string, unknown> },
) {
  mock.module(specifier, options as unknown as MockModuleOptions);
}

let actions: typeof import("./actions");
let currentSession: TestSession | null;
let currentSupabase: SupabaseClient;
let mongoConfigured = true;
let cardByOracleId: (oracleId: string) => Promise<Card | null>;
let cardsByNames: (names: string[]) => Promise<Card[]>;
let cardsByOracleIds: (oracleIds: string[]) => Promise<Card[]>;
let archetypeBreakdown: (
  slug: string,
  days?: number,
) => Promise<ArchetypeBreakdown | null>;
let metagameDeck: (
  eventSlug: string,
  player: string,
) => Promise<MetagameDeck | null>;
let endstepArchetype: (
  slug: string,
  formatId?: string,
) => Promise<EndstepArchetype | null>;
let revalidated: string[];
let redirected: string[];

const session: TestSession = {
  id: "user-1",
  email: "alice@example.test",
  profile: { username: "alice" },
};

function useSupabase(handler: Handler, testSession: TestSession | null = session) {
  const fake = fakeSupabase(handler);
  currentSupabase = fake.client;
  currentSession = testSession;
  mongoConfigured = true;
  cardByOracleId = async () => null;
  cardsByNames = async () => [];
  cardsByOracleIds = async () => [];
  archetypeBreakdown = async () => null;
  metagameDeck = async () => null;
  endstepArchetype = async () => null;
  revalidated = [];
  redirected = [];
  return fake;
}

function card(overrides: Partial<Card>): Card {
  return {
    oracle_id: "o-card",
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
    image_uris: { small: null, normal: null, large: null, art_crop: null },
    card_faces: null,
    prices: { usd: null, usd_foil: null },
    edhrec_rank: null,
    scryfall_uri: "",
    mtgo_id: null,
    default_printing_id: "p-card",
    metagame_printing_id: null,
    printings_count: 1,
    legalities: { pauper: "legal" },
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function deck(overrides: Partial<Deck>): Deck {
  return {
    id: "deck-1",
    user_id: "user-1",
    folder_id: null,
    name: "Deck",
    description: null,
    visibility: "private",
    cover_oracle_id: null,
    cover_printing_id: null,
    cover_art_url: null,
    archetype_slug: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Deck;
}

before(async () => {
  mockModule("@/lib/auth/session", {
    exports: { getSession: async () => currentSession },
  });
  mockModule("@/lib/supabase/server", {
    exports: { createSupabaseServerClient: async () => currentSupabase },
  });
  mockModule("@/lib/env", {
    exports: { isMongoConfigured: () => mongoConfigured },
  });
  mockModule("@/lib/cards/queries", {
    exports: {
      getCardByOracleId: (oracleId: string) => cardByOracleId(oracleId),
      getCardsByNames: (names: string[]) => cardsByNames(names),
      getCardsByOracleIds: (ids: string[]) => cardsByOracleIds(ids),
    },
  });
  mockModule("@/lib/metagame/queries", {
    exports: {
      getArchetypeBreakdown: (slug: string, days?: number) =>
        archetypeBreakdown(slug, days),
      getMetagameDeck: (eventSlug: string, player: string) =>
        metagameDeck(eventSlug, player),
    },
  });
  mockModule("@/lib/metagame/endstep", {
    exports: {
      getEndstepArchetype: (slug: string, formatId?: string) =>
        endstepArchetype(slug, formatId),
    },
  });
  mockModule("next/cache", {
    exports: {
      revalidatePath: (path: string) => {
        revalidated.push(path);
      },
    },
  });
  mockModule("next/navigation", {
    exports: {
      redirect: (path: string) => {
        redirected.push(path);
      },
    },
  });
  actions = await import("./actions");
});

test("actions require a session and profile", async () => {
  useSupabase(() => undefined, null);
  assert.deepEqual(await actions.createFolder({ name: "Folder" }), {
    ok: false,
    error: "unauthenticated",
  });

  useSupabase(() => undefined, { ...session, profile: null });
  assert.deepEqual(await actions.createFolder({ name: "Folder" }), {
    ok: false,
    error: "no_profile",
  });
});

test("createFolder inserts a folder and revalidates", async () => {
  const fake = useSupabase(() => ({}));
  assert.deepEqual(await actions.createFolder({ name: "My Folder" }), { ok: true });
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].table, "folders");
  assert.equal(fake.calls[0].op, "insert");
  assert.deepEqual(payloadObject(fake.calls[0]), {
    user_id: "user-1",
    parent_id: null,
    name: "My Folder",
  });
  assert.deepEqual(revalidated, ["/decks"]);
});

test("createFolder validates the name and reports insert errors", async () => {
  const invalid = useSupabase(() => ({}));
  assert.deepEqual(await actions.createFolder({ name: "   " }), {
    ok: false,
    error: "invalid_name",
  });
  assert.equal(invalid.calls.length, 0);

  useSupabase(() => ({ error: { message: "db down" } }));
  assert.deepEqual(await actions.createFolder({ name: "Folder" }), {
    ok: false,
    error: "db down",
  });
});

test("renameFolder and moveFolder update by id and owner", async () => {
  const renamed = useSupabase(() => ({}));
  assert.deepEqual(
    await actions.renameFolder({ id: "folder-1", name: "Renamed" }),
    { ok: true },
  );
  assert.equal(renamed.calls[0].op, "update");
  assert.deepEqual(payloadObject(renamed.calls[0]), { name: "Renamed" });
  assert.equal(filter(renamed.calls[0], "id"), "folder-1");
  assert.equal(filter(renamed.calls[0], "user_id"), "user-1");

  const moved = useSupabase(() => ({}));
  assert.deepEqual(
    await actions.moveFolder({ id: "folder-1", parentId: "folder-2" }),
    { ok: true },
  );
  assert.deepEqual(payloadObject(moved.calls[0]), { parent_id: "folder-2" });

  useSupabase(() => ({ error: { message: "nope" } }));
  assert.deepEqual(await actions.renameFolder({ id: "folder-1", name: "X" }), {
    ok: false,
    error: "nope",
  });
});

test("deleteFolder deletes by id and owner", async () => {
  const fake = useSupabase(() => ({}));
  assert.deepEqual(await actions.deleteFolder({ id: "folder-1" }), { ok: true });
  assert.equal(fake.calls[0].op, "delete");
  assert.equal(filter(fake.calls[0], "id"), "folder-1");
  assert.equal(filter(fake.calls[0], "user_id"), "user-1");
});

test("createDeck inserts a deck and returns its id", async () => {
  const fake = useSupabase((call) =>
    call.table === "decks" && call.op === "insert"
      ? { data: { id: "deck-1" } }
      : undefined,
  );
  assert.deepEqual(
    await actions.createDeck({ name: "New Deck", folderId: "folder-1" }),
    { ok: true, deckId: "deck-1" },
  );
  assert.deepEqual(payloadObject(fake.calls[0]), {
    user_id: "user-1",
    folder_id: "folder-1",
    name: "New Deck",
  });
  assert.deepEqual(revalidated, ["/decks"]);
});

test("createDeck validates names and reports errors", async () => {
  useSupabase(() => ({}));
  assert.deepEqual(await actions.createDeck({ name: "" }), {
    ok: false,
    error: "invalid_name",
  });

  useSupabase(() => ({ error: { message: "insert failed" } }));
  assert.deepEqual(await actions.createDeck({ name: "Deck" }), {
    ok: false,
    error: "insert failed",
  });
});

test("createDeckFromArchetype requires a card catalog", async () => {
  useSupabase(() => ({}));
  mongoConfigured = false;
  assert.deepEqual(
    await actions.createDeckFromArchetype({
      name: "Deck",
      archetypeSlug: "endstep:blue-terror",
    }),
    { ok: false, error: "card_catalog_unavailable" },
  );
});

test("createDeckFromArchetype seeds an endstep sample list", async () => {
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.op === "insert") return { data: { id: "deck-1" } };
    return undefined;
  });
  endstepArchetype = async () => ({
    sample_list: {
      main: [
        { name: "Delver of Secrets", count: 4 },
        { name: "Island", count: 0 },
        { name: "Unknown Card", count: 2 },
      ],
      side: [],
    },
  }) as unknown as EndstepArchetype;
  cardsByNames = async () => [
    card({
      oracle_id: "o-delver",
      name: "Delver of Secrets",
      name_normalized: "delver of secrets",
      default_printing_id: "p-delver",
    }),
  ];

  assert.deepEqual(
    await actions.createDeckFromArchetype({
      name: "Delver",
      archetypeSlug: "endstep:blue-terror",
    }),
    { ok: true, deckId: "deck-1" },
  );

  const insert = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "insert",
  );
  assert.ok(insert);
  const rows = payloadArray(insert);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    deck_id: "deck-1",
    oracle_id: "o-delver",
    printing_id: "p-delver",
    card_name: "Delver of Secrets",
    quantity: 4,
    board: "main",
  });
});

test("createDeckFromArchetype rejects an empty endstep archetype", async () => {
  useSupabase(() => ({}));
  endstepArchetype = async () => null;
  assert.deepEqual(
    await actions.createDeckFromArchetype({
      name: "Deck",
      archetypeSlug: "endstep:missing",
    }),
    { ok: false, error: "archetype_unavailable" },
  );
});

test("createDeckFromArchetype seeds only core MTGO cards", async () => {
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.op === "insert") return { data: { id: "deck-1" } };
    return undefined;
  });
  archetypeBreakdown = async () =>
    ({
      decks: 2,
      main: [
        { oracle_id: "o-core", name: "Core", decks: 2, min_qty: 3 },
        { oracle_id: "o-splash", name: "Splash", decks: 1, min_qty: 1 },
        { oracle_id: null, name: "Unresolved", decks: 2, min_qty: 2 },
      ],
    }) as unknown as ArchetypeBreakdown;
  cardsByOracleIds = async () => [
    card({
      oracle_id: "o-core",
      name: "Core",
      metagame_printing_id: "p-core",
      default_printing_id: "p-core-default",
    }),
  ];

  assert.deepEqual(
    await actions.createDeckFromArchetype({
      name: "Core Deck",
      archetypeSlug: "mono-blue-terror",
    }),
    { ok: true, deckId: "deck-1" },
  );
  const insert = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "insert",
  );
  assert.ok(insert);
  assert.deepEqual(payloadArray(insert), [
    {
      deck_id: "deck-1",
      oracle_id: "o-core",
      printing_id: "p-core",
      card_name: "Core",
      quantity: 3,
      board: "main",
    },
  ]);
});

test("createDeckFromArchetype reports a missing migration", async () => {
  useSupabase((call) =>
    call.table === "decks" && call.op === "insert"
      ? { error: { message: "column archetype_slug does not exist" } }
      : undefined,
  );
  archetypeBreakdown = async () =>
    ({ decks: 1, main: [] }) as unknown as ArchetypeBreakdown;
  assert.deepEqual(
    await actions.createDeckFromArchetype({
      name: "Deck",
      archetypeSlug: "mono-blue-terror",
    }),
    { ok: false, error: "migration_required" },
  );
});

test("cloneMetagameDeck requires a catalog and an existing deck", async () => {
  useSupabase(() => ({}));
  mongoConfigured = false;
  assert.deepEqual(
    await actions.cloneMetagameDeck({ eventSlug: "e", player: "p" }),
    { ok: false, error: "card_catalog_unavailable" },
  );

  mongoConfigured = true;
  metagameDeck = async () => null;
  assert.deepEqual(
    await actions.cloneMetagameDeck({ eventSlug: "e", player: "p" }),
    { ok: false, error: "deck_not_found" },
  );
});

test("cloneMetagameDeck copies rows and reports added cards", async () => {
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.op === "insert") return { data: { id: "deck-2" } };
    return undefined;
  });
  metagameDeck = async () =>
    ({
      event_slug: "challenge",
      event_name: "Challenge",
      event_type: "challenge",
      event_date: "2026-01-01",
      player: "Alice",
      rank: 1,
      wins: 4,
      losses: 0,
      color_identity: ["U"],
      archetype: { slug: "mono-blue-terror", name: "Mono-Blue Terror", confidence: 1 },
      classification_version: "1",
      scraped_at: "2026-01-01T00:00:00.000Z",
      mainboard: [
        { name: "Delver of Secrets", quantity: 4, oracle_id: "o-delver", printing_id: "p-delver" },
      ],
      sideboard: [
        { name: "Hydroblast", quantity: 2, oracle_id: "o-hydro", printing_id: null },
      ],
    }) as unknown as MetagameDeck;

  assert.deepEqual(
    await actions.cloneMetagameDeck({
      eventSlug: "challenge",
      player: "Alice",
      folderId: "folder-1",
    }),
    { ok: true, deckId: "deck-2", report: { added: 6, skipped: [] } },
  );

  const deckInsert = fake.calls.find(
    (call) => call.table === "decks" && call.op === "insert",
  );
  assert.ok(deckInsert);
  assert.deepEqual(payloadObject(deckInsert), {
    user_id: "user-1",
    folder_id: "folder-1",
    name: "Mono-Blue Terror (Alice)",
    archetype_slug: "mono-blue-terror",
    visibility: "private",
  });

  const cardInsert = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "insert",
  );
  assert.ok(cardInsert);
  assert.equal(payloadArray(cardInsert).length, 2);
});

test("cloneMetagameDeck reports card insert failures", async () => {
  useSupabase((call) => {
    if (call.table === "decks" && call.op === "insert") return { data: { id: "deck-2" } };
    if (call.table === "deck_cards" && call.op === "insert")
      return { error: { message: "cards failed" } };
    return undefined;
  });
  metagameDeck = async () =>
    ({
      event_slug: "e",
      event_name: "E",
      event_type: "challenge",
      event_date: "2026-01-01",
      player: "P",
      rank: 1,
      wins: 0,
      losses: 0,
      color_identity: [],
      archetype: { slug: "s", name: "S", confidence: 1 },
      classification_version: "1",
      scraped_at: "2026-01-01T00:00:00.000Z",
      mainboard: [{ name: "C", quantity: 1, oracle_id: "o", printing_id: null }],
      sideboard: [],
    }) as unknown as MetagameDeck;
  assert.deepEqual(
    await actions.cloneMetagameDeck({ eventSlug: "e", player: "P" }),
    { ok: false, error: "cards failed" },
  );
});

test("updateDeck builds a patch and validates fields", async () => {
  const fake = useSupabase(() => ({}));
  assert.deepEqual(
    await actions.updateDeck({
      id: "deck-1",
      name: " Renamed ",
      description: "x".repeat(1200),
      visibility: "public",
      folderId: "folder-1",
    }),
    { ok: true },
  );
  const patch = payloadObject(fake.calls[0]);
  assert.equal(patch.name, "Renamed");
  assert.equal((patch.description as string).length, 1000);
  assert.equal(patch.visibility, "public");
  assert.equal(patch.folder_id, "folder-1");
  assert.equal(filter(fake.calls[0], "id"), "deck-1");
  assert.equal(filter(fake.calls[0], "user_id"), "user-1");

  useSupabase(() => ({}));
  assert.deepEqual(await actions.updateDeck({ id: "deck-1" }), { ok: true });

  useSupabase(() => ({}));
  assert.deepEqual(await actions.updateDeck({ id: "deck-1", name: "" }), {
    ok: false,
    error: "invalid_name",
  });
  assert.deepEqual(
    await actions.updateDeck({ id: "deck-1", visibility: "secret" as never }),
    { ok: false, error: "invalid_visibility" },
  );
});

test("deleteDeck deletes and optionally redirects", async () => {
  const fake = useSupabase(() => ({}));
  assert.deepEqual(
    await actions.deleteDeck({ id: "deck-1", redirectTo: "/decks" }),
    { ok: true },
  );
  assert.equal(fake.calls[0].op, "delete");
  assert.deepEqual(redirected, ["/decks"]);
});

test("setDeckCover writes the cover fields", async () => {
  const fake = useSupabase(() => ({}));
  assert.deepEqual(
    await actions.setDeckCover({
      deckId: "deck-1",
      oracleId: "o-card",
      printingId: "p-card",
      artUrl: "art",
    }),
    { ok: true },
  );
  assert.deepEqual(payloadObject(fake.calls[0]), {
    cover_oracle_id: "o-card",
    cover_printing_id: "p-card",
    cover_art_url: "art",
  });
});

test("addDeckCard checks ownership, board, and Pauper legality", async () => {
  useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: null } : undefined,
  );
  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
    }),
    { ok: false, error: "not_found" },
  );

  useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: { id: "deck-1" } } : undefined,
  );
  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
      board: "bad" as never,
    }),
    { ok: false, error: "invalid_board" },
  );

  cardByOracleId = async () => null;
  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
    }),
    { ok: false, error: "not_pauper_legal" },
  );

  cardByOracleId = async () => card({ legalities: { pauper: "banned" } });
  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
    }),
    { ok: false, error: "not_pauper_legal" },
  );

  cardByOracleId = async () => {
    throw new Error("catalog down");
  };
  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
    }),
    { ok: false, error: "card_catalog_unavailable" },
  );
});

test("addDeckCard updates an existing row and caps the quantity", async () => {
  const updatedCard = { id: "card-1", quantity: 999 } as DeckCard;
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.select === "id") return { data: { id: "deck-1" } };
    if (call.table === "deck_cards" && call.op === "select")
      return { data: { id: "card-1", quantity: 998 } };
    if (call.table === "deck_cards" && call.op === "update")
      return { data: updatedCard };
    return undefined;
  });
  cardByOracleId = async () =>
    card({ oracle_id: "o-card", metagame_printing_id: "p-meta" });

  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
      quantity: 5,
    }),
    { ok: true, card: updatedCard },
  );
  const update = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "update",
  );
  assert.ok(update);
  assert.deepEqual(payloadObject(update), { quantity: 999 });
});

test("addDeckCard inserts a new row with the metagame printing", async () => {
  const inserted = { id: "card-1", quantity: 2 } as DeckCard;
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.select === "id") return { data: { id: "deck-1" } };
    if (call.table === "deck_cards" && call.op === "select") return { data: null };
    if (call.table === "deck_cards" && call.op === "insert") return { data: inserted };
    return undefined;
  });
  cardByOracleId = async () =>
    card({
      oracle_id: "o-card",
      metagame_printing_id: "p-meta",
      default_printing_id: "p-default",
    });

  assert.deepEqual(
    await actions.addDeckCard({
      deckId: "deck-1",
      oracleId: "o-card",
      cardName: "Card",
      quantity: 2,
    }),
    { ok: true, card: inserted },
  );
  const insert = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "insert",
  );
  assert.ok(insert);
  assert.deepEqual(payloadObject(insert), {
    deck_id: "deck-1",
    oracle_id: "o-card",
    printing_id: "p-meta",
    card_name: "Card",
    quantity: 2,
    board: "main",
  });
});

test("updateDeckCard deletes at zero and validates the board", async () => {
  const fake = useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: { id: "deck-1" } } : undefined,
  );
  assert.deepEqual(
    await actions.updateDeckCard({
      deckId: "deck-1",
      cardId: "card-1",
      quantity: 0,
    }),
    { ok: true },
  );
  assert.equal(fake.calls[1].op, "delete");
  assert.equal(filter(fake.calls[1], "id"), "card-1");
  assert.equal(filter(fake.calls[1], "deck_id"), "deck-1");

  useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: { id: "deck-1" } } : undefined,
  );
  assert.deepEqual(
    await actions.updateDeckCard({
      deckId: "deck-1",
      cardId: "card-1",
      board: "bad" as never,
    }),
    { ok: false, error: "invalid_board" },
  );
});

test("updateDeckCard applies a capped patch", async () => {
  const fake = useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: { id: "deck-1" } } : undefined,
  );
  assert.deepEqual(
    await actions.updateDeckCard({
      deckId: "deck-1",
      cardId: "card-1",
      quantity: 1000,
      board: "side",
      category: "Removal",
      printingId: "p-card",
    }),
    { ok: true },
  );
  const update = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "update",
  );
  assert.ok(update);
  assert.deepEqual(payloadObject(update), {
    printing_id: "p-card",
    quantity: 999,
    board: "side",
    category: "Removal",
  });
});

test("removeDeckCard checks ownership and deletes", async () => {
  useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: null } : undefined,
  );
  assert.deepEqual(
    await actions.removeDeckCard({ deckId: "deck-1", cardId: "card-1" }),
    { ok: false, error: "not_found" },
  );

  const fake = useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: { id: "deck-1" } } : undefined,
  );
  assert.deepEqual(
    await actions.removeDeckCard({ deckId: "deck-1", cardId: "card-1" }),
    { ok: true },
  );
  assert.equal(fake.calls[1].op, "delete");
});

test("importDecklist validates the list and catalog", async () => {
  useSupabase((call) =>
    call.table === "decks" && call.select === "id" ? { data: { id: "deck-1" } } : undefined,
  );
  assert.deepEqual(
    await actions.importDecklist({ deckId: "deck-1", text: "" }),
    { ok: false, error: "empty_list" },
  );
  assert.deepEqual(
    await actions.importDecklist({
      deckId: "deck-1",
      text: "x".repeat(100_001),
    }),
    { ok: false, error: "list_too_long" },
  );

  cardsByNames = async () => {
    throw new Error("catalog down");
  };
  assert.deepEqual(
    await actions.importDecklist({ deckId: "deck-1", text: "4 Lightning Bolt" }),
    { ok: false, error: "card_catalog_unavailable" },
  );
});

test("importDecklist replaces target boards and diffs existing rows", async () => {
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.select === "id") return { data: { id: "deck-1" } };
    if (call.table === "deck_cards" && call.op === "delete") return {};
    if (call.table === "deck_cards" && call.op === "select")
      return {
        data: [{ id: "row-1", oracle_id: "o-bolt", board: "main", quantity: 2 }],
      };
    if (call.table === "deck_cards" && call.op === "insert")
      return { data: { id: "row-2", quantity: 3 } };
    return undefined;
  });
  cardsByNames = async () => [
    card({
      oracle_id: "o-bolt",
      name: "Lightning Bolt",
      name_normalized: "lightning bolt",
      default_printing_id: "p-bolt",
    }),
    card({
      oracle_id: "o-counter",
      name: "Counterspell",
      name_normalized: "counterspell",
      legalities: { pauper: "banned" },
    }),
    card({
      oracle_id: "o-hydro",
      name: "Hydroblast",
      name_normalized: "hydroblast",
      default_printing_id: "p-hydro",
    }),
  ];

  const result = await actions.importDecklist({
    deckId: "deck-1",
    mode: "replace",
    text: "4 Lightning Bolt\n2 Counterspell\nSideboard\n3 Hydroblast",
  });
  assert.deepEqual(result, {
    ok: true,
    report: { added: 7, skipped: ["Counterspell"] },
  });

  const deleteCall = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "delete",
  );
  assert.ok(deleteCall);
  assert.deepEqual(filter(deleteCall, "board"), ["main", "side"]);

  const update = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "update",
  );
  assert.ok(update);
  assert.deepEqual(payloadObject(update), { quantity: 6 });

  const insert = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "insert",
  );
  assert.ok(insert);
  assert.equal(payloadObject(insert).board, "side");
  assert.equal(payloadObject(insert).quantity, 3);
});

test("importDecklist in add mode keeps existing boards", async () => {
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.select === "id") return { data: { id: "deck-1" } };
    if (call.table === "deck_cards" && call.op === "select") return { data: [] };
    if (call.table === "deck_cards" && call.op === "insert")
      return { data: { id: "row-1", quantity: 4 } };
    return undefined;
  });
  cardsByNames = async () => [
    card({
      oracle_id: "o-bolt",
      name: "Lightning Bolt",
      name_normalized: "lightning bolt",
      default_printing_id: "p-bolt",
    }),
  ];
  assert.deepEqual(
    await actions.importDecklist({ deckId: "deck-1", text: "4 Lightning Bolt" }),
    { ok: true, report: { added: 4, skipped: [] } },
  );
  assert.equal(
    fake.calls.some((call) => call.table === "deck_cards" && call.op === "delete"),
    false,
  );
});

test("addDeckComment validates the body and deck visibility", async () => {
  useSupabase(() => ({}));
  assert.deepEqual(
    await actions.addDeckComment({ deckId: "deck-1", body: "   " }),
    { ok: false, error: "invalid_comment" },
  );
  assert.deepEqual(
    await actions.addDeckComment({
      deckId: "deck-1",
      body: "x".repeat(2001),
    }),
    { ok: false, error: "invalid_comment" },
  );

  useSupabase((call) =>
    call.table === "decks"
      ? { data: { id: "deck-1", user_id: "other", visibility: "private" } }
      : undefined,
  );
  assert.deepEqual(
    await actions.addDeckComment({ deckId: "deck-1", body: "Hello" }),
    { ok: false, error: "not_found" },
  );

  const fake = useSupabase((call) =>
    call.table === "decks"
      ? { data: { id: "deck-1", user_id: "other", visibility: "public" } }
      : undefined,
  );
  assert.deepEqual(
    await actions.addDeckComment({ deckId: "deck-1", body: "Hello" }),
    { ok: true },
  );
  const insert = fake.calls.find((call) => call.table === "deck_comments");
  assert.ok(insert);
  assert.deepEqual(payloadObject(insert), {
    deck_id: "deck-1",
    user_id: "user-1",
    parent_id: null,
    body: "Hello",
  });
});

test("deleteDeckComment allows authors and deck owners only", async () => {
  useSupabase((call) =>
    call.table === "deck_comments" ? { data: null } : undefined,
  );
  assert.deepEqual(
    await actions.deleteDeckComment({ commentId: "c1", deckId: "deck-1" }),
    { ok: false, error: "not_found" },
  );

  useSupabase((call) => {
    if (call.table === "deck_comments" && call.op === "select")
      return { data: { user_id: "user-1" } };
    return undefined;
  });
  assert.deepEqual(
    await actions.deleteDeckComment({ commentId: "c1", deckId: "deck-1" }),
    { ok: true },
  );

  useSupabase((call) => {
    if (call.table === "deck_comments" && call.op === "select")
      return { data: { user_id: "other" } };
    if (call.table === "decks" && call.select === "id")
      return { data: { id: "deck-1" } };
    return undefined;
  });
  assert.deepEqual(
    await actions.deleteDeckComment({ commentId: "c1", deckId: "deck-1" }),
    { ok: true },
  );

  useSupabase((call) => {
    if (call.table === "deck_comments" && call.op === "select")
      return { data: { user_id: "other" } };
    if (call.table === "decks" && call.select === "id") return { data: null };
    return undefined;
  });
  assert.deepEqual(
    await actions.deleteDeckComment({ commentId: "c1", deckId: "deck-1" }),
    { ok: false, error: "not_found" },
  );
});

test("cloneUserDeck copies a visible deck", async () => {
  const source = deck({
    id: "source",
    user_id: "other",
    visibility: "public",
    name: "Source",
    description: "desc",
    archetype_slug: "mono-blue-terror",
  });
  const sourceCards = [
    {
      id: "card-1",
      deck_id: "source",
      oracle_id: "o-bolt",
      printing_id: "p-bolt",
      card_name: "Lightning Bolt",
      quantity: 4,
      board: "main",
      category: null,
    },
  ] as DeckCard[];
  const fake = useSupabase((call) => {
    if (call.table === "decks" && call.op === "select" && call.select === "*")
      return { data: source };
    if (call.table === "deck_cards" && call.op === "select")
      return { data: sourceCards };
    if (call.table === "decks" && call.op === "insert")
      return { data: { id: "copy-1" } };
    return undefined;
  });

  assert.deepEqual(
    await actions.cloneUserDeck({ deckId: "source", folderId: "folder-1" }),
    { ok: true, deckId: "copy-1" },
  );
  const insertDeck = fake.calls.find(
    (call) => call.table === "decks" && call.op === "insert",
  );
  assert.ok(insertDeck);
  assert.equal(payloadObject(insertDeck).name, "Source (copy)");
  assert.equal(payloadObject(insertDeck).visibility, "private");
  assert.equal(payloadObject(insertDeck).archetype_slug, "mono-blue-terror");

  const insertCards = fake.calls.find(
    (call) => call.table === "deck_cards" && call.op === "insert",
  );
  assert.ok(insertCards);
  assert.deepEqual(payloadArray(insertCards)[0], {
    deck_id: "copy-1",
    oracle_id: "o-bolt",
    printing_id: "p-bolt",
    card_name: "Lightning Bolt",
    quantity: 4,
    board: "main",
    category: null,
  });
});

test("cloneUserDeck rejects private decks owned by others", async () => {
  useSupabase((call) =>
    call.table === "decks" && call.select === "*"
      ? { data: deck({ id: "source", user_id: "other", visibility: "private" }) }
      : undefined,
  );
  assert.deepEqual(
    await actions.cloneUserDeck({ deckId: "source" }),
    { ok: false, error: "deck_not_found" },
  );
});

test("cloneUserDeck reports missing migrations and card errors", async () => {
  useSupabase((call) => {
    if (call.table === "decks" && call.select === "*")
      return { data: deck({ id: "source", visibility: "public" }) };
    if (call.table === "deck_cards" && call.op === "select") return { data: [] };
    if (call.table === "decks" && call.op === "insert")
      return { error: { message: "archetype_slug missing" } };
    return undefined;
  });
  assert.deepEqual(
    await actions.cloneUserDeck({ deckId: "source" }),
    { ok: false, error: "migration_required" },
  );

  useSupabase((call) => {
    if (call.table === "decks" && call.select === "*")
      return { data: deck({ id: "source", visibility: "public" }) };
    if (call.table === "deck_cards" && call.op === "select")
      return {
        data: [
          {
            id: "card-1",
            deck_id: "source",
            oracle_id: "o-bolt",
            printing_id: null,
            card_name: "Lightning Bolt",
            quantity: 4,
            board: "main",
            category: null,
          },
        ],
      };
    if (call.table === "decks" && call.op === "insert")
      return { data: { id: "copy-1" } };
    if (call.table === "deck_cards" && call.op === "insert")
      return { error: { message: "cards failed" } };
    return undefined;
  });
  assert.deepEqual(
    await actions.cloneUserDeck({ deckId: "source" }),
    { ok: false, error: "cards failed" },
  );
});
