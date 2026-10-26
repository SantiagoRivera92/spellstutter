/**
 * Ingest endstep.cc metagame archetypes into MongoDB.
 *
 * endstep.cc exposes its metagame tab as a public JSON API (no auth):
 *   GET /api/metagame/v1/formats
 *   GET /api/metagame/v1/{format}/decks?window=&page=&pageSize=
 *   GET /api/metagame/v1/{format}/decks/{slug}
 *   GET /api/metagame/v1/{format}/decks/{slug}/cards?section=main|side
 *
 * Unlike the MTGO scrape (which stores individual event decklists), endstep
 * reports archetype-level aggregates plus one canonical sample decklist per
 * archetype. We store those in `endstep_archetypes` as a deckbuilding source:
 * seed lists and average compositions.
 *
 * Usage:
 *   pnpm sync:endstep
 *   pnpm sync:endstep -- --format=Pauper --window=30d --limit=20
 *   pnpm sync:endstep -- --dry-run
 *   pnpm sync:endstep -- --no-cards          # skip per-card statistics
 */
import { config } from "dotenv";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import type { Card, CardColor } from "../src/lib/cards/types";
import type {
  EndstepArchetype,
  EndstepArchetypeWithMatchups,
  EndstepCardStat,
  EndstepSampleCard,
} from "../src/lib/metagame/types";
import { EndstepMatchup, EndstepMatchupRecord } from "../src/lib/metagame/types";
import { MTGO_CARD_ALIASES } from "../src/lib/metagame/card-aliases";
import { nameAliases, normalizeName } from "../src/lib/cards/normalize-name";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const BASE = "https://endstep.cc/api/metagame/v1";
const COLLECTION = "endstep_archetypes";
const DELAY_MS = 200;
// endstep rejects pageSize > 50 with a 400.
const PAGE_SIZE = 50;

interface Options {
  format: string;
  window: string;
  population: string;
  limit: number | null;
  withCards: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string) => {
    const arg = argv.find((value) => value.startsWith(`--${flag}=`));
    return arg ? arg.split("=")[1] : undefined;
  };
  const limit = get("limit");
  return {
    format: get("format") ?? "Pauper",
    window: get("window") ?? "30d",
    population: get("population") ?? "rated",
    limit: limit ? Number.parseInt(limit, 10) : null,
    withCards: !argv.includes("--no-cards"),
    dryRun: argv.includes("--dry-run"),
  };
}

function headers(): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "application/json",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET a JSON endpoint with a small retry/backoff on transient failures. */
async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: headers() });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`${res.status} ${res.statusText}`);
        await sleep(500 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      await sleep(500 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface ListResponse {
  provenance?: { derivationVersion?: number | null; window?: RawWindow };
  decks?: { items?: RawDeckSummary[]; total?: number };
}

interface RawWindow {
  preset?: string;
  from?: string;
  to?: string;
}

interface RawDeckSummary {
  id: string;
  slug: string;
  name: string;
  machineNamed?: boolean;
  colours?: string[];
  art?: { cardName?: string | null } | null;
  keyCards?: string[];
  share?: { rate?: number; registrations?: number };
  players?: number;
  matchWinRate?: { rate?: number } | null;
  shareChange?: { points?: number; previousRate?: number } | null;
}

interface DetailResponse {
  provenance?: { derivationVersion?: number | null; window?: RawWindow };
  deck?: { id?: string };
  sampleList?: {
    main?: { name: string; count: number }[];
    side?: { name: string; count: number }[];
  } | null;
  texture?: {
    averageTurns?: number | null;
    mulliganRate?: { rate?: number } | null;
  } | null;
}

interface CardsResponse {
  cards?: { items?: RawCardStat[]; total?: number };
}

interface RawCardStat {
  name: string;
  playRate?: { count?: number; of?: number; rate?: number };
  averageCopies?: number;
}

async function fetchFormatId(requested: string): Promise<string> {
  const data = await getJson<{ formats?: { formatId: string }[] }>("/formats");
  const match = data.formats?.find(
    (format) => format.formatId.toLowerCase() === requested.toLowerCase(),
  );
  if (!match) {
    throw new Error(
      `format "${requested}" not found (available: ${data.formats
        ?.map((format) => format.formatId)
        .join(", ")})`,
    );
  }
  return match.formatId;
}

async function fetchSummaries(
  format: string,
  options: Options,
): Promise<RawDeckSummary[]> {
  const summaries: RawDeckSummary[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      window: options.window,
      population: options.population,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const data = await getJson<ListResponse>(`/${format}/decks?${params}`);
    const items = data.decks?.items ?? [];
    summaries.push(...items);
    if (items.length < PAGE_SIZE) break;
    if (options.limit && summaries.length >= options.limit) break;
    await sleep(DELAY_MS);
  }
  return options.limit ? summaries.slice(0, options.limit) : summaries;
}

async function fetchSampleList(
  format: string,
  slug: string,
  window: string,
): Promise<DetailResponse> {
  return getJson<DetailResponse>(
    `/${format}/decks/${encodeURIComponent(slug)}?window=${window}`,
  );
}

async function fetchCardStats(
  format: string,
  slug: string,
  section: "main" | "side",
  window: string,
): Promise<EndstepCardStat[]> {
  const stats: EndstepCardStat[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      window,
      section,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const data = await getJson<CardsResponse>(
      `/${format}/decks/${encodeURIComponent(slug)}/cards?${params}`,
    );
    const items = data.cards?.items ?? [];
    for (const item of items) {
      stats.push({
        name: item.name,
        average_copies: item.averageCopies ?? 0,
        play_rate: item.playRate?.rate ?? 0,
        count: item.playRate?.count ?? 0,
        of: item.playRate?.of ?? 0,
      });
    }
    if (items.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  return stats;
}

/**
 * The raw shape of one item from the endstep matchups endpoint. Unlike the
 * stored `EndstepMatchup`, the opponent is nested and the rate bounds may be
 * null when endstep gates the sample as too small.
 */
interface RawMatchup {
  wins: number;
  losses: number;
  matches: number;
  required?: number;
  gate?: string | null;
  rate?: number | null;
  low?: number | null;
  high?: number | null;
  deff?: number | null;
  opponent?: {
    id?: string;
    slug?: string;
    name?: string;
    machineNamed?: boolean;
  } | null;
}

/** Flatten endstep's nested opponent into the stored `EndstepMatchup` shape. */
function toMatchup(raw: RawMatchup): EndstepMatchup {
  return {
    opponent_id: raw.opponent?.id ?? "",
    opponent_slug: raw.opponent?.slug ?? "",
    opponent_name: raw.opponent?.name ?? "",
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
    matches: raw.matches ?? 0,
    rate: raw.rate ?? null,
    low: raw.low ?? null,
    high: raw.high ?? null,
    deff: raw.deff ?? null,
  };
}

async function fetchMatchups(
  format: string,
  slug: string,
  window: string,
): Promise<EndstepMatchup[]> {
  // The endpoint paginates (a popular archetype has 200+ opponents), so walk
  // every page — fetching only the first one would undercount the record.
  const matchups: EndstepMatchup[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      window,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const data = await getJson<{ matchups: { items: RawMatchup[] } }>(
      `/${format}/decks/${encodeURIComponent(slug)}/matchups?${params}`,
    );
    const items = data.matchups?.items ?? [];
    matchups.push(...items.map(toMatchup));
    if (items.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  return matchups;
}

interface ResolvedName {
  oracle_id: string;
  name: string;
  printing_id: string | null;
}

type NameResolver = Map<string, ResolvedName>;

/** Token / non-deck card layouts, which must never win a name lookup. */
const NON_DECK_LAYOUTS = [
  "token",
  "double_faced_token",
  "emblem",
  "art_series",
  "vanguard",
  "scheme",
  "planar",
];

/**
 * Build a normalized-alias → card index over the catalog, so endstep's sample
 * card names resolve to oracle ids (including front-face names for DFCs).
 */
async function buildNameResolver(db: Db): Promise<NameResolver> {
  const resolver: NameResolver = new Map();
  const cursor = db.collection<Card>("cards").find(
    { layout: { $nin: NON_DECK_LAYOUTS } },
    {
      projection: {
        oracle_id: 1,
        name: 1,
        metagame_printing_id: 1,
        default_printing_id: 1,
      },
    },
  );
  for await (const card of cursor) {
    const info: ResolvedName = {
      oracle_id: card.oracle_id,
      name: card.name,
      printing_id:
        card.metagame_printing_id ?? card.default_printing_id ?? null,
    };
    for (const alias of nameAliases(card.name)) {
      if (!resolver.has(alias)) resolver.set(alias, info);
    }
  }
  for (const [from, to] of Object.entries(MTGO_CARD_ALIASES)) {
    const info = resolver.get(normalizeName(to));
    if (info) resolver.set(normalizeName(from), info);
  }
  console.log(
    `[endstep] card name index: ${resolver.size.toLocaleString()} aliases`,
  );
  return resolver;
}

function toSample(
  cards: { name: string; count: number }[] | undefined,
  resolver: NameResolver,
): EndstepSampleCard[] {
  return (cards ?? []).map((card) => {
    const match = resolver.get(normalizeName(card.name));
    return {
      name: match?.name ?? card.name,
      count: card.count,
      oracle_id: match?.oracle_id ?? null,
      printing_id: match?.printing_id ?? null,
    };
  });
}

function colorsOf(colors: string[] | undefined): CardColor[] {
  const allowed = new Set<CardColor>(["W", "U", "B", "R", "G"]);
  return (colors ?? []).filter((color): color is CardColor =>
    allowed.has(color as CardColor),
  );
}

async function buildArchetype(
  format: string,
  summary: RawDeckSummary,
  options: Options,
  resolver: NameResolver,
): Promise<EndstepArchetypeWithMatchups> {
  const detail = await fetchSampleList(format, summary.slug, options.window);
  await sleep(DELAY_MS);

  let cardsMain: EndstepCardStat[] = [];
  let cardsSide: EndstepCardStat[] = [];
  if (options.withCards) {
    cardsMain = await fetchCardStats(format, summary.slug, "main", options.window);
    await sleep(DELAY_MS);
    cardsSide = await fetchCardStats(format, summary.slug, "side", options.window);
    await sleep(DELAY_MS);
  }

  const matchups = await fetchMatchups(format, summary.slug, options.window);
  await sleep(DELAY_MS);

  const provenance = detail.provenance ?? {};
  return {
    format_id: format,
    slug: summary.slug,
    endstep_id: summary.id,
    name: summary.name,
    machine_named: summary.machineNamed ?? false,
    colours: colorsOf(summary.colours),
    key_cards: summary.keyCards ?? [],
    art: summary.art?.cardName ? { card_name: summary.art.cardName } : null,
    share_rate: summary.share?.rate ?? null,
    registrations: summary.share?.registrations ?? 0,
    players: summary.players ?? 0,
    match_win_rate: summary.matchWinRate?.rate ?? null,
    sample_list: {
      main: toSample(detail.sampleList?.main, resolver),
      side: toSample(detail.sampleList?.side, resolver),
    },
    cards_main: cardsMain,
    cards_side: cardsSide,
    texture: detail.texture
      ? {
          average_turns: detail.texture.averageTurns ?? null,
          mulligan_rate: detail.texture.mulliganRate?.rate ?? null,
        }
      : null,
    window: {
      preset: provenance.window?.preset ?? options.window,
      from: provenance.window?.from ?? "",
      to: provenance.window?.to ?? "",
    },
    derivation_version: provenance.derivationVersion ?? null,
    source: "endstep",
    fetched_at: new Date().toISOString(),
    matchups,
  };
}

async function ensureIndexes(db: Db) {
  const archetypeCollection = db.collection(COLLECTION);
  const matchupCollection = db.collection("endstep_matchups");
  await Promise.all([
    archetypeCollection.createIndex({ format_id: 1, slug: 1 }, { unique: true }),
    archetypeCollection.createIndex({ format_id: 1, share_rate: -1 }),
    matchupCollection.createIndex(
      { format_id: 1, archetype_slug: 1, opponent_slug: 1 },
      { unique: true },
    ),
  ]);
}

async function run(db: Db, options: Options) {
  const visibility = await getJson<{ public?: boolean }>("/visibility");
  if (visibility.public === false) {
    throw new Error("endstep metagame is not public right now");
  }

  const format = await fetchFormatId(options.format);
  console.log(`[endstep] format: ${format} (window ${options.window})`);

  const resolver = await buildNameResolver(db);
  const summaries = await fetchSummaries(format, options);
  console.log(`[endstep] ${summaries.length} archetypes to ingest`);

  const archetypes: EndstepArchetypeWithMatchups[] = [];
  for (const summary of summaries) {
    const archetype = await buildArchetype(format, summary, options, resolver);
    archetypes.push(archetype);
    console.log(
      `[endstep] ${archetype.slug}: ${archetype.sample_list.main.length} main / ` +
        `${archetype.sample_list.side.length} side` +
        (options.withCards ? `, ${archetype.cards_main.length} card stats` : ""),
    );
  }

  if (options.dryRun) {
    console.log(`[endstep] dry run — ${archetypes.length} archetypes, nothing written`);
    return;
  }

  await ensureIndexes(db);
  const archetypeCollection = db.collection<EndstepArchetype>(COLLECTION);
  const matchupCollection = db.collection<EndstepMatchupRecord>("endstep_matchups");
  const archetypeOperations: AnyBulkWriteOperation<EndstepArchetype>[] = archetypes.map(
    (archetype) => ({
      updateOne: {
        filter: { format_id: archetype.format_id, slug: archetype.slug },
        update: { $set: archetype },
        upsert: true,
      },
    }),
  );
  for (let i = 0; i < archetypeOperations.length; i += 500) {
    await archetypeCollection.bulkWrite(archetypeOperations.slice(i, i + 500), { ordered: false });
  }

  // Store matchup data in separate collection.
  //
  // Older syncs read the opponent from the wrong path, so every matchup of an
  // archetype collided on the same upsert filter and only one record survived,
  // with `opponent_slug` stored as null. Drop those stale rows before writing
  // the corrected, flattened records.
  const cleaned = await db.collection("endstep_matchups").deleteMany({
    $or: [{ opponent_slug: null }, { opponent_slug: "" }],
  });
  if (cleaned.deletedCount) {
    console.log(`[endstep] removed ${cleaned.deletedCount} stale matchup records`);
  }
  const matchupRecords: EndstepMatchupRecord[] = archetypes.flatMap((archetype) => {
    return archetype.matchups.map((matchup) => ({
      format_id: archetype.format_id,
      archetype_slug: archetype.slug,
      opponent_slug: matchup.opponent_slug,
      window: options.window,
      population: options.population,
      share_rate_at_sync: archetype.share_rate,
      fetched_at: archetype.fetched_at,
      match: matchup,
    }));
  });
  const matchupOperations = matchupRecords.map(
    (record) => ({
      updateOne: {
        filter: {
          format_id: record.format_id,
          archetype_slug: record.archetype_slug,
          opponent_slug: record.opponent_slug,
        },
        update: { $set: record },
        upsert: true,
      },
    }),
  );
  for (let i = 0; i < matchupOperations.length; i += 500) {
    await matchupCollection.bulkWrite(matchupOperations.slice(i, i + 500), { ordered: false });
  }
  console.log(`[endstep] stored ${archetypes.length} archetypes, ${matchupRecords.length} matchup records`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) console.log("[endstep] dry run — nothing will be written");
  await withDb((db) => run(db, options));
  console.log("[endstep] done");
}

void main().catch((error) => {
  console.error("[endstep] failed:", error);
  process.exitCode = 1;
});
