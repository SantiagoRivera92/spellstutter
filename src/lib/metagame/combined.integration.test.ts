import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { closeTestDb, connectTestDb, hasTestMongo } from "@/test/mongo";

const skip = !hasTestMongo();

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function deck(overrides: Record<string, unknown>) {
  return {
    event_slug: "melee-1",
    event_name: "Melee 1",
    event_type: "other",
    event_date: daysAgo(5),
    player: "Player",
    rank: 1,
    wins: 0,
    losses: 0,
    draws: 0,
    byes: 0,
    decklist_id: "d1",
    record_source: "pairings",
    color_identity: [],
    mainboard: [],
    sideboard: [],
    archetype: {
      slug: "mono-blue-terror",
      name: "Mono-Blue Terror",
      confidence: 1,
    },
    classification_version: "1",
    scraped_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function matchRow(overrides: Record<string, unknown>) {
  return {
    event_slug: "melee-1",
    event_name: "Melee 1",
    event_date: daysAgo(5),
    round_id: "r1",
    round_number: 1,
    round_name: "Round 1",
    match_id: "m1",
    table_number: 1,
    player: "Alice",
    player_team_id: 1,
    player_decklist_id: "d1",
    player_archetype: { slug: "mono-blue-terror", name: "Mono-Blue Terror" },
    opponent: "Bob",
    opponent_team_id: 2,
    opponent_decklist_id: "d2",
    opponent_archetype: { slug: "dimir-faeries", name: "Dimir Faeries" },
    result: "win",
    game_wins: 2,
    game_losses: 0,
    game_draws: 0,
    source: "melee",
    scraped_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const decks = [
  deck({
    player: "Alice",
    decklist_id: "d1",
    wins: 3,
    losses: 1,
    draws: 1,
    byes: 1,
  }),
  deck({
    player: "Bob",
    decklist_id: "d2",
    archetype: { slug: "dimir-faeries", name: "Dimir Faeries", confidence: 1 },
    wins: 2,
    losses: 2,
  }),
  deck({
    event_slug: "melee-2",
    event_name: "Melee 2",
    player: "Carol",
    decklist_id: "d3",
    archetype: { slug: "affinity", name: "Affinity", confidence: 1 },
    wins: 1,
    losses: 1,
  }),
  deck({
    event_slug: "old-melee",
    event_name: "Old Melee",
    event_date: daysAgo(100),
    player: "Dave",
    decklist_id: "d4",
    wins: 10,
    losses: 0,
  }),
];

const matches = [
  matchRow({ match_id: "m1", player: "Alice", player_decklist_id: "d1", result: "win" }),
  matchRow({
    match_id: "m1",
    player: "Bob",
    player_decklist_id: "d2",
    player_archetype: { slug: "dimir-faeries", name: "Dimir Faeries" },
    opponent: "Alice",
    opponent_decklist_id: "d1",
    opponent_archetype: { slug: "mono-blue-terror", name: "Mono-Blue Terror" },
    result: "loss",
    game_wins: 0,
    game_losses: 2,
  }),
  matchRow({
    match_id: "m2",
    player: "Alice",
    player_decklist_id: "d1",
    opponent: "Carol",
    opponent_decklist_id: "d3",
    opponent_archetype: { slug: "affinity", name: "Affinity" },
    result: "loss",
    game_wins: 1,
    game_losses: 2,
  }),
  matchRow({
    match_id: "m2",
    player: "Carol",
    player_decklist_id: "d3",
    player_archetype: { slug: "affinity", name: "Affinity" },
    opponent: "Alice",
    opponent_decklist_id: "d1",
    opponent_archetype: { slug: "mono-blue-terror", name: "Mono-Blue Terror" },
    result: "win",
    game_wins: 2,
    game_losses: 1,
  }),
  matchRow({
    match_id: "m3",
    player: "Alice",
    player_decklist_id: "d1",
    result: "draw",
    game_wins: 1,
    game_losses: 1,
    game_draws: 1,
  }),
  matchRow({
    match_id: "m3",
    player: "Bob",
    player_decklist_id: "d2",
    player_archetype: { slug: "dimir-faeries", name: "Dimir Faeries" },
    opponent: "Alice",
    opponent_decklist_id: "d1",
    opponent_archetype: { slug: "mono-blue-terror", name: "Mono-Blue Terror" },
    result: "draw",
    game_wins: 1,
    game_losses: 1,
    game_draws: 1,
  }),
  matchRow({
    match_id: "m4",
    player: "Alice",
    player_decklist_id: "d1",
    opponent: null,
    opponent_decklist_id: null,
    opponent_archetype: null,
    result: "bye",
    game_wins: 0,
    game_losses: 0,
  }),
  matchRow({
    match_id: "m-old",
    event_slug: "old-melee",
    event_name: "Old Melee",
    event_date: daysAgo(100),
    player: "Dave",
    player_decklist_id: "d4",
  }),
];

const cardsrealmMatches = [
  matchRow({
    event_slug: "cardsrealm-1",
    event_name: "Cardsrealm 1",
    match_id: "cr1",
    player: "Erin",
    player_decklist_id: "cr-d1",
    player_archetype: { slug: "mono-white-heroic", name: "Mono-White Heroic" },
    opponent: "Frank",
    opponent_decklist_id: "cr-d2",
    opponent_archetype: { slug: "dimir-faeries", name: "Dimir Faeries" },
    result: "win",
    game_wins: 2,
    game_losses: 0,
    source: "cardsrealm",
  }),
  matchRow({
    event_slug: "cardsrealm-1",
    event_name: "Cardsrealm 1",
    match_id: "cr2",
    player: "Erin",
    player_decklist_id: "cr-d1",
    player_archetype: { slug: "mono-white-heroic", name: "Mono-White Heroic" },
    opponent: "Grace",
    opponent_decklist_id: "cr-d3",
    opponent_archetype: { slug: "affinity", name: "Affinity" },
    result: "loss",
    game_wins: 0,
    game_losses: 2,
    source: "cardsrealm",
  }),
];

const endstepMatchups = [
  {
    format_id: "Pauper",
    archetype_slug: "blue-terror-9eb65470",
    opponent_slug: "dimir-faeries-92f62264",
    window: "30d",
    population: "rated",
    share_rate_at_sync: null,
    fetched_at: "2026-01-01T00:00:00.000Z",
    match: {
      opponent_id: "dimir-faeries-92f62264",
      opponent_slug: "dimir-faeries-92f62264",
      opponent_name: "Dimir Faeries",
      wins: 10,
      losses: 5,
      matches: 15,
      rate: 10 / 15,
      low: null,
      high: null,
      deff: null,
    },
  },
  {
    format_id: "Pauper",
    archetype_slug: "blue-terror-9eb65470",
    opponent_slug: "affinity-e93f5f74",
    window: "30d",
    population: "rated",
    share_rate_at_sync: null,
    fetched_at: "2026-01-01T00:00:00.000Z",
    match: {
      opponent_id: "affinity-e93f5f74",
      opponent_slug: "affinity-e93f5f74",
      opponent_name: "Affinity",
      wins: 20,
      losses: 10,
      matches: 30,
      rate: 20 / 30,
      low: null,
      high: null,
      deff: null,
    },
  },
  {
    format_id: "Pauper",
    archetype_slug: "blue-terror-9eb65470",
    opponent_slug: "unknown-endstep",
    window: "30d",
    population: "rated",
    share_rate_at_sync: null,
    fetched_at: "2026-01-01T00:00:00.000Z",
    match: {
      opponent_id: "unknown-endstep",
      opponent_slug: "unknown-endstep",
      opponent_name: "Unknown Endstep",
      wins: 2,
      losses: 1,
      matches: 3,
      rate: 2 / 3,
      low: null,
      high: null,
      deff: null,
    },
  },
  {
    format_id: "Pauper",
    archetype_slug: "blue-terror-9eb65470",
    opponent_slug: "old-opponent",
    window: "7d",
    population: "rated",
    share_rate_at_sync: null,
    fetched_at: "2026-01-01T00:00:00.000Z",
    match: {
      opponent_id: "old-opponent",
      opponent_slug: "old-opponent",
      opponent_name: "Old Opponent",
      wins: 100,
      losses: 0,
      matches: 100,
      rate: 1,
      low: null,
      high: null,
      deff: null,
    },
  },
];

describe("combined Melee + Cardsrealm + endstep records", { skip }, () => {
  let queries: typeof import("./queries");
  let mongo: typeof import("@/lib/mongo/client");
  const previousEndstep = process.env.METAGAME_ENDSTEP_ENABLED;

  before(async () => {
    process.env.METAGAME_ENDSTEP_ENABLED = "true";
    const db = await connectTestDb("combined");
    await db.collection("metagame_decks").insertMany(decks);
    await db.collection("melee_matches").insertMany(matches);
    await db.collection("cardsrealm_matches").insertMany(cardsrealmMatches);
    await db.collection("endstep_matchups").insertMany(endstepMatchups);
    queries = await import("./queries");
    mongo = await import("@/lib/mongo/client");
  });

  after(async () => {
    await mongo.closeDb();
    await closeTestDb();
    if (previousEndstep == null) delete process.env.METAGAME_ENDSTEP_ENABLED;
    else process.env.METAGAME_ENDSTEP_ENABLED = previousEndstep;
  });

  test("getMeleeArchetypeRecord uses exact Melee pairings and excludes byes", async () => {
    const record = await queries.getMeleeArchetypeRecord("mono-blue-terror", 30);
    assert.ok(record);
    assert.equal(record.wins, 3);
    assert.equal(record.losses, 1);
    assert.equal(record.draws, 1);
    assert.equal(record.byes, 1);
    assert.equal(record.matches, 5);
    assert.equal(record.win_rate, 3 / 4);
    assert.equal(record.source, "melee");
  });

  test("getCardsrealmArchetypeRecord uses exact Cardsrealm pairings", async () => {
    const record = await queries.getCardsrealmArchetypeRecord(
      "mono-white-heroic",
      30,
    );
    assert.ok(record);
    assert.equal(record.wins, 1);
    assert.equal(record.losses, 1);
    assert.equal(record.draws, 0);
    assert.equal(record.matches, 2);
    assert.equal(record.win_rate, 1 / 2);
    assert.equal(record.source, "cardsrealm");
    assert.deepEqual(record.cardsrealm, {
      wins: 1,
      losses: 1,
      draws: 0,
      matches: 2,
    });
  });

  test("getCombinedArchetypeMatchups includes Cardsrealm rows", async () => {
    const matchups = await queries.getCombinedArchetypeMatchups(
      "mono-white-heroic",
      30,
    );

    const dimir = matchups.find((row) => row.opponent_slug === "dimir-faeries");
    assert.ok(dimir);
    assert.equal(dimir.scope, "exact");
    assert.equal(dimir.cardsrealm.matches, 1);
    assert.equal(dimir.cardsrealm.wins, 1);
    assert.equal(dimir.endstep.matches, 0);

    const affinity = matchups.find((row) => row.opponent_slug === "affinity");
    assert.ok(affinity);
    assert.equal(affinity.cardsrealm.losses, 1);
  });

  test("getCombinedArchetypeRecord sums exact Melee and endstep records", async () => {
    const record = await queries.getCombinedArchetypeRecord(
      "mono-blue-terror",
      30,
    );
    assert.ok(record);
    assert.equal(record.wins, 35);
    assert.equal(record.losses, 17);
    assert.equal(record.win_rate, 35 / 52);
    assert.equal(record.source, "combined");
    assert.deepEqual(record.melee, {
      wins: 3,
      losses: 1,
      draws: 1,
      matches: 5,
    });
    assert.deepEqual(record.endstep, {
      wins: 32,
      losses: 16,
      draws: 0,
      matches: 48,
    });
    assert.equal(record.endstep_group_slug, "blue-terror-9eb65470");
    assert.equal(record.endstep_group_variants, 2);
  });

  test("getCombinedArchetypeMatchups merges 1:1 endstep rows and keeps grouped rows separate", async () => {
    const matchups = await queries.getCombinedArchetypeMatchups(
      "mono-blue-terror",
      30,
    );

    const dimir = matchups.find(
      (row) => row.opponent_slug === "dimir-faeries" && row.scope === "exact",
    );
    assert.ok(dimir);
    assert.equal(dimir.wins, 11);
    assert.equal(dimir.losses, 5);
    assert.equal(dimir.draws, 1);
    assert.equal(dimir.matches, 17);
    assert.equal(dimir.win_rate, 11 / 16);
    assert.deepEqual(dimir.melee, {
      wins: 1,
      losses: 0,
      draws: 1,
      matches: 2,
    });
    assert.deepEqual(dimir.endstep, {
      wins: 10,
      losses: 5,
      draws: 0,
      matches: 15,
    });
    assert.equal(dimir.endstep_opponent_slug, "dimir-faeries-92f62264");

    const affinityGroup = matchups.find(
      (row) =>
        row.opponent_slug === "affinity-e93f5f74" && row.scope === "group",
    );
    assert.ok(affinityGroup);
    assert.equal(affinityGroup.wins, 20);
    assert.equal(affinityGroup.losses, 10);
    assert.equal(affinityGroup.melee.matches, 0);
    assert.equal(affinityGroup.endstep.matches, 30);

    const affinityExact = matchups.find(
      (row) => row.opponent_slug === "affinity" && row.scope === "exact",
    );
    assert.ok(affinityExact);
    assert.equal(affinityExact.wins, 0);
    assert.equal(affinityExact.losses, 1);
    assert.equal(affinityExact.endstep.matches, 0);

    const unknown = matchups.find(
      (row) => row.opponent_slug === "unknown-endstep",
    );
    assert.ok(unknown);
    assert.equal(unknown.scope, "group");
    assert.equal(unknown.endstep.matches, 3);
    assert.equal(
      matchups.some((row) => row.opponent_slug === "old-opponent"),
      false,
    );
  });
});
