import { config } from "dotenv";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import { identityColors } from "../src/lib/cards/mana";
import type { Card, CardColor, Printing } from "../src/lib/cards/types";
import { nameAliases, normalizeName } from "../src/lib/cards/normalize-name";
import {
  CLASSIFICATION_VERSION,
  IDENTITY_EXEMPT_CARDS,
  classifyDeck,
} from "../src/lib/metagame/archetypes";
import type {
  CardsrealmMatchRecord,
  MetagameCardEntry,
  MetagameDeck,
  MetagameEvent,
  MetagameEventType,
} from "../src/lib/metagame/types";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const BASE = "https://cardsrealm.com";
const API = `${BASE}/en-us/api`;
const WEB_BASE = "https://mtg.cardsrealm.com/en-us";
const PAGE_SIZE = 20;
const DEFAULT_DELAY_MS = 500;
const DEFAULT_MIN_PLAYERS = 16;
const COLORS: CardColor[] = ["W", "U", "B", "R", "G"];
const NON_DECK_LAYOUTS = [
  "token",
  "double_faced_token",
  "emblem",
  "art_series",
  "vanguard",
  "scheme",
  "planar",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

interface Options {
  year: number;
  month: number;
  minPlayers: number;
  limitEvents: number | null;
  force: boolean;
  dryRun: boolean;
  delayMs: number;
}

interface TournamentListRow {
  tournament_id: number;
  tournament_name: string;
  tournament_path: string;
  format_name: string;
  game_name: string;
  datetime_utc: string;
}

interface Standing {
  deck_id_1: string;
  deck_name: string;
  player_name: string;
  player_nickname: string;
  player_mtgo: string | null;
  player_cockatrice: string | null;
  player_arena: string | null;
  player_url: string | null;
  swiss_victories: number;
  swiss_losses: number;
  swiss_draws: number;
  points: number;
}

interface TournamentInfo {
  game_name: string;
  round_info: unknown[];
  standings: Standing[];
  tournament_current_round: number;
  tournament_date: string;
  tournament_id: number;
  tournament_max_number_of_rounds: number;
  tournament_name: string;
  tournament_platform: string;
  tournament_stage: string;
  tournament_twitch: string | null;
  tournament_url: string;
}

interface DeckCard {
  deck_quantity: number;
  deck_sideboard: number;
  name_ing: string;
}

interface DeckDetails {
  cards: DeckCard[];
  deck_datetime: string;
  deck_lastchange: string;
  deck_quantity_main: number;
  deck_quantity_side: number;
  deck_quantity_total: number;
  deck_title: string;
  deck_url: string;
  game_id: number;
  tour_type_name: string;
  user_name: string;
}

interface ResolvedCard {
  oracle_id: string;
  name: string;
  name_normalized: string;
  printing_id: string | null;
  type_line: string | null;
  image: string | null;
  colors: CardColor[];
}

type CardResolver = Map<string, ResolvedCard>;

interface Pairing {
  roundNumber: number;
  tableNumber: number;
  leftPlayer: string;
  rightPlayer: string;
  leftPlayerKey: string;
  rightPlayerKey: string;
  leftWins: number;
  rightWins: number;
  draws: number;
}

interface TournamentMatches {
  matches: CardsrealmMatchRecord[];
  roundsFetched: number;
  roundsExpected: number;
}

interface ArchetypeTotal {
  slug: string;
  name: string;
  decks: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): Options {
  const now = new Date();
  const get = (flag: string) => {
    const arg = argv.find((value) => value.startsWith(`--${flag}=`));
    return arg ? arg.split("=").slice(1).join("=") : undefined;
  };
  const monthArg = get("month");
  const yearArg = get("year");
  let year = Number.parseInt(yearArg ?? String(now.getUTCFullYear()), 10);
  let month = Number.parseInt(monthArg ?? String(now.getUTCMonth() + 1), 10);
  if (monthArg?.includes("-")) {
    const [parsedYear, parsedMonth] = monthArg
      .split("-")
      .map((value) => Number.parseInt(value, 10));
    year = parsedYear;
    month = parsedMonth;
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Use --month=YYYY-MM or --year=YYYY --month=1-12");
  }
  const minPlayers = Number.parseInt(
    get("min-players") ?? String(DEFAULT_MIN_PLAYERS),
    10,
  );
  const limit = get("limit");
  const delay = Number.parseInt(get("delay") ?? String(DEFAULT_DELAY_MS), 10);
  return {
    year,
    month,
    minPlayers: Number.isFinite(minPlayers) ? minPlayers : DEFAULT_MIN_PLAYERS,
    limitEvents: limit ? Number.parseInt(limit, 10) : null,
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
    delayMs: Number.isFinite(delay) ? Math.max(0, delay) : DEFAULT_DELAY_MS,
  };
}

function monthBounds(year: number, month: number): { start: string; end: string; label: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function parseTournamentDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchMonthTournaments(options: Options): Promise<TournamentListRow[]> {
  const { start, end, label } = monthBounds(options.year, options.month);
  const rows: TournamentListRow[] = [];
  for (let page = 1; ; page += 1) {
    const data = await fetchJson<TournamentListRow[]>(
      `${API}/getPastTournaments?format=Pauper&page=${page}`,
    );
    if (!data.length) break;

    let reachedOlderEvents = false;
    for (const row of data) {
      const date = parseTournamentDate(row.datetime_utc);
      if (date < start) {
        reachedOlderEvents = true;
        continue;
      }
      if (date < end) rows.push(row);
    }

    if (reachedOlderEvents || data.length < PAGE_SIZE) break;
    await sleep(options.delayMs);
  }

  const filtered = rows.sort((a, b) =>
    parseTournamentDate(b.datetime_utc).localeCompare(
      parseTournamentDate(a.datetime_utc),
    ),
  );
  console.log(
    `[cardsrealm] ${filtered.length} finished Pauper events in ${label}`,
  );
  return filtered;
}

function normalizePlayerName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function playerUrlKey(url: string | null | undefined): string {
  const match = url?.match(/\/player\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

function parsePairings(html: string, roundNumber: number): Pairing[] {
  const rows = html.matchAll(
    /<div class="tour_table_div_round[^"]*">\s*<p>(\d+)<\/p>\s*<div class="tour_tables">([\s\S]*?)<\/div><\/div>/g,
  );
  const pairings: Pairing[] = [];
  for (const row of rows) {
    const tableNumber = Number.parseInt(row[1], 10);
    const body = row[2];
    const anchors = [...body.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)];
    const names = anchors.map((match) => decodeHtml(match[2]).trim());
    const scores = [...body.matchAll(/<p class="tour_results_p">(\d+)<\/p>/g)].map(
      (match) => Number.parseInt(match[1], 10),
    );
    if (names.length < 2 || scores.length < 3) continue;
    pairings.push({
      roundNumber,
      tableNumber,
      leftPlayer: names[0],
      rightPlayer: names[1],
      leftPlayerKey: playerUrlKey(anchors[0][1]),
      rightPlayerKey: playerUrlKey(anchors[1][1]),
      leftWins: scores[0],
      rightWins: scores[2],
      draws: scores[1],
    });
  }
  return pairings;
}

async function fetchTournamentMatches(
  options: Options,
  tournamentId: number,
  maxRounds: number,
  event: MetagameEvent,
  decksByPlayer: Map<string, MetagameDeck>,
  now: string,
): Promise<TournamentMatches> {
  const expected = Number.isFinite(maxRounds) ? Math.max(0, maxRounds) : 0;
  if (!expected) return { matches: [], roundsFetched: 0, roundsExpected: 0 };

  const pairings: Pairing[] = [];
  let roundsFetched = 0;
  for (let round = 1; round <= expected; round += 1) {
    await sleep(options.delayMs);
    try {
      const html = await fetchJson<string>(
        `${WEB_BASE}/tournament/getround?tour_id=${tournamentId}&round_number=${round}`,
      );
      pairings.push(...parsePairings(html, round));
      roundsFetched += 1;
    } catch (error) {
      console.warn(
        `[cardsrealm] round ${round} for ${event.slug} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const matches: CardsrealmMatchRecord[] = [];
  for (const pairing of pairings) {
    const leftName = pairing.leftPlayer.trim();
    const rightName = pairing.rightPlayer.trim();
    if (
      leftName.toLowerCase() === "bye" ||
      rightName.toLowerCase() === "bye"
    ) {
      continue;
    }

    const leftDeck =
      decksByPlayer.get(pairing.leftPlayerKey) ??
      decksByPlayer.get(normalizePlayerName(leftName));
    const rightDeck =
      decksByPlayer.get(pairing.rightPlayerKey) ??
      decksByPlayer.get(normalizePlayerName(rightName));
    if (!leftDeck && !rightDeck) continue;

    const draw = pairing.leftWins === pairing.rightWins;
    const matchId = `${tournamentId}-r${pairing.roundNumber}-t${pairing.tableNumber}`;
    const record = (
      deck: MetagameDeck,
      opponentName: string,
      opponentDeck: MetagameDeck | undefined,
      result: "win" | "loss" | "draw",
      gameWins: number,
      gameLosses: number,
    ): CardsrealmMatchRecord => ({
      event_slug: event.slug,
      event_name: event.name,
      event_date: event.date,
      round_id: `${tournamentId}-r${pairing.roundNumber}`,
      round_number: pairing.roundNumber,
      round_name: `Round ${pairing.roundNumber}`,
      match_id: matchId,
      table_number: pairing.tableNumber,
      player: deck.player,
      player_team_id: null,
      player_decklist_id: deck.decklist_id ?? null,
      player_archetype: deck.archetype,
      opponent: opponentDeck?.player ?? opponentName,
      opponent_team_id: null,
      opponent_decklist_id: opponentDeck?.decklist_id ?? null,
      opponent_archetype: opponentDeck?.archetype ?? null,
      result,
      game_wins: gameWins,
      game_losses: gameLosses,
      game_draws: pairing.draws,
      source: "cardsrealm",
      scraped_at: now,
    });

    if (leftDeck) {
      matches.push(
        record(
          leftDeck,
          rightName,
          rightDeck,
          draw ? "draw" : pairing.leftWins > pairing.rightWins ? "win" : "loss",
          pairing.leftWins,
          pairing.rightWins,
        ),
      );
    }
    if (rightDeck) {
      matches.push(
        record(
          rightDeck,
          leftName,
          leftDeck,
          draw ? "draw" : pairing.rightWins > pairing.leftWins ? "win" : "loss",
          pairing.rightWins,
          pairing.leftWins,
        ),
      );
    }
  }

  if (roundsFetched < expected) {
    console.warn(
      `[cardsrealm] ${event.slug}: only ${roundsFetched}/${expected} rounds fetched — skipping match rows`,
    );
    return { matches: [], roundsFetched, roundsExpected: expected };
  }
  return { matches, roundsFetched, roundsExpected: expected };
}

function applyPairingRecords(
  decks: MetagameDeck[],
  matches: CardsrealmMatchRecord[],
  roundsFetched: number,
  roundsExpected: number,
) {
  if (!roundsExpected || roundsFetched < roundsExpected) return;
  const totals = new Map<string, { wins: number; losses: number; draws: number }>();
  for (const match of matches) {
    const row = totals.get(match.player) ?? { wins: 0, losses: 0, draws: 0 };
    if (match.result === "win") row.wins += 1;
    else if (match.result === "loss") row.losses += 1;
    else if (match.result === "draw") row.draws += 1;
    totals.set(match.player, row);
  }
  for (const deck of decks) {
    const row = totals.get(deck.player);
    if (!row) continue;
    deck.wins = row.wins;
    deck.losses = row.losses;
    deck.draws = row.draws;
    deck.record_source = "pairings";
  }
}

function normalizeEventName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dayBounds(iso: string): { start: string; end: string } {
  const start = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function findDuplicateEvent(
  db: Db,
  row: TournamentListRow,
): Promise<MetagameEvent | null> {
  const { start, end } = dayBounds(parseTournamentDate(row.datetime_utc));
  const events = await db
    .collection<MetagameEvent>("metagame_events")
    .find(
      { date: { $gte: start, $lt: end } },
      { projection: { _id: 0, slug: 1, name: 1, date: 1, url: 1 } },
    )
    .toArray();
  const name = normalizeEventName(row.tournament_name);
  return events.find((event) => normalizeEventName(event.name) === name) ?? null;
}

function eventTypeFromName(name: string): MetagameEventType {
  if (/challenge/i.test(name)) return "challenge";
  if (/qualifier|nationals|invitational|rcq/i.test(name)) return "qualifier";
  if (/league|lega|liga/i.test(name)) return "league";
  if (/showcase|main event|open/i.test(name)) return "showcase";
  return "other";
}

function cardImage(card: Card): string | null {
  return (
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris.normal ??
    card.card_faces?.[0]?.image_uris.small ??
    null
  );
}

function printingImage(printing: Printing): string | null {
  return (
    printing.image_uris?.normal ??
    printing.image_uris?.small ??
    printing.card_faces?.[0]?.image_uris.normal ??
    printing.card_faces?.[0]?.image_uris.small ??
    null
  );
}

async function loadPrintingImages(db: Db): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const cursor = db.collection<Printing>("printings").find(
    {},
    { projection: { scryfall_id: 1, image_uris: 1, card_faces: 1 } },
  );
  for await (const printing of cursor) {
    const image = printingImage(printing);
    if (image) map.set(printing.scryfall_id, image);
  }
  return map;
}

async function buildCardIndex(db: Db): Promise<CardResolver> {
  const resolver: CardResolver = new Map();
  const printingImages = await loadPrintingImages(db);
  const cursor = db.collection<Card>("cards").find(
    { layout: { $nin: NON_DECK_LAYOUTS } },
    {
      projection: {
        oracle_id: 1,
        name: 1,
        mana_cost: 1,
        type_line: 1,
        image_uris: 1,
        card_faces: 1,
        colors: 1,
        metagame_printing_id: 1,
        default_printing_id: 1,
      },
    },
  );

  for await (const doc of cursor) {
    const info: ResolvedCard = {
      oracle_id: doc.oracle_id,
      name: doc.name,
      name_normalized: normalizeName(doc.name),
      printing_id: doc.metagame_printing_id ?? doc.default_printing_id ?? null,
      type_line: doc.type_line ?? null,
      image:
        (doc.metagame_printing_id
          ? printingImages.get(doc.metagame_printing_id)
          : undefined) ?? cardImage(doc),
      colors: identityColors(doc.mana_cost ?? null, (doc.colors ?? []) as CardColor[]),
    };
    for (const alias of nameAliases(doc.name)) {
      if (!resolver.has(alias)) resolver.set(alias, info);
    }
  }

  console.log(`[cardsrealm] card index: ${resolver.size.toLocaleString()} names`);
  return resolver;
}

function toEntries(cards: DeckCard[], resolver: CardResolver): MetagameCardEntry[] {
  return cards
    .map((card) => ({ ...card, deck_quantity: Number(card.deck_quantity) || 0 }))
    .filter((card) => card.deck_quantity > 0)
    .map((card) => {
      const name = card.name_ing.trim();
      const resolved = resolver.get(normalizeName(name));
      const exempt = IDENTITY_EXEMPT_CARDS.has(
        resolved?.name_normalized ?? normalizeName(name),
      );
      return {
        name,
        quantity: card.deck_quantity,
        oracle_id: resolved?.oracle_id ?? null,
        printing_id: resolved?.printing_id ?? null,
        type_line: resolved?.type_line ?? null,
        image: resolved?.image ?? null,
        colors: exempt ? [] : (resolved?.colors ?? []),
      };
    });
}

function identityOf(entries: MetagameCardEntry[]): CardColor[] {
  const identity = new Set<CardColor>();
  for (const entry of entries) {
    for (const color of entry.colors ?? []) identity.add(color);
  }
  return COLORS.filter((color) => identity.has(color));
}

function normalizeDeck(
  standing: Standing,
  details: DeckDetails,
  event: MetagameEvent,
  resolver: CardResolver,
  rank: number,
  now: string,
): MetagameDeck | null {
  const isSideboard = (card: DeckCard) => Number(card.deck_sideboard) !== 0;
  const mainboard = toEntries(
    details.cards.filter((card) => !isSideboard(card)),
    resolver,
  );
  if (!mainboard.length) return null;
  const sideboard = toEntries(
    details.cards.filter(isSideboard),
    resolver,
  );
  const colorIdentity = identityOf(mainboard);
  const classification = classifyDeck(
    mainboard.map((entry) => entry.name),
    colorIdentity,
  );
  const player =
    (standing.player_name ?? "").trim() ||
    (standing.player_nickname ?? "").trim() ||
    "Unknown";
  const wins = Number(standing.swiss_victories) || 0;
  const losses = Number(standing.swiss_losses) || 0;
  return {
    event_slug: event.slug,
    event_name: event.name,
    event_type: event.event_type,
    event_date: event.date,
    player,
    rank,
    wins,
    losses,
    decklist_id: standing.deck_id_1,
    draws: Number(standing.swiss_draws) || 0,
    record_source: "standings",
    standings_wins: wins,
    standings_losses: losses,
    color_identity: colorIdentity,
    mainboard,
    sideboard,
    archetype: {
      slug: classification.slug,
      name: classification.name,
      confidence: classification.confidence,
    },
    classification_version: CLASSIFICATION_VERSION,
    scraped_at: now,
  };
}

function summarize(decks: MetagameDeck[]): ArchetypeTotal[] {
  const map = new Map<string, ArchetypeTotal>();
  for (const deck of decks) {
    const current = map.get(deck.archetype.slug) ?? {
      slug: deck.archetype.slug,
      name: deck.archetype.name,
      decks: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      win_rate: null,
    };
    current.decks += 1;
    current.wins += deck.wins ?? 0;
    current.losses += deck.losses ?? 0;
    current.draws += deck.draws ?? 0;
    current.win_rate =
      current.wins + current.losses > 0
        ? current.wins / (current.wins + current.losses)
        : null;
    map.set(deck.archetype.slug, current);
  }
  return [...map.values()].sort((a, b) => b.decks - a.decks);
}

function printSummary(label: string, rows: ArchetypeTotal[]) {
  console.log(`[cardsrealm] ${label}`);
  for (const row of rows) {
    const rate = row.win_rate == null ? "—" : `${(row.win_rate * 100).toFixed(1)}%`;
    console.log(
      `  ${row.name}: ${row.decks} decks, ${row.wins}-${row.losses}-${row.draws}, ${rate}`,
    );
  }
}

async function processTournament(
  db: Db,
  resolver: CardResolver,
  row: TournamentListRow,
  options: Options,
  now: string,
): Promise<MetagameDeck[]> {
  const slug = `cardsrealm-${row.tournament_id}`;
  const existing = await db
    .collection<MetagameEvent>("metagame_events")
    .findOne(
      { $or: [{ slug }, { url: row.tournament_path }] },
      { projection: { _id: 0, slug: 1 } },
    );
  if (existing && !options.force) {
    console.log(`[cardsrealm] ${slug} already stored — skipping`);
    return [];
  }
  if (!existing) {
    const duplicate = await findDuplicateEvent(db, row);
    if (duplicate) {
      console.log(
        `[cardsrealm] ${slug} duplicates ${duplicate.slug} — skipping`,
      );
      return [];
    }
  }

  await sleep(options.delayMs);
  const info = await fetchJson<TournamentInfo>(
    `${API}/getTournamentInfo?tournament_id=${row.tournament_id}`,
  );
  if (!info || !info.tournament_id) {
    console.log(`[cardsrealm] ${slug} has no tournament data — skipping`);
    return [];
  }
  if (
    info.tournament_stage &&
    info.tournament_stage.toUpperCase() !== "FINISHED"
  ) {
    console.log(`[cardsrealm] ${slug} is not finished — skipping`);
    return [];
  }

  const standings = info.standings ?? [];
  if (standings.length < options.minPlayers) {
    console.log(
      `[cardsrealm] ${slug} has ${standings.length} players — skipping`,
    );
    return [];
  }

  const event: MetagameEvent = {
    slug,
    name: info.tournament_name || row.tournament_name,
    event_type: eventTypeFromName(info.tournament_name || row.tournament_name),
    date: parseTournamentDate(info.tournament_date || row.datetime_utc),
    url: info.tournament_url || row.tournament_path,
    player_count: standings.length,
    deck_count: 0,
    scraped_at: now,
  };

  const decks: MetagameDeck[] = [];
  const decksByPlayer = new Map<string, MetagameDeck>();
  const seenPlayers = new Map<string, number>();
  for (const [index, standing] of standings.entries()) {
    const deckId = standing.deck_id_1;
    if (!deckId || deckId === "0") continue;
    if (decks.length > 0) await sleep(options.delayMs);
    const details = await fetchJson<DeckDetails>(
      `${API}/getDeckByID?deck_id=${encodeURIComponent(deckId)}`,
    );
    if (!details?.cards?.length) continue;

    const deck = normalizeDeck(
      standing,
      details,
      event,
      resolver,
      index + 1,
      now,
    );
    if (!deck) continue;

    const basePlayer = deck.player;
    const seen = seenPlayers.get(basePlayer) ?? 0;
    if (seen > 0) deck.player = `${basePlayer} (${deck.rank})`;
    seenPlayers.set(basePlayer, seen + 1);
    decks.push(deck);
    const playerKeys = [
      playerUrlKey(standing.player_url),
      normalizePlayerName(standing.player_name ?? ""),
      normalizePlayerName(standing.player_nickname ?? ""),
      normalizePlayerName(standing.player_mtgo ?? ""),
      normalizePlayerName(standing.player_cockatrice ?? ""),
      normalizePlayerName(standing.player_arena ?? ""),
      normalizePlayerName(deck.player),
    ];
    for (const key of playerKeys) {
      if (key && !decksByPlayer.has(key)) decksByPlayer.set(key, deck);
    }
  }

  if (!decks.length) {
    console.log(`[cardsrealm] ${slug} has no decklists — skipping`);
    return [];
  }

  const tournamentMatches = await fetchTournamentMatches(
    options,
    row.tournament_id,
    info.tournament_max_number_of_rounds,
    event,
    decksByPlayer,
    now,
  );
  applyPairingRecords(
    decks,
    tournamentMatches.matches,
    tournamentMatches.roundsFetched,
    tournamentMatches.roundsExpected,
  );

  event.deck_count = decks.length;
  if (options.dryRun) {
    console.log(
      `[cardsrealm] ${slug}: ${decks.length} decks, ${tournamentMatches.matches.length} match rows (dry run)`,
    );
    printSummary("added archetypes", summarize(decks));
    return decks;
  }

  if (options.force) {
    const slugs = [slug, existing?.slug].filter(
      (value): value is string => Boolean(value),
    );
    await db
      .collection<MetagameEvent>("metagame_events")
      .deleteMany({ slug: { $in: slugs } });
    await db
      .collection<MetagameDeck>("metagame_decks")
      .deleteMany({ event_slug: { $in: slugs } });
    await db
      .collection<CardsrealmMatchRecord>("cardsrealm_matches")
      .deleteMany({ event_slug: { $in: slugs } });
  }

  const operations: AnyBulkWriteOperation<MetagameDeck>[] = decks.map((deck) => ({
    updateOne: {
      filter: { event_slug: deck.event_slug, player: deck.player },
      update: { $set: deck },
      upsert: true,
    },
  }));
  await db
    .collection<MetagameDeck>("metagame_decks")
    .bulkWrite(operations, { ordered: false });

  if (tournamentMatches.matches.length) {
    const matchOperations: AnyBulkWriteOperation<CardsrealmMatchRecord>[] =
      tournamentMatches.matches.map((match) => ({
        updateOne: {
          filter: {
            event_slug: match.event_slug,
            match_id: match.match_id,
            player: match.player,
          },
          update: { $set: match },
          upsert: true,
        },
      }));
    await db
      .collection<CardsrealmMatchRecord>("cardsrealm_matches")
      .bulkWrite(matchOperations, { ordered: false });
  }

  await db
    .collection<MetagameEvent>("metagame_events")
    .updateOne({ slug }, { $set: event }, { upsert: true });

  console.log(
    `[cardsrealm] ${slug}: stored ${decks.length} decks, ${tournamentMatches.matches.length} match rows`,
  );
  return decks;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("metagame_events").createIndex({ url: 1 }),
    db.collection("metagame_decks").createIndex(
      { event_slug: 1, player: 1 },
      { unique: true },
    ),
    db.collection("cardsrealm_matches").createIndex(
      { event_slug: 1, match_id: 1, player: 1 },
      { unique: true },
    ),
    db.collection("cardsrealm_matches").createIndex({
      "player_archetype.slug": 1,
      event_date: -1,
    }),
  ]);
}

async function run(db: Db, options: Options) {
  const now = new Date().toISOString();
  if (!options.dryRun) await ensureIndexes(db);
  const resolver = await buildCardIndex(db);
  const events = await fetchMonthTournaments(options);
  const added: MetagameDeck[] = [];
  let stored = 0;
  for (const row of events) {
    if (options.limitEvents != null && stored >= options.limitEvents) break;
    const decks = await processTournament(db, resolver, row, options, now);
    if (decks.length) {
      added.push(...decks);
      stored += 1;
    }
  }
  if (added.length) printSummary("new decks by archetype", summarize(added));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) console.log("[cardsrealm] dry run — nothing will be written");
  await withDb((db) => run(db, options));
  console.log("[cardsrealm] done");
}

void main().catch((error) => {
  console.error("[cardsrealm] failed:", error);
  process.exitCode = 1;
});
