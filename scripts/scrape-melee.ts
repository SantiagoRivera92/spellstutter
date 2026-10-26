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
  MeleeMatchRecord,
  MetagameCardEntry,
  MetagameDeck,
  MetagameEvent,
  MetagameEventType,
} from "../src/lib/metagame/types";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const BASE = "https://melee.gg";
const PAGE_SIZE = 500;
const DEFAULT_DELAY_MS = 5000;
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
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
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

interface TournamentSearchRow {
  id: number;
  name: string;
  startDate: string;
  enrolledPlayerCount: number;
  organizationName: string;
}

interface TournamentSearchResponse {
  recordsTotal: number;
  data: TournamentSearchRow[];
}

interface MeleeCardRecord {
  n: string;
  q: number;
  t: string;
}

interface MeleeComponent {
  ComponentDescription: string;
  CardQuantity: number;
  CardRecords: MeleeCardRecord[];
}

interface MeleeDeckDetails {
  Guid: string;
  DecklistName: string;
  FormatName: string;
  Components: MeleeComponent[];
}

interface MeleeStanding {
  Rank: number;
  Team: {
    ID: number;
    Players: { ID?: number; DisplayName: string; Username: string }[];
  };
  MatchWins: number;
  MatchLosses: number;
  MatchDraws: number;
  MatchRecord: string;
  GameRecord: string;
  Points: number;
  Decklists: {
    DecklistId: string;
    DecklistName: string;
  }[];
}

interface StandingsResponse {
  recordsTotal: number;
  data: MeleeStanding[];
}

interface MeleeMatchCompetitor {
  Team: {
    ID?: number | null;
    Players: { ID?: number; DisplayName: string; Username: string }[];
  };
  TeamId?: number | null;
  GameWins: number | null;
  GameByes: number | null;
  GameWinsAndGameByes: number | null;
  Decklists?: {
    DecklistId: string;
    DecklistName: string;
  }[];
}

interface MeleeMatch {
  Guid: string;
  RoundId: number;
  RoundNumber: number;
  RoundName: string | null;
  TableNumber: number | null;
  Competitors: MeleeMatchCompetitor[];
  ByeReason: string | null;
  HasResult: boolean;
  GameDraws: number;
  ResultString: string;
}

interface MatchesResponse {
  recordsTotal: number;
  data: MeleeMatch[];
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

interface ArchetypeTotal {
  slug: string;
  name: string;
  decks: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  win_rate: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function matchOne(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1].trim()) : null;
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
  let month = Number.parseInt(get("month") ?? String(now.getUTCMonth() + 1), 10);
  if (monthArg?.includes("-")) {
    const [parsedYear, parsedMonth] = monthArg.split("-").map((value) => Number.parseInt(value, 10));
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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...HEADERS,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE}/Tournament/Index`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return (await response.json()) as T;
}

function buildSearchBody(start: number): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", "Table");
  body.set("ordering", "");
  body.append("filters[]", "Pauper");
  body.append("filters[]", "Paper");
  body.append("filters[]", "Ended");
  body.set("variables[draw]", "1");
  body.set("variables[start]", String(start));
  body.set("variables[length]", String(PAGE_SIZE));
  body.set("variables[search][value]", "");
  body.set("variables[search][regex]", "false");
  body.set("variables[order][0][column]", "0");
  body.set("variables[order][0][dir]", "desc");
  return body;
}

async function fetchMonthEvents(options: Options): Promise<TournamentSearchRow[]> {
  const { start, end, label } = monthBounds(options.year, options.month);
  const rows: TournamentSearchRow[] = [];
  let offset = 0;
  while (true) {
    const response = await fetchJson<TournamentSearchResponse>(
      `${BASE}/Tournament/TournamentSearch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: buildSearchBody(offset).toString(),
      },
    );
    rows.push(...response.data);
    offset += response.data.length;
    if (!response.data.length || offset >= response.recordsTotal) break;
    await sleep(options.delayMs);
  }

  const filtered = rows
    .filter((row) => row.startDate >= start && row.startDate < end)
    .filter((row) => row.enrolledPlayerCount >= options.minPlayers)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  console.log(
    `[melee] ${filtered.length} ended paper Pauper events in ${label} with ${options.minPlayers}+ players`,
  );
  return options.limitEvents ? filtered.slice(0, options.limitEvents) : filtered;
}

function parseRounds(html: string): { id: string; name: string }[] {
  const rounds: { id: string; name: string }[] = [];
  const pattern =
    /<button class="btn btn-gray round-selector"[^>]*data-id="(\d+)"[^>]*data-name="([^"]+)"[^>]*data-is-completed="True"/g;
  for (const match of html.matchAll(pattern)) {
    rounds.push({ id: match[1], name: decodeHtml(match[2]) });
  }
  return rounds;
}

function buildStandingsBody(roundId: string): URLSearchParams {
  const columns = ["Rank", "Player", "Decklist", "MatchRecord", "GameRecord", "Points"];
  const body = new URLSearchParams();
  body.set("draw", "1");
  body.set("start", "0");
  body.set("length", "500");
  columns.forEach((name, index) => {
    body.set(`columns[${index}][data]`, name);
    body.set(`columns[${index}][name]`, name);
    body.set(`columns[${index}][searchable]`, "true");
    body.set(`columns[${index}][orderable]`, "true");
    body.set(`columns[${index}][search][value]`, "");
    body.set(`columns[${index}][search][regex]`, "false");
  });
  body.set("order[0][column]", "0");
  body.set("order[0][dir]", "asc");
  body.set("search[value]", "");
  body.set("search[regex]", "false");
  body.set("roundId", roundId);
  return body;
}

function buildMatchesBody(): URLSearchParams {
  const columns = ["TableNumber", "PodNumber", "Teams", "Decklists", "ResultString"];
  const body = new URLSearchParams();
  body.set("draw", "1");
  body.set("start", "0");
  body.set("length", "500");
  columns.forEach((name, index) => {
    body.set(`columns[${index}][data]`, name);
    body.set(`columns[${index}][name]`, name);
    body.set(`columns[${index}][searchable]`, "true");
    body.set(`columns[${index}][orderable]`, "true");
    body.set(`columns[${index}][search][value]`, "");
    body.set(`columns[${index}][search][regex]`, "false");
  });
  body.set("order[0][column]", "0");
  body.set("order[0][dir]", "asc");
  body.set("search[value]", "");
  body.set("search[regex]", "false");
  return body;
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
        (doc.metagame_printing_id ? printingImages.get(doc.metagame_printing_id) : undefined) ??
        cardImage(doc),
      colors: identityColors(doc.mana_cost ?? null, (doc.colors ?? []) as CardColor[]),
    };
    for (const alias of nameAliases(doc.name)) {
      if (!resolver.has(alias)) resolver.set(alias, info);
    }
  }

  console.log(`[melee] card index: ${resolver.size.toLocaleString()} names`);
  return resolver;
}

function toEntries(records: MeleeCardRecord[], resolver: CardResolver): MetagameCardEntry[] {
  return records.map((record) => {
    const name = decodeHtml(record.n);
    const resolved = resolver.get(normalizeName(name));
    const exempt = IDENTITY_EXEMPT_CARDS.has(
      resolved?.name_normalized ?? normalizeName(name),
    );
    return {
      name,
      quantity: record.q,
      oracle_id: resolved?.oracle_id ?? null,
      printing_id: resolved?.printing_id ?? null,
      type_line: resolved?.type_line ?? record.t ?? null,
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

function eventTypeFromName(name: string): MetagameEventType {
  if (/challenge/i.test(name)) return "challenge";
  if (/qualifier|nationals|invitational|rcq/i.test(name)) return "qualifier";
  if (/league|lega|liga/i.test(name)) return "league";
  if (/showcase|main event|open/i.test(name)) return "showcase";
  return "other";
}

function normalizeDeck(
  standing: MeleeStanding,
  details: MeleeDeckDetails,
  decklistId: string,
  event: MetagameEvent,
  resolver: CardResolver,
  now: string,
): MetagameDeck {
  const mainboard: MetagameCardEntry[] = [];
  let sideboard: MetagameCardEntry[] = [];
  for (const component of details.Components) {
    const entries = toEntries(component.CardRecords, resolver);
    if (component.ComponentDescription === "Sideboard") sideboard = entries;
    else mainboard.push(...entries);
  }
  const colorIdentity = identityOf(mainboard);
  const classification = classifyDeck(
    mainboard.map((entry) => entry.name),
    colorIdentity,
  );
  const player =
    standing.Team.Players[0]?.DisplayName ??
    standing.Team.Players[0]?.Username ??
    "Unknown";
  return {
    event_slug: event.slug,
    event_name: event.name,
    event_type: event.event_type,
    event_date: event.date,
    player,
    rank: standing.Rank,
    wins: standing.MatchWins,
    losses: standing.MatchLosses,
    decklist_id: decklistId,
    melee_team_id: standing.Team.ID ?? null,
    draws: standing.MatchDraws,
    record_source: "standings",
    standings_wins: standing.MatchWins,
    standings_losses: standing.MatchLosses,
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
      byes: 0,
      win_rate: null,
    };
    current.decks += 1;
    current.wins += deck.wins ?? 0;
    current.losses += deck.losses ?? 0;
    current.draws += deck.draws ?? 0;
    current.byes += deck.byes ?? 0;
    current.win_rate =
      current.wins + current.losses > 0
        ? current.wins / (current.wins + current.losses)
        : null;
    map.set(deck.archetype.slug, current);
  }
  return [...map.values()].sort((a, b) => b.decks - a.decks);
}

function printSummary(label: string, rows: ArchetypeTotal[]) {
  console.log(`[melee] ${label}`);
  for (const row of rows) {
    const rate = row.win_rate == null ? "—" : `${(row.win_rate * 100).toFixed(1)}%`;
    const byes = row.byes > 0 ? `, ${row.byes} byes` : "";
    console.log(
      `  ${row.name}: ${row.decks} decks, ${row.wins}-${row.losses}-${row.draws}${byes}, ${rate}`,
    );
  }
}

function playerName(competitor: MeleeMatchCompetitor): string {
  return (
    competitor.Team.Players[0]?.DisplayName ??
    competitor.Team.Players[0]?.Username ??
    "Unknown"
  );
}

function decklistIdOf(competitor: MeleeMatchCompetitor): string | null {
  return competitor.Decklists?.[0]?.DecklistId ?? null;
}

function teamIdOf(competitor: MeleeMatchCompetitor): number | null {
  return competitor.Team.ID ?? competitor.TeamId ?? null;
}

function archetypeOf(deck: MetagameDeck | undefined): { slug: string; name: string } | null {
  return deck ? { slug: deck.archetype.slug, name: deck.archetype.name } : null;
}

function matchResult(
  player: MeleeMatchCompetitor,
  opponent: MeleeMatchCompetitor,
  match: MeleeMatch,
): MeleeMatchRecord["result"] {
  if (!match.HasResult) return "unknown";
  const resultString = match.ResultString ?? "";
  if (/draw/i.test(resultString)) return "draw";

  const playerLabel = playerName(player);
  const opponentLabel = playerName(opponent);
  if (resultString.includes(`${playerLabel} won`)) return "win";
  if (resultString.includes(`${opponentLabel} won`)) return "loss";

  const games = player.GameWins ?? 0;
  const opponentGames = opponent.GameWins ?? 0;
  if (games > opponentGames) return "win";
  if (games < opponentGames) return "loss";
  return "draw";
}

function oppositeResult(result: MeleeMatchRecord["result"]): MeleeMatchRecord["result"] {
  if (result === "win") return "loss";
  if (result === "loss") return "win";
  return result;
}

function buildMatchRow(
  match: MeleeMatch,
  event: MetagameEvent,
  roundName: string,
  now: string,
  player: MeleeMatchCompetitor,
  playerDeck: MetagameDeck | undefined,
  opponent: MeleeMatchCompetitor | null,
  opponentDeck: MetagameDeck | undefined,
  result: MeleeMatchRecord["result"],
): MeleeMatchRecord {
  return {
    event_slug: event.slug,
    event_name: event.name,
    event_date: event.date,
    round_id: String(match.RoundId),
    round_number: match.RoundNumber,
    round_name: match.RoundName ?? roundName,
    match_id: match.Guid,
    table_number: match.TableNumber,
    player: playerName(player),
    player_team_id: teamIdOf(player),
    player_decklist_id: decklistIdOf(player),
    player_archetype: archetypeOf(playerDeck),
    opponent: opponent ? playerName(opponent) : null,
    opponent_team_id: opponent ? teamIdOf(opponent) : null,
    opponent_decklist_id: opponent ? decklistIdOf(opponent) : null,
    opponent_archetype: opponent ? archetypeOf(opponentDeck) : null,
    result,
    game_wins: player.GameWins ?? 0,
    game_losses: opponent?.GameWins ?? 0,
    game_draws: match.GameDraws ?? 0,
    source: "melee",
    scraped_at: now,
  };
}

function deckFor(
  competitor: MeleeMatchCompetitor,
  decksByDecklistId: Map<string, MetagameDeck>,
  decksByTeamId: Map<number, MetagameDeck>,
): MetagameDeck | undefined {
  const teamId = teamIdOf(competitor);
  if (teamId != null) {
    const byTeam = decksByTeamId.get(teamId);
    if (byTeam) return byTeam;
  }
  const decklistId = decklistIdOf(competitor);
  return decklistId ? decksByDecklistId.get(decklistId) : undefined;
}

function buildMatchRows(
  match: MeleeMatch,
  event: MetagameEvent,
  decksByDecklistId: Map<string, MetagameDeck>,
  decksByTeamId: Map<number, MetagameDeck>,
  roundName: string,
  now: string,
): MeleeMatchRecord[] {
  const competitors = match.Competitors ?? [];
  if (match.ByeReason || competitors.length === 1) {
    const player = competitors[0];
    if (!player) return [];
    const playerDeck = deckFor(player, decksByDecklistId, decksByTeamId);
    return [
      buildMatchRow(match, event, roundName, now, player, playerDeck, null, undefined, "bye"),
    ];
  }
  if (competitors.length !== 2) return [];

  const [first, second] = competitors;
  const firstDeck = deckFor(first, decksByDecklistId, decksByTeamId);
  const secondDeck = deckFor(second, decksByDecklistId, decksByTeamId);
  const firstResult = matchResult(first, second, match);

  return [
    buildMatchRow(
      match,
      event,
      roundName,
      now,
      first,
      firstDeck,
      second,
      secondDeck,
      firstResult,
    ),
    buildMatchRow(
      match,
      event,
      roundName,
      now,
      second,
      secondDeck,
      first,
      firstDeck,
      oppositeResult(firstResult),
    ),
  ];
}

function applyPairings(decks: MetagameDeck[], matches: MeleeMatchRecord[]) {
  const decksByDecklistId = new Map<string, MetagameDeck>();
  const decksByTeamId = new Map<number, MetagameDeck>();
  for (const deck of decks) {
    if (deck.decklist_id) decksByDecklistId.set(deck.decklist_id, deck);
    if (deck.melee_team_id != null) decksByTeamId.set(deck.melee_team_id, deck);
  }

  const totals = new Map<
    MetagameDeck,
    { wins: number; losses: number; draws: number; byes: number }
  >();
  for (const match of matches) {
    let deck: MetagameDeck | undefined;
    if (match.player_team_id != null) {
      deck = decksByTeamId.get(match.player_team_id);
    }
    if (!deck && match.player_decklist_id) {
      deck = decksByDecklistId.get(match.player_decklist_id);
    }
    if (!deck) continue;

    const total = totals.get(deck) ?? { wins: 0, losses: 0, draws: 0, byes: 0 };
    if (match.result === "win") total.wins += 1;
    else if (match.result === "loss") total.losses += 1;
    else if (match.result === "draw") total.draws += 1;
    else if (match.result === "bye") total.byes += 1;
    totals.set(deck, total);
  }

  for (const [deck, total] of totals) {
    deck.wins = total.wins;
    deck.losses = total.losses;
    deck.draws = total.draws;
    deck.byes = total.byes;
    deck.record_source = "pairings";
  }
}

async function fetchEventMatches(
  url: string,
  rounds: { id: string; name: string }[],
  event: MetagameEvent,
  decks: MetagameDeck[],
  options: Options,
  now: string,
): Promise<MeleeMatchRecord[]> {
  const decksByDecklistId = new Map<string, MetagameDeck>();
  const decksByTeamId = new Map<number, MetagameDeck>();
  for (const deck of decks) {
    if (deck.decklist_id) decksByDecklistId.set(deck.decklist_id, deck);
    if (deck.melee_team_id != null) decksByTeamId.set(deck.melee_team_id, deck);
  }

  const matches: MeleeMatchRecord[] = [];
  for (const round of rounds) {
    await sleep(options.delayMs);
    const response = await fetchJson<MatchesResponse>(
      `${BASE}/Match/GetRoundMatches/${round.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: url,
        },
        body: buildMatchesBody().toString(),
      },
    );
    for (const match of response.data) {
      matches.push(
        ...buildMatchRows(
          match,
          event,
          decksByDecklistId,
          decksByTeamId,
          round.name,
          now,
        ),
      );
    }
  }
  return matches;
}

async function processEvent(
  db: Db,
  resolver: CardResolver,
  row: TournamentSearchRow,
  options: Options,
  now: string,
): Promise<MetagameDeck[]> {
  const slug = `melee-${row.id}`;
  const url = `${BASE}/Tournament/View/${row.id}`;
  if (!options.force) {
    const existing = await db
      .collection<MetagameEvent>("metagame_events")
      .findOne({ $or: [{ slug }, { url }] }, { projection: { slug: 1 } });
    if (existing) {
      console.log(`[melee] ${slug} already stored — skipping`);
      return [];
    }
  }

  await sleep(options.delayMs);
  const html = await fetchText(url);
  const decklistEnabled =
    matchOne(html, /id="DecklistEnabled"[^>]*value="([^"]+)"/) === "true";
  if (!decklistEnabled) {
    console.log(`[melee] ${slug} has no public decklists — skipping`);
    return [];
  }
  const rounds = parseRounds(html);
  if (rounds.length === 0) {
    console.log(`[melee] ${slug} has no completed rounds — skipping`);
    return [];
  }

  await sleep(options.delayMs);
  const standings = await fetchJson<StandingsResponse>(
    `${BASE}/Standing/GetRoundStandings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: url,
      },
      body: buildStandingsBody(rounds[rounds.length - 1].id).toString(),
    },
  );

  const event: MetagameEvent = {
    slug,
    name: matchOne(html, /<title>([^<]+) \| Melee<\/title>/) ?? row.name,
    event_type: eventTypeFromName(row.name),
    date:
      matchOne(html, /data-toggle="datetime" data-value="([^"]+Z)"/) ??
      row.startDate,
    url,
    player_count: standings.recordsTotal,
    deck_count: 0,
    scraped_at: now,
  };

  const decks: MetagameDeck[] = [];
  const seenPlayers = new Map<string, number>();
  for (const [index, standing] of standings.data.entries()) {
    const decklist = standing.Decklists?.[0];
    if (!decklist) continue;
    if (index > 0) await sleep(options.delayMs);
    const details = await fetchJson<MeleeDeckDetails>(
      `${BASE}/Decklist/GetDecklistDetails?id=${encodeURIComponent(decklist.DecklistId)}`,
      { headers: { Referer: url } },
    );
    const deck = normalizeDeck(
      standing,
      details,
      decklist.DecklistId,
      event,
      resolver,
      now,
    );
    const basePlayer = deck.player;
    const seen = seenPlayers.get(basePlayer) ?? 0;
    if (seen > 0) deck.player = `${basePlayer} (${deck.rank})`;
    seenPlayers.set(basePlayer, seen + 1);
    decks.push(deck);
  }

  if (decks.length === 0) {
    console.log(`[melee] ${slug} has no public decklists — skipping`);
    return [];
  }

  const matches = await fetchEventMatches(url, rounds, event, decks, options, now);
  applyPairings(decks, matches);

  event.deck_count = decks.length;
  if (options.dryRun) {
    console.log(
      `[melee] ${slug}: ${decks.length} decks, ${matches.length} pairing rows (dry run)`,
    );
    printSummary("added archetypes", summarize(decks));
    return decks;
  }

  if (options.force) {
    await db.collection<MetagameEvent>("metagame_events").deleteOne({ slug });
    await db.collection<MetagameDeck>("metagame_decks").deleteMany({ event_slug: slug });
    await db.collection<MeleeMatchRecord>("melee_matches").deleteMany({ event_slug: slug });
  }

  const operations: AnyBulkWriteOperation<MetagameDeck>[] = decks.map((deck) => ({
    updateOne: {
      filter: { event_slug: deck.event_slug, player: deck.player },
      update: { $set: deck },
      upsert: true,
    },
  }));
  if (operations.length) {
    await db
      .collection<MetagameDeck>("metagame_decks")
      .bulkWrite(operations, { ordered: false });
  }

  const matchOperations: AnyBulkWriteOperation<MeleeMatchRecord>[] = matches.map(
    (match) => ({
      updateOne: {
        filter: { match_id: match.match_id, player: match.player },
        update: { $set: match },
        upsert: true,
      },
    }),
  );
  if (matchOperations.length) {
    await db
      .collection<MeleeMatchRecord>("melee_matches")
      .bulkWrite(matchOperations, { ordered: false });
  }

  await db
    .collection<MetagameEvent>("metagame_events")
    .updateOne({ slug }, { $set: event }, { upsert: true });

  console.log(
    `[melee] ${slug}: stored ${decks.length} decks and ${matches.length} pairing rows`,
  );
  return decks;
}

async function monthTotals(db: Db, options: Options): Promise<ArchetypeTotal[]> {
  const { start, end } = monthBounds(options.year, options.month);
  const rows = await db
    .collection<MetagameDeck>("metagame_decks")
    .aggregate<ArchetypeTotal>([
      {
        $match: {
          event_slug: /^melee-/,
          event_date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$archetype.slug",
          name: { $first: "$archetype.name" },
          decks: { $sum: 1 },
          wins: { $sum: { $ifNull: ["$wins", 0] } },
          losses: { $sum: { $ifNull: ["$losses", 0] } },
          draws: { $sum: { $ifNull: ["$draws", 0] } },
          byes: { $sum: { $ifNull: ["$byes", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          slug: "$_id",
          name: 1,
          decks: 1,
          wins: 1,
          losses: 1,
          draws: 1,
          byes: 1,
          win_rate: {
            $cond: [
              { $gt: [{ $add: ["$wins", "$losses"] }, 0] },
              { $divide: ["$wins", { $add: ["$wins", "$losses"] }] },
              null,
            ],
          },
        },
      },
      { $sort: { decks: -1 } },
    ])
    .toArray();
  return rows;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("metagame_events").createIndex({ url: 1 }),
    db.collection("metagame_decks").createIndex({ event_slug: 1, player: 1 }, { unique: true }),
    db.collection("melee_matches").createIndex(
      { match_id: 1, player: 1 },
      { unique: true },
    ),
    db.collection("melee_matches").createIndex({
      "player_archetype.slug": 1,
      "opponent_archetype.slug": 1,
      event_date: 1,
    }),
    db.collection("melee_matches").createIndex({
      player_decklist_id: 1,
      event_date: 1,
    }),
  ]);
}

async function run(db: Db, options: Options) {
  const now = new Date().toISOString();
  if (!options.dryRun) await ensureIndexes(db);
  const resolver = await buildCardIndex(db);
  const events = await fetchMonthEvents(options);
  const added: MetagameDeck[] = [];
  for (const row of events) {
    added.push(...(await processEvent(db, resolver, row, options, now)));
  }
  if (added.length) printSummary("new decks by archetype", summarize(added));
  if (!options.dryRun) {
    printSummary("month totals by archetype", await monthTotals(db, options));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) console.log("[melee] dry run — nothing will be written");
  await withDb((db) => run(db, options));
  console.log("[melee] done");
}

void main().catch((error) => {
  console.error("[melee] failed:", error);
  process.exitCode = 1;
});
