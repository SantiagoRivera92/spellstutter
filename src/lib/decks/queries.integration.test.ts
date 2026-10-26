import { before, test, mock } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Printing } from "@/lib/cards/types";
import type {
  Deck,
  DeckCard,
  DeckComment,
  Folder,
  Profile,
} from "@/lib/supabase/types";

interface TestSession {
  id: string;
  email: string;
  profile: Profile | null;
}

interface Call {
  table: string;
  select?: string;
  filters: { column: string; value: unknown }[];
  orders: string[];
  limit?: number;
}

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

type Handler = (call: Call) => { data?: unknown } | undefined;

class FakeQuery {
  private selectColumns: string | undefined;
  private filters: { column: string; value: unknown }[] = [];
  private orders: string[] = [];
  private limitValue: number | undefined;

  constructor(
    private table: string,
    private handler: Handler,
    private calls: Call[],
  ) {}

  select(columns?: string) {
    this.selectColumns = columns;
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

  order(column: string, options?: unknown) {
    void options;
    this.orders.push(column);
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  maybeSingle() {
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
      select: this.selectColumns,
      filters: this.filters,
      orders: this.orders,
      limit: this.limitValue,
    };
    this.calls.push(call);
    const result = this.handler(call) ?? {};
    return { data: result.data ?? null, error: null };
  }
}

function fakeSupabase(handler: Handler) {
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

type MockModuleOptions = Parameters<typeof mock.module>[1];

function mockModule(
  specifier: string,
  options: { exports: Record<string, unknown> },
) {
  mock.module(specifier, options as unknown as MockModuleOptions);
}

const alice: Profile = {
  id: "user-1",
  username: "alice",
  display_name: "Alice",
  bio: null,
  avatar_card_oracle_id: null,
  avatar_card_name: null,
  avatar_art_url: null,
  is_public: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const bob: Profile = {
  ...alice,
  id: "user-2",
  username: "bob",
  display_name: "Bob",
};

const folders: Folder[] = [
  {
    id: "f1",
    user_id: "user-1",
    parent_id: null,
    name: "Alpha",
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "f2",
    user_id: "user-1",
    parent_id: "f1",
    name: "Nested",
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "f3",
    user_id: "user-1",
    parent_id: null,
    name: "Beta",
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const decks: Deck[] = [
  {
    id: "d1",
    user_id: "user-1",
    folder_id: "f1",
    name: "Deck 1",
    description: null,
    visibility: "private",
    cover_oracle_id: null,
    cover_printing_id: null,
    cover_art_url: "cover-1",
    archetype_slug: null,
    format: "pauper",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "d2",
    user_id: "user-1",
    folder_id: null,
    name: "Deck 2",
    description: null,
    visibility: "public",
    cover_oracle_id: null,
    cover_printing_id: null,
    cover_art_url: null,
    archetype_slug: null,
    format: "pauper",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "d3",
    user_id: "user-2",
    folder_id: null,
    name: "Other Deck",
    description: null,
    visibility: "public",
    cover_oracle_id: null,
    cover_printing_id: null,
    cover_art_url: "cover-3",
    archetype_slug: null,
    format: "pauper",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "d4",
    user_id: "user-2",
    folder_id: null,
    name: "Secret Deck",
    description: null,
    visibility: "private",
    cover_oracle_id: null,
    cover_printing_id: null,
    cover_art_url: null,
    archetype_slug: null,
    format: "pauper",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-04T00:00:00.000Z",
  },
];

const deckCards: DeckCard[] = [
  {
    id: "c1",
    deck_id: "d1",
    oracle_id: "o-bolt",
    printing_id: "p-bolt",
    card_name: "Lightning Bolt",
    quantity: 4,
    board: "main",
    category: null,
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "c2",
    deck_id: "d1",
    oracle_id: "o-delver",
    printing_id: "p-delver",
    card_name: "Delver of Secrets",
    quantity: 2,
    board: "main",
    category: null,
    position: 2,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "c3",
    deck_id: "d1",
    oracle_id: "o-hydro",
    printing_id: null,
    card_name: "Hydroblast",
    quantity: 3,
    board: "side",
    category: null,
    position: 3,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "c4",
    deck_id: "d2",
    oracle_id: "o-island",
    printing_id: null,
    card_name: "Island",
    quantity: 20,
    board: "main",
    category: null,
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "c5",
    deck_id: "d3",
    oracle_id: "o-bolt",
    printing_id: "p-bolt",
    card_name: "Lightning Bolt",
    quantity: 4,
    board: "main",
    category: null,
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const comments: DeckComment[] = [
  {
    id: "cm1",
    deck_id: "d1",
    user_id: "user-2",
    parent_id: null,
    body: "First",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cm2",
    deck_id: "d1",
    user_id: "user-1",
    parent_id: "cm1",
    body: "Reply",
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "cm3",
    deck_id: "d1",
    user_id: "user-2",
    parent_id: null,
    body: "Second",
    created_at: "2026-01-03T00:00:00.000Z",
    updated_at: "2026-01-03T00:00:00.000Z",
  },
];

function boltCard(): Card {
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
    image_uris: { small: null, normal: "bolt.jpg", large: null, art_crop: "bolt-art" },
    card_faces: null,
    prices: { usd: 1, usd_foil: null },
    edhrec_rank: null,
    scryfall_uri: "",
    mtgo_id: 101,
    default_printing_id: "p-bolt",
    metagame_printing_id: null,
    printings_count: 1,
    legalities: { pauper: "legal" },
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function delverCard(): Card {
  return {
    ...boltCard(),
    oracle_id: "o-delver",
    name: "Delver of Secrets",
    name_normalized: "delver of secrets",
    mana_cost: "{U}",
    type_line: "Creature — Human Wizard",
    colors: ["U"],
    color_identity: ["U"],
    oracle_text: "Flying",
    default_printing_id: "p-delver",
    image_uris: { small: null, normal: "delver.jpg", large: null, art_crop: "delver-art" },
  };
}

function islandCard(): Card {
  return {
    ...boltCard(),
    oracle_id: "o-island",
    name: "Island",
    name_normalized: "island",
    mana_cost: "",
    cmc: 0,
    type_line: "Basic Land — Island",
    colors: [],
    color_identity: ["U"],
    oracle_text: "",
    default_printing_id: "p-island",
    image_uris: { small: null, normal: "island.jpg", large: null, art_crop: "island-art" },
  };
}

function hydroCard(): Card {
  return {
    ...boltCard(),
    oracle_id: "o-hydro",
    name: "Hydroblast",
    name_normalized: "hydroblast",
    mana_cost: "{U}",
    type_line: "Instant",
    colors: ["U"],
    color_identity: ["U"],
    oracle_text: "Counter target red spell.",
    default_printing_id: "p-hydro",
    image_uris: { small: null, normal: "hydro.jpg", large: null, art_crop: "hydro-art" },
  };
}

function boltPrinting(): Printing {
  return {
    scryfall_id: "p-bolt",
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    set: "lea",
    set_name: "Limited Edition Alpha",
    collector_number: "161",
    rarity: "common",
    released_at: "1993-08-05",
    image_uris: { small: null, normal: "bolt-print.jpg", large: null, art_crop: "bolt-print-art" },
    card_faces: null,
    prices: { usd: 2, usd_foil: null },
    finishes: ["nonfoil"],
    promo: false,
    digital: false,
    mtgo_id: 101,
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

let queries: typeof import("./queries");
let currentSession: TestSession | null;
let currentSupabase: SupabaseClient;
let mongoConfigured = true;
let cardsByOracleIds: (ids: string[]) => Promise<Card[]>;
let printingsByIds: (ids: string[]) => Promise<Printing[]>;

function defaultHandler(call: Call): { data?: unknown } | undefined {
  if (call.table === "folders") return { data: folders };
  if (call.table === "profiles") {
    if (filter(call, "username") === "alice") return { data: alice };
    if (filter(call, "id") === "user-1") return { data: alice };
    if (filter(call, "id") === "user-2") return { data: bob };
    if (filter(call, "username") === "missing") return { data: null };
    const ids = filter(call, "id");
    if (Array.isArray(ids)) {
      return { data: [alice, bob].filter((profile) => ids.includes(profile.id)) };
    }
    if (call.filters.length === 0) return { data: [alice, bob] };
    return { data: null };
  }
  if (call.table === "decks") {
    const id = filter(call, "id");
    if (typeof id === "string") return { data: decks.find((deck) => deck.id === id) ?? null };
    const userId = filter(call, "user_id");
    if (typeof userId === "string") {
      return {
        data: decks.filter(
          (deck) => deck.user_id === userId && deck.visibility === "public",
        ),
      };
    }
    if (filter(call, "visibility") === "public") {
      const publicDecks = decks
        .filter((deck) => deck.visibility === "public")
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return { data: call.limit ? publicDecks.slice(0, call.limit) : publicDecks };
    }
    return { data: decks.filter((deck) => deck.user_id === "user-1") };
  }
  if (call.table === "deck_cards") {
    const deckId = filter(call, "deck_id");
    if (typeof deckId === "string") {
      return { data: deckCards.filter((card) => card.deck_id === deckId) };
    }
    const ids = filter(call, "deck_id");
    if (Array.isArray(ids)) {
      return { data: deckCards.filter((card) => ids.includes(card.deck_id)) };
    }
    return { data: deckCards };
  }
  if (call.table === "deck_comments") return { data: comments };
  return undefined;
}

function useSupabase(handler: Handler = defaultHandler) {
  const fake = fakeSupabase(handler);
  currentSupabase = fake.client;
  currentSession = { id: "user-1", email: "alice@example.test", profile: alice };
  mongoConfigured = true;
  cardsByOracleIds = async () => [boltCard(), delverCard(), islandCard(), hydroCard()];
  printingsByIds = async () => [boltPrinting()];
  return fake;
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
      getCardsByOracleIds: (ids: string[]) => cardsByOracleIds(ids),
      getPrintingsByIds: (ids: string[]) => printingsByIds(ids),
    },
  });
  queries = await import("./queries");
});

test("getLibrary returns null without a session", async () => {
  useSupabase();
  currentSession = null;
  assert.equal(await queries.getLibrary(), null);
});

test("getLibrary builds the folder tree and deck summaries", async () => {
  useSupabase();
  const library = await queries.getLibrary();
  assert.ok(library);
  assert.equal(library.profile?.username, "alice");
  assert.deepEqual(
    library.folders.map((folder) => folder.id),
    ["f1", "f3"],
  );
  assert.deepEqual(
    library.folders[0].children.map((folder) => folder.id),
    ["f2"],
  );
  assert.equal(library.folders[0].deck_count, 1);

  assert.deepEqual(
    library.decks.map((deck) => deck.id),
    ["d1", "d2"],
  );
  const deck1 = library.decks[0];
  assert.equal(deck1.card_count, 6);
  assert.deepEqual(deck1.color_identity, ["U", "R"]);
  assert.equal(deck1.cover_art_url, "cover-1");
  assert.equal(library.decks[1].card_count, 20);
  assert.deepEqual(library.decks[1].color_identity, ["U"]);
});

test("getLibrary tolerates a missing card catalog", async () => {
  useSupabase();
  mongoConfigured = false;
  const library = await queries.getLibrary();
  assert.ok(library);
  assert.equal(library.decks[0].card_count, 6);
  assert.deepEqual(library.decks[0].color_identity, []);
});

test("getDeckView joins cards and printings", async () => {
  useSupabase();
  const view = await queries.getDeckView("d1");
  assert.ok(view);
  assert.equal(view.deck.id, "d1");
  assert.equal(view.cards.length, 3);
  const bolt = view.cards.find((card) => card.card_name === "Lightning Bolt");
  assert.ok(bolt);
  assert.equal(bolt.mana_cost, "{R}");
  assert.equal(bolt.mana_value, 1);
  assert.equal(bolt.type_line, "Instant");
  assert.equal(bolt.rarity, "common");
  assert.equal(bolt.mtgo_id, 101);
  assert.equal(bolt.art_crop, "bolt-print-art");
  assert.equal(bolt.image_normal, "bolt-print.jpg");
  assert.equal(bolt.price_usd, 2);
  assert.equal(bolt.category_group, "Instant");
  assert.equal(view.stats.total_count, 9);
  assert.equal(view.stats.main_count, 6);
  assert.equal(view.stats.side_count, 3);
});

test("getDeckView returns null for a missing deck", async () => {
  useSupabase();
  assert.equal(await queries.getDeckView("missing"), null);
});

test("getPublicProfile returns only public decks", async () => {
  useSupabase();
  const profile = await queries.getPublicProfile("alice");
  assert.ok(profile);
  assert.equal(profile.profile.username, "alice");
  assert.deepEqual(profile.decks.map((deck) => deck.id), ["d2"]);
  assert.equal(profile.decks[0].card_count, 20);
  assert.deepEqual(profile.decks[0].color_identity, ["U"]);
  assert.equal(await queries.getPublicProfile("missing"), null);
});

test("getProfileByUserId returns a profile or null", async () => {
  useSupabase();
  assert.equal((await queries.getProfileByUserId("user-2"))?.username, "bob");
  assert.equal(await queries.getProfileByUserId("missing"), null);
});

test("getPublicDecks limits and annotates owners", async () => {
  useSupabase();
  const decks = await queries.getPublicDecks(1);
  assert.equal(decks.length, 1);
  assert.equal(decks[0].id, "d3");
  assert.equal(decks[0].owner?.username, "bob");
  assert.equal(decks[0].card_count, 4);
  assert.deepEqual(decks[0].color_identity, ["R"]);
});

test("getDeckComments threads replies and joins authors", async () => {
  useSupabase();
  const roots = await queries.getDeckComments("d1");
  assert.deepEqual(
    roots.map((comment) => comment.id),
    ["cm1", "cm3"],
  );
  assert.equal(roots[0].author?.username, "bob");
  assert.equal(roots[0].replies.length, 1);
  assert.equal(roots[0].replies[0].id, "cm2");
  assert.equal(roots[0].replies[0].author?.username, "alice");
});

test("getFolders returns folders for the signed-in user only", async () => {
  useSupabase();
  const found = await queries.getFolders();
  assert.deepEqual(
    found.map((folder) => folder.id),
    ["f1", "f2", "f3"],
  );

  currentSession = null;
  assert.deepEqual(await queries.getFolders(), []);
});
