import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { closeTestDb, connectTestDb, hasTestMongo } from "@/test/mongo";

const skip = !hasTestMongo();

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function cardEntry(
  name: string,
  quantity: number,
  oracleId: string | null,
  typeLine: string,
  colors: string[] = [],
) {
  return {
    name,
    quantity,
    oracle_id: oracleId,
    printing_id: null,
    type_line: typeLine,
    image: null,
    colors,
  };
}

function deck(overrides: Record<string, unknown>) {
  return {
    event_slug: "challenge-1",
    event_name: "Challenge 1",
    event_type: "challenge",
    event_date: daysAgo(5),
    player: "Player",
    rank: 1,
    wins: 0,
    losses: 0,
    color_identity: [],
    mainboard: [],
    sideboard: [],
    archetype: { slug: "mono-blue-terror", name: "Mono-Blue Terror", confidence: 1 },
    classification_version: "1",
    scraped_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const recentDecks = [
  deck({
    event_slug: "challenge-1",
    event_name: "Challenge 1",
    event_date: daysAgo(5),
    player: "Alice",
    rank: 1,
    wins: 5,
    losses: 1,
    color_identity: ["U"],
    mainboard: [
      cardEntry("Delver of Secrets", 4, "o-delver", "Creature — Human Wizard", ["U"]),
      cardEntry("Counterspell", 4, "o-counter", "Instant", ["U"]),
      cardEntry("Island", 18, "o-island", "Basic Land — Island"),
    ],
    sideboard: [
      cardEntry("Hydroblast", 3, "o-hydro", "Instant", ["U"]),
      cardEntry("Blue Elemental Blast", 1, "o-beb", "Instant", ["U"]),
    ],
  }),
  deck({
    event_slug: "challenge-1",
    event_name: "Challenge 1",
    event_date: daysAgo(5),
    player: "Bob",
    rank: 2,
    wins: 3,
    losses: 2,
    color_identity: ["U"],
    mainboard: [
      cardEntry("Delver of Secrets", 4, "o-delver", "Creature — Human Wizard", ["U"]),
      cardEntry("Island", 22, "o-island", "Basic Land — Island"),
    ],
    sideboard: [cardEntry("Hydroblast", 2, "o-hydro", "Instant", ["U"])],
  }),
  deck({
    event_slug: "league-1",
    event_name: "League 1",
    event_type: "league",
    event_date: daysAgo(10),
    player: "Carol",
    rank: 5,
    wins: 4,
    losses: 0,
    color_identity: ["U", "B"],
    archetype: { slug: "dimir-faeries", name: "Dimir Faeries", confidence: 1 },
    mainboard: [
      cardEntry("Spellstutter Sprite", 4, "o-sprite", "Creature — Faerie Wizard", ["U"]),
      cardEntry("Bitterblossom", 4, "o-bitter", "Enchantment", ["B"]),
      cardEntry("Island", 10, "o-island", "Basic Land — Island"),
      cardEntry("Swamp", 8, "o-swamp", "Basic Land — Swamp"),
    ],
    sideboard: [cardEntry("Hydroblast", 2, "o-hydro", "Instant", ["U"])],
  }),
  deck({
    event_slug: "league-1",
    event_name: "League 1",
    event_type: "league",
    event_date: daysAgo(10),
    player: "Dave",
    rank: null,
    wins: null,
    losses: null,
    color_identity: ["B", "R"],
    archetype: { slug: "other", name: "Other", confidence: 0 },
    mainboard: [
      cardEntry("Lightning Bolt", 4, "o-bolt", "Instant", ["R"]),
      cardEntry("Bitterblossom", 4, "o-bitter", "Enchantment", ["B"]),
      cardEntry("Mountain", 20, "o-mountain", "Basic Land — Mountain"),
    ],
  }),
  deck({
    event_slug: "recent-2",
    event_name: "Recent 2",
    event_type: "preliminary",
    event_date: daysAgo(3),
    player: "Frank",
    rank: 3,
    wins: 2,
    losses: 2,
    color_identity: ["U"],
    archetype: { slug: "affinity", name: "Affinity", confidence: 1 },
    mainboard: [
      cardEntry("Thoughtcast", 4, "o-thoughtcast", "Sorcery", ["U"]),
      cardEntry("Seat of the Synod", 4, "o-seat", "Artifact Land"),
      cardEntry("Island", 8, "o-island", "Basic Land — Island"),
    ],
    sideboard: [cardEntry("Hydroblast", 1, "o-hydro", "Instant", ["U"])],
  }),
  deck({
    event_slug: "old-event",
    event_name: "Old Event",
    event_date: daysAgo(200),
    player: "Eve",
    rank: 1,
    wins: 5,
    losses: 0,
    color_identity: ["U"],
    mainboard: [
      cardEntry("Delver of Secrets", 4, "o-delver", "Creature — Human Wizard", ["U"]),
      cardEntry("Island", 20, "o-island", "Basic Land — Island"),
    ],
  }),
];

const events = [
  {
    slug: "challenge-1",
    name: "Challenge 1",
    event_type: "challenge",
    date: daysAgo(5),
    url: "https://example.test/challenge-1",
    player_count: 32,
    deck_count: 2,
    scraped_at: "2026-01-01T00:00:00.000Z",
  },
  {
    slug: "big-1",
    name: "Big Event",
    event_type: "showcase",
    date: daysAgo(1),
    url: "https://example.test/big-1",
    player_count: 150,
    deck_count: 0,
    scraped_at: "2026-01-04T00:00:00.000Z",
  },
  {
    slug: "league-1",
    name: "League 1",
    event_type: "league",
    date: daysAgo(10),
    url: "https://example.test/league-1",
    player_count: 16,
    deck_count: 2,
    scraped_at: "2026-01-02T00:00:00.000Z",
  },
  {
    slug: "recent-2",
    name: "Recent 2",
    event_type: "preliminary",
    date: daysAgo(3),
    url: "https://example.test/recent-2",
    player_count: 8,
    deck_count: 1,
    scraped_at: "2026-01-03T00:00:00.000Z",
  },
  {
    slug: "old-event",
    name: "Old Event",
    event_type: "challenge",
    date: daysAgo(200),
    url: "https://example.test/old-event",
    player_count: 64,
    deck_count: 1,
    scraped_at: "2025-01-01T00:00:00.000Z",
  },
];

const endstepArchetypes = [
  {
    format_id: "Pauper",
    slug: "blue-terror-9eb65470",
    name: "Blue Terror",
    share_rate: 0.12,
    players: 100,
    colours: ["U"],
    key_cards: ["Delver of Secrets"],
    art: { card_name: "Delver of Secrets" },
    sample_list: { main: [{ name: "Delver of Secrets", count: 4 }], side: [] },
  },
  {
    format_id: "Pauper",
    slug: "dimir-faeries-92f62264",
    name: "Dimir Faeries",
    share_rate: 0.08,
    players: 80,
    colours: ["U", "B"],
    key_cards: ["Spellstutter Sprite"],
    art: { card_name: "Spellstutter Sprite" },
    sample_list: { main: [{ name: "Spellstutter Sprite", count: 4 }], side: [] },
  },
  {
    format_id: "Pauper",
    slug: "delver-other",
    name: "Delver Other",
    share_rate: 0.05,
    players: 40,
    colours: ["U"],
    key_cards: ["Delver of Secrets"],
    art: null,
    sample_list: { main: [{ name: "Delver of Secrets", count: 4 }], side: [] },
  },
  {
    format_id: "Pauper",
    slug: "empty-sample",
    name: "Empty Sample",
    share_rate: 0.5,
    players: 10,
    colours: [],
    key_cards: [],
    art: null,
    sample_list: { main: [], side: [] },
  },
  {
    format_id: "Pauper",
    slug: "affinity-e93f5f74",
    name: "Affinity",
    share_rate: 0.05,
    players: 30,
    colours: ["U"],
    key_cards: [],
    art: null,
    sample_list: { main: [], side: [] },
  },
  {
    format_id: "Modern",
    slug: "modern-delver",
    name: "Modern Delver",
    share_rate: 0.9,
    players: 10,
    colours: ["U"],
    key_cards: [],
    art: null,
    sample_list: { main: [{ name: "Delver of Secrets", count: 4 }], side: [] },
  },
];

const cards = [
  {
    oracle_id: "o-delver",
    name: "Delver of Secrets // Insectile Aberration",
    name_normalized: "delver of secrets // insectile aberration",
    type_line: "Creature — Human Wizard // Creature — Human Insect",
    image_uris: { small: null, normal: "delver.jpg", large: null, art_crop: "delver-art" },
    card_faces: null,
    metagame_printing_id: "p-delver",
  },
  {
    oracle_id: "o-counter",
    name: "Counterspell",
    name_normalized: "counterspell",
    type_line: "Instant",
    image_uris: { small: null, normal: "counter.jpg", large: null, art_crop: "counter-art" },
    card_faces: null,
    metagame_printing_id: null,
  },
  {
    oracle_id: "o-sprite",
    name: "Spellstutter Sprite",
    name_normalized: "spellstutter sprite",
    type_line: "Creature — Faerie Wizard",
    image_uris: { small: null, normal: "sprite.jpg", large: null, art_crop: "sprite-art" },
    card_faces: null,
    metagame_printing_id: null,
  },
  {
    oracle_id: "o-bitter",
    name: "Bitterblossom",
    name_normalized: "bitterblossom",
    type_line: "Enchantment",
    image_uris: { small: null, normal: "bitter.jpg", large: null, art_crop: "bitter-art" },
    card_faces: null,
    metagame_printing_id: null,
  },
  {
    oracle_id: "o-bolt",
    name: "Lightning Bolt",
    name_normalized: "lightning bolt",
    type_line: "Instant",
    image_uris: { small: null, normal: "bolt.jpg", large: null, art_crop: "bolt-art" },
    card_faces: null,
    metagame_printing_id: null,
  },
  {
    oracle_id: "o-thoughtcast",
    name: "Thoughtcast",
    name_normalized: "thoughtcast",
    type_line: "Sorcery",
    image_uris: { small: null, normal: "thought.jpg", large: null, art_crop: "thought-art" },
    card_faces: null,
    metagame_printing_id: null,
  },
];

const printings = [
  {
    scryfall_id: "p-delver",
    oracle_id: "o-delver",
    name: "Delver of Secrets // Insectile Aberration",
    released_at: "2011-09-30",
    image_uris: { small: null, normal: null, large: null, art_crop: "delver-print-art" },
    card_faces: null,
  },
];

describe("metagame queries", { skip }, () => {
  let queries: typeof import("./queries");
  let endstep: typeof import("./endstep");
  let mongo: typeof import("@/lib/mongo/client");
  const previousEndstep = process.env.METAGAME_ENDSTEP_ENABLED;

  before(async () => {
    process.env.METAGAME_ENDSTEP_ENABLED = "true";
    const db = await connectTestDb("metagame");
    await db.collection("metagame_events").insertMany(events);
    await db.collection("metagame_decks").insertMany(recentDecks);
    await db.collection("endstep_archetypes").insertMany(endstepArchetypes);
    await db.collection("cards").insertMany(cards);
    await db.collection("printings").insertMany(printings);
    await db.collection("endstep_matchups").insertMany([
      {
        format_id: "Pauper",
        archetype_slug: "blue-terror-9eb65470",
        opponent_slug: "a",
        window: "30d",
        population: "Pauper",
        share_rate_at_sync: null,
        fetched_at: "2026-01-01T00:00:00.000Z",
        match: {
          opponent_id: "a",
          opponent_slug: "a",
          opponent_name: "Opponent A",
          wins: 10,
          losses: 5,
          matches: 15,
          rate: 0.67,
          low: null,
          high: null,
          deff: null,
        },
      },
      {
        format_id: "Pauper",
        archetype_slug: "blue-terror-9eb65470",
        opponent_slug: "b",
        window: "30d",
        population: "Pauper",
        share_rate_at_sync: null,
        fetched_at: "2026-01-01T00:00:00.000Z",
        match: {
          opponent_id: "b",
          opponent_slug: "b",
          opponent_name: "Opponent B",
          wins: 3,
          losses: 7,
          matches: 10,
          rate: 0.3,
          low: null,
          high: null,
          deff: null,
        },
      },
      {
        format_id: "Pauper",
        archetype_slug: "blue-terror-9eb65470",
        opponent_slug: "c",
        window: "30d",
        population: "Pauper",
        share_rate_at_sync: null,
        fetched_at: "2026-01-01T00:00:00.000Z",
        match: {
          opponent_id: "c",
          opponent_slug: "c",
          opponent_name: "Opponent C",
          wins: 2,
          losses: 1,
          rate: 0.67,
          low: null,
          high: null,
          deff: null,
        },
      },
      {
        format_id: "Pauper",
        archetype_slug: "blue-terror-9eb65470",
        opponent_slug: "old",
        window: "7d",
        population: "Pauper",
        share_rate_at_sync: null,
        fetched_at: "2026-01-01T00:00:00.000Z",
        match: {
          opponent_id: "old",
          opponent_slug: "old",
          opponent_name: "Old",
          wins: 100,
          losses: 0,
          matches: 100,
          rate: 1,
          low: null,
          high: null,
          deff: null,
        },
      },
    ]);
    queries = await import("./queries");
    endstep = await import("./endstep");
    mongo = await import("@/lib/mongo/client");
  });

  after(async () => {
    await mongo.closeDb();
    await closeTestDb();
    if (previousEndstep == null) delete process.env.METAGAME_ENDSTEP_ENABLED;
    else process.env.METAGAME_ENDSTEP_ENABLED = previousEndstep;
  });

  test("listEvents sorts by date then scraped_at and respects the limit", async () => {
    const all = await queries.listEvents();
    assert.deepEqual(
      all.map((event) => event.slug),
      ["big-1", "recent-2", "challenge-1", "league-1", "old-event"],
    );
    assert.equal(all.some((event) => "_id" in event), false);

    const limited = await queries.listEvents(2);
    assert.deepEqual(
      limited.map((event) => event.slug),
      ["big-1", "recent-2"],
    );
  });

  test("listBigEvents returns only events with at least 100 players", async () => {
    const big = await queries.listBigEvents(3);
    assert.deepEqual(big.map((event) => event.slug), ["big-1"]);
    assert.equal(big[0].player_count, 150);
    assert.equal("_id" in big[0], false);
  });

  test("getEvent returns the event and its decks in rank order", async () => {
    const found = await queries.getEvent("challenge-1");
    assert.ok(found);
    assert.equal(found.event.name, "Challenge 1");
    assert.deepEqual(
      found.decks.map((entry) => entry.player),
      ["Alice", "Bob"],
    );
    assert.equal(await queries.getEvent("missing"), null);
  });

  test("listDecksByArchetype filters and limits", async () => {
    const found = await queries.listDecksByArchetype("mono-blue-terror", 1);
    assert.equal(found.length, 1);
    assert.equal(found[0].player, "Alice");

    const all = await queries.listDecksByArchetype("mono-blue-terror");
    assert.deepEqual(
      all.map((entry) => entry.player),
      ["Alice", "Bob", "Eve"],
    );
    assert.deepEqual(await queries.listDecksByArchetype("missing"), []);
  });

  test("listArchetypes counts recent decks and hides 'other'", async () => {
    const found = await queries.listArchetypes();
    assert.equal(found.length, 3);
    assert.equal(found[0].slug, "mono-blue-terror");
    assert.deepEqual(
      new Set(found.map((entry) => entry.slug)),
      new Set(["mono-blue-terror", "affinity", "dimir-faeries"]),
    );
    assert.equal(found[0].name, "Mono-Blue Terror");
    assert.equal(found[0].decks, 2);
    assert.equal(found.some((entry) => entry.slug === "other"), false);
  });

  test("getMetagameDeck finds one deck by event and player", async () => {
    const found = await queries.getMetagameDeck("challenge-1", "Alice");
    assert.ok(found);
    assert.equal(found.archetype.slug, "mono-blue-terror");
    assert.equal(await queries.getMetagameDeck("challenge-1", "Nobody"), null);
  });

  test("getEndstepShareByRule maps endstep shares onto rule slugs", async () => {
    const shares = await queries.getEndstepShareByRule();
    assert.equal(shares.get("mono-blue-terror"), 0.12);
    assert.equal(shares.get("delver"), 0.12);
    assert.equal(shares.get("dimir-faeries"), 0.08);
    assert.equal(shares.get("affinity"), 0.05);
    assert.equal(shares.has("storm"), false);
  });

  test("listArchetypeOverview computes shares, colors, ranks and signatures", async () => {
    const overview = await queries.listArchetypeOverview(30);
    const bySlug = new Map(overview.map((entry) => [entry.slug, entry]));

    const terror = bySlug.get("mono-blue-terror");
    assert.ok(terror);
    assert.equal(terror.decks, 2);
    assert.equal(terror.share, 0.12);
    assert.deepEqual(terror.color_identity, ["U"]);
    assert.equal(terror.average_rank, 1.5);
    assert.equal(terror.signature_name, "Delver of Secrets");
    assert.equal(terror.art_crop, "delver-print-art");

    const faeries = bySlug.get("dimir-faeries");
    assert.ok(faeries);
    assert.equal(faeries.share, 0.08);
    assert.deepEqual(faeries.color_identity, ["U", "B"]);
    assert.equal(faeries.average_rank, 5);
    assert.equal(faeries.signature_name, "Spellstutter Sprite");
    assert.equal(faeries.art_crop, "sprite-art");

    const other = bySlug.get("other");
    assert.ok(other);
    assert.equal(other.share, 1 / 5);
    assert.equal(other.average_rank, null);
    assert.equal(other.signature_name, "Lightning Bolt");
    assert.equal(other.art_crop, "bolt-art");

    const affinity = bySlug.get("affinity");
    assert.ok(affinity);
    assert.equal(affinity.share, 0.05);
    assert.equal(affinity.signature_name, "Thoughtcast");
    assert.equal(affinity.art_crop, "thought-art");
  });

  test("getArchetypeBreakdown aggregates main and side statistics", async () => {
    const breakdown = await queries.getArchetypeBreakdown("mono-blue-terror", 30);
    assert.ok(breakdown);
    assert.equal(breakdown.name, "Mono-Blue Terror");
    assert.equal(breakdown.decks, 2);
    assert.equal(breakdown.average_main_size, 26);
    assert.equal(breakdown.average_side_size, 3);

    const delver = breakdown.main.find((entry) => entry.name === "Delver of Secrets");
    assert.ok(delver);
    assert.equal(delver.decks, 2);
    assert.equal(delver.include_rate, 1);
    assert.equal(delver.avg_qty, 4);
    assert.equal(delver.min_qty, 4);
    assert.equal(delver.max_qty, 4);

    const island = breakdown.main.find((entry) => entry.name === "Island");
    assert.ok(island);
    assert.equal(island.avg_qty, 20);

    const hydro = breakdown.side.find((entry) => entry.name === "Hydroblast");
    assert.ok(hydro);
    assert.equal(hydro.decks, 2);
    assert.equal(hydro.avg_qty, 2.5);

    assert.equal(await queries.getArchetypeBreakdown("missing"), null);
  });

  test("getArchetypesForCard reports inclusion by archetype", async () => {
    const usage = await queries.getArchetypesForCard("o-delver", 120);
    const terror = usage.find((entry) => entry.slug === "mono-blue-terror");
    assert.ok(terror);
    assert.equal(terror.decks, 2);
    assert.equal(terror.total_decks, 2);
    assert.equal(terror.include_rate, 1);
    assert.equal(terror.avg_qty, 4);

    const bolt = await queries.getArchetypesForCard("o-bolt", 120);
    assert.deepEqual(bolt.map((entry) => entry.slug), ["other"]);
    assert.equal(bolt[0].include_rate, 1);

    assert.deepEqual(await queries.getArchetypesForCard("missing", 120), []);
  });

  test("getMetagameSummary aggregates totals and top cards", async () => {
    const summary = await queries.getMetagameSummary(30);
    assert.equal(summary.events, 4);
    assert.equal(summary.decks, 5);
    assert.ok(summary.since);

    const terror = summary.archetypes.find((entry) => entry.slug === "mono-blue-terror");
    assert.ok(terror);
    assert.equal(terror.decks, 2);
    assert.equal(terror.meta_share, 2 / 5);
    assert.equal(terror.wins, 8);
    assert.equal(terror.losses, 3);
    assert.equal(terror.win_rate, 8 / 11);
    assert.equal(terror.average_rank, 1.5);
    assert.deepEqual(terror.color_identity, ["U"]);
    assert.deepEqual(terror.top_cards[0], { name: "Island", count: 40 });
    assert.equal(terror.top_cards.length, 3);

    const other = summary.archetypes.find((entry) => entry.slug === "other");
    assert.ok(other);
    assert.equal(other.win_rate, null);
    assert.equal(other.average_rank, null);
    assert.deepEqual(other.top_cards[0], { name: "Mountain", count: 20 });
  });

  test("listStaples groups maindeck cards and sideboard staples", async () => {
    const staples = await queries.listStaples(30, 10);
    assert.equal(staples.decks, 5);
    assert.equal(staples.creatures[0].name, "Delver of Secrets");
    assert.equal(staples.creatures[0].decks, 2);
    assert.equal(staples.creatures[0].copies, 8);
    assert.equal(staples.creatures[0].art_crop, "delver-print-art");
    assert.equal(staples.noncreatures[0].name, "Bitterblossom");
    assert.equal(staples.noncreatures[0].decks, 2);
    assert.equal(staples.lands[0].name, "Island");
    assert.equal(staples.lands[0].decks, 4);
    assert.equal(staples.lands[0].copies, 58);
    assert.equal(staples.sideboard[0].name, "Hydroblast");
    assert.equal(staples.sideboard[0].decks, 4);
    assert.equal(staples.sideboard[0].copies, 8);
  });

  test("listStapleCategory filters by category and respects the limit", async () => {
    const creatures = await queries.listStapleCategory(30, "creatures", 1);
    assert.equal(creatures.decks, 5);
    assert.deepEqual(creatures.cards.map((entry) => entry.name), ["Delver of Secrets"]);

    const spells = await queries.listStapleCategory(30, "spells");
    assert.equal(spells.cards[0].name, "Bitterblossom");
    assert.equal(spells.cards.some((entry) => entry.name === "Island"), false);

    const lands = await queries.listStapleCategory(30, "lands");
    assert.equal(lands.cards[0].name, "Island");

    const sideboard = await queries.listStapleCategory(30, "sideboard");
    assert.equal(sideboard.cards[0].name, "Hydroblast");
    assert.equal(sideboard.cards[0].decks, 4);
  });

  test("getArchetypeStat returns one archetype without scanning the rest", async () => {
    const stat = await queries.getArchetypeStat("mono-blue-terror", 30);
    assert.ok(stat);
    assert.equal(stat.decks, 2);
    assert.equal(stat.meta_share, 2 / 5);
    assert.equal(stat.wins, 8);
    assert.equal(stat.losses, 3);
    assert.equal(stat.win_rate, 8 / 11);
    assert.equal(stat.average_rank, 1.5);
    assert.deepEqual(stat.color_identity, ["U"]);
    assert.deepEqual(stat.top_cards, [
      { name: "Island", count: 40 },
      { name: "Delver of Secrets", count: 8 },
      { name: "Counterspell", count: 4 },
    ]);
    assert.equal(await queries.getArchetypeStat("missing"), null);
  });

  test("getArchetypeMatchups returns the current window only", async () => {
    const matchups = await queries.getArchetypeMatchups("mono-blue-terror", 30);
    assert.equal(matchups.length, 3);
    assert.equal(matchups[0].opponent_slug, "a");
    assert.equal(matchups[1].opponent_slug, "b");
    assert.deepEqual(await queries.getArchetypeMatchups("storm", 30), []);
    assert.deepEqual(await queries.getArchetypeMatchups("unknown", 30), []);
  });

  test("getEndstepArchetypeRecord sums wins, losses and matches", async () => {
    const record = await queries.getEndstepArchetypeRecord("mono-blue-terror", 30);
    assert.ok(record);
    assert.equal(record.wins, 15);
    assert.equal(record.losses, 13);
    assert.equal(record.matches, 28);
    assert.equal(record.win_rate, 15 / 28);
    assert.equal(record.source, "endstep");

    assert.equal(await queries.getEndstepArchetypeRecord("storm", 30), null);
    assert.equal(await queries.getEndstepArchetypeRecord("unknown", 30), null);
  });

  test("listEndstepArchetypes only returns playable Pauper archetypes", async () => {
    const found = await endstep.listEndstepArchetypes();
    assert.deepEqual(
      found.map((entry) => entry.slug),
      ["blue-terror-9eb65470", "dimir-faeries-92f62264", "delver-other"],
    );
    assert.equal(found[0].name, "Blue Terror");
    assert.equal("_id" in found[0], false);
    assert.equal("sample_list" in found[0], false);

    const limited = await endstep.listEndstepArchetypes("Pauper", 2);
    assert.equal(limited.length, 2);
    assert.deepEqual(await endstep.listEndstepArchetypes("Legacy"), []);
  });

  test("getEndstepArchetype returns the full archetype or null", async () => {
    const found = await endstep.getEndstepArchetype("blue-terror-9eb65470");
    assert.ok(found);
    assert.equal(found.name, "Blue Terror");
    assert.equal(found.sample_list.main[0].name, "Delver of Secrets");
    assert.equal("_id" in found, false);

    assert.equal(await endstep.getEndstepArchetype("blue-terror-9eb65470", "Modern"), null);
    assert.equal(await endstep.getEndstepArchetype("missing"), null);
  });

  test("getEndstepArchetypesForCard finds sample lists containing a card", async () => {
    const found = await endstep.getEndstepArchetypesForCard("Delver of Secrets");
    assert.deepEqual(
      found.map((entry) => entry.slug),
      ["blue-terror-9eb65470", "delver-other"],
    );

    const sprites = await endstep.getEndstepArchetypesForCard("Spellstutter Sprite");
    assert.deepEqual(sprites.map((entry) => entry.slug), ["dimir-faeries-92f62264"]);

    assert.deepEqual(await endstep.getEndstepArchetypesForCard("Missing"), []);
  });
});
