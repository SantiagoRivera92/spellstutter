/**
 * Scrape Pauper league and challenge results from mtgo.com into MongoDB.
 *
 * Each decklist page embeds its full payload as:
 *   window.MTGO.decklists.data = { ... };
 *
 * We read that JSON directly (no DOM scraping), normalize league and challenge
 * shapes into one document per deck, classify the archetype with the local
 * heuristic rules, and upsert into `metagame_events` / `metagame_decks`.
 *
 * Usage:
 *   pnpm sync:metagame                 # current month
 *   pnpm sync:metagame -- --year=2026 --month=09
 *   pnpm sync:metagame -- --limit=5 --dry-run
 *   pnpm sync:metagame -- --force
 */
import { config } from "dotenv";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import type { Card, CardColor, Printing } from "../src/lib/cards/types";
import {
  CLASSIFICATION_VERSION,
  IDENTITY_EXEMPT_CARDS,
  classifyDeck,
} from "../src/lib/metagame/archetypes";
import type {
  MetagameCardEntry,
  MetagameDeck,
  MetagameEvent,
  MetagameEventType,
} from "../src/lib/metagame/types";
import { identityColors } from "../src/lib/cards/mana";
import { MTGO_CARD_ALIASES, isMtgoCardAlias } from "../src/lib/metagame/card-aliases";
import { nameAliases, normalizeName } from "../src/lib/cards/normalize-name";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const BASE = "https://www.mtgo.com";
const DELAY_MS = 300;

interface RawCard {
  qty: string;
  card_attributes?: {
    card_name?: string;
    colors?: string[];
  };
}

interface RawRecord {
  wins?: string;
  losses?: string;
}

interface RawDeck {
  player: string;
  main_deck?: RawCard[];
  sideboard_deck?: RawCard[];
  wins?: number | RawRecord;
  losses?: number | RawRecord;
}

function parseRecord(value: number | RawRecord | undefined): {
  wins: number | null;
  losses: number | null;
} {
  if (typeof value === "number") return { wins: value, losses: null };
  if (value && typeof value === "object") {
    const wins = Number.parseInt(value.wins ?? "", 10);
    const losses = Number.parseInt(value.losses ?? "", 10);
    return {
      wins: Number.isFinite(wins) ? wins : null,
      losses: Number.isFinite(losses) ? losses : null,
    };
  }
  return { wins: null, losses: null };
}

interface RawStanding {
  rank?: string;
  login_name?: string;
}

interface RawDecklistData {
  playeventid?: string;
  event_id?: number | string;
  name?: string;
  description?: string;
  publish_date?: string;
  starttime?: string;
  site_name: string;
  type?: string;
  url?: string;
  player_count?: { players?: number } | number;
  decklists: RawDeck[];
  standings?: RawStanding[];
}

interface Options {
  year: number;
  month: number;
  /** Additional months to scrape in the same run, e.g. --months=6,7,8,9 */
  months: number[];
  force: boolean;
  dryRun: boolean;
  limit: number | null;
}

const COLOR_MAP: Record<string, CardColor> = {
  COLOR_WHITE: "W",
  COLOR_BLUE: "U",
  COLOR_BLACK: "B",
  COLOR_RED: "R",
  COLOR_GREEN: "G",
};

function parseArgs(argv: string[]): Options {
  const now = new Date();
  const get = (flag: string) => {
    const arg = argv.find((value) => value.startsWith(`--${flag}=`));
    return arg ? arg.split("=")[1] : undefined;
  };
  const limit = get("limit");
  const monthsArg = get("months");
  const months = monthsArg
    ? monthsArg
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value))
    : [];
  return {
    year: Number.parseInt(get("year") ?? String(now.getUTCFullYear()), 10),
    month: Number.parseInt(get("month") ?? String(now.getUTCMonth() + 1), 10),
    months,
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
    limit: limit ? Number.parseInt(limit, 10) : null,
  };
}

function headers(): Record<string, string> {
  // mtgo.com serves an empty, JS-only shell to plain bot User-Agents, so we
  // present a normal browser UA. Requests are rate-limited below.
  return {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eventTypeFromSlug(slug: string): MetagameEventType {
  if (slug.includes("league")) return "league";
  if (slug.includes("challenge")) return "challenge";
  if (slug.includes("preliminary")) return "preliminary";
  if (slug.includes("showcase")) return "showcase";
  if (slug.includes("qualifier")) return "qualifier";
  return "other";
}

function extractDecklistData(html: string): RawDecklistData | null {
  const marker = "window.MTGO.decklists.data = ";
  const markerStart = html.indexOf(marker);
  if (markerStart === -1) return null;

  const start = html.indexOf("{", markerStart + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as RawDecklistData;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

interface ResolvedCard {
  oracle_id: string;
  /** Canonical name, so aliased MTGO reskins display under the paper name. */
  name: string;
  /** Canonical normalized name, so alias lookups resolve identity correctly. */
  name_normalized: string;
  printing_id: string | null;
  mana_cost: string | null;
  type_line: string | null;
  image: string | null;
  colors: CardColor[];
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

/** scryfall_id -> image, for the earliest-common-printing default art. */
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

type CardResolver = Map<string, ResolvedCard>;

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
 * Build a name→card index over the whole catalog, keyed by every alias a card
 * can be referred to by. Built once per run.
 */
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
      printing_id:
        doc.metagame_printing_id ?? doc.default_printing_id ?? null,
      mana_cost: doc.mana_cost ?? null,
      type_line: doc.type_line ?? null,
      // Earliest common printing (the metagame default art).
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

  for (const [from, to] of Object.entries(MTGO_CARD_ALIASES)) {
    const info = resolver.get(normalizeName(to));
    if (info) resolver.set(normalizeName(from), info);
  }

  console.log(`[metagame] card index: ${resolver.size.toLocaleString()} names`);
  return resolver;
}

function toEntries(
  cards: RawCard[] | undefined,
  resolver: CardResolver,
): MetagameCardEntry[] {
  if (!cards?.length) return [];
  const map = new Map<string, number>();
  for (const card of cards) {
    const name = card.card_attributes?.card_name;
    if (!name) continue;
    const quantity = Number.parseInt(card.qty, 10) || 1;
    map.set(name, (map.get(name) ?? 0) + quantity);
  }
  return [...map.entries()].map(([name, quantity]) => {
    const resolved = resolver.get(normalizeName(name));
    const exempt = IDENTITY_EXEMPT_CARDS.has(
      resolved?.name_normalized ?? normalizeName(name),
    );
    return {
      // Reskinned MTGO names (Through the Omenpaths) display under the paper
      // Spider-Man name; every other card keeps its own name.
      name: isMtgoCardAlias(name) && resolved ? resolved.name : name,
      quantity,
      oracle_id: resolved?.oracle_id ?? null,
      printing_id: resolved?.printing_id ?? null,
      type_line: resolved?.type_line ?? null,
      image: resolved?.image ?? null,
      colors: exempt ? [] : (resolved?.colors ?? []),
    };
  });
}

function identityOf(cards: RawCard[], resolver: CardResolver): CardColor[] {
  const identity = new Set<CardColor>();
  for (const card of cards) {
    const name = card.card_attributes?.card_name;
    if (!name) continue;

    const resolved = resolver.get(normalizeName(name));
    if (
      IDENTITY_EXEMPT_CARDS.has(resolved?.name_normalized ?? normalizeName(name))
    ) {
      continue;
    }

    const mtgoColors: CardColor[] = [];
    for (const color of card.card_attributes?.colors ?? []) {
      const mapped = COLOR_MAP[color];
      if (mapped) mtgoColors.push(mapped);
    }
    for (const color of identityColors(
      resolved?.mana_cost ?? null,
      mtgoColors,
    )) {
      identity.add(color);
    }
  }
  const order: CardColor[] = ["W", "U", "B", "R", "G"];
  return order.filter((color) => identity.has(color));
}

async function fetchPauperDecklistSlugs(
  year: number,
  month: number,
): Promise<string[]> {
  const monthStr = String(month).padStart(2, "0");

  // The archive index intermittently returns an empty, JS-only shell instead of
  // the server-rendered list. Retry a few times, busting the cache, until links
  // appear.
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const url = `${BASE}/decklists/${year}/${monthStr}${
      attempt > 1 ? `?retry=${attempt}` : ""
    }`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      await sleep(1000 * attempt);
      continue;
    }
    const html = await res.text();
    const slugs = new Set<string>();
    const regex = /href="\/decklist\/(pauper-[a-z0-9-]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      slugs.add(match[1]);
    }
    if (slugs.size > 0) return [...slugs];
    console.warn(
      `[metagame] ${year}-${monthStr}: empty index (attempt ${attempt}) — retrying`,
    );
    await sleep(1000 * attempt);
  }

  return [];
}

function normalizeEvent(data: RawDecklistData, now: string): MetagameEvent {
  const slug = data.site_name;
  const dateRaw = data.publish_date ?? data.starttime ?? "";
  const deckCount = data.decklists?.length ?? 0;
  const playerCount =
    typeof data.player_count === "number"
      ? data.player_count
      : (data.player_count?.players ?? deckCount);

  return {
    slug,
    name: data.name ?? data.description ?? slug,
    event_type: eventTypeFromSlug(slug),
    date: dateRaw,
    url: `${BASE}/decklist/${slug}`,
    player_count: playerCount,
    deck_count: deckCount,
    scraped_at: now,
  };
}

function normalizeDecks(
  data: RawDecklistData,
  event: MetagameEvent,
  version: string,
  now: string,
  resolver: CardResolver,
): MetagameDeck[] {
  const standingByPlayer = new Map<string, number>();
  for (const standing of data.standings ?? []) {
    if (!standing.login_name) continue;
    const rank = Number.parseInt(standing.rank ?? "", 10);
    if (Number.isFinite(rank)) {
      standingByPlayer.set(normalizeName(standing.login_name), rank);
    }
  }

  return (data.decklists ?? [])
    .filter((deck) => deck.player && deck.main_deck?.length)
    .map((deck) => {
      const mainboard = toEntries(deck.main_deck, resolver);
      const sideboard = toEntries(deck.sideboard_deck, resolver);
      const record = parseRecord(deck.wins);
      // Color identity is the mainboard's: sideboards are full of off-color
      // hate (Blue Elemental Blast, Faerie Macabre) that would make a
      // mono-green Elves deck read as five-color.
      const mainIdentity = identityOf(deck.main_deck ?? [], resolver);
      const classification = classifyDeck(
        mainboard.map((entry) => entry.name),
        mainIdentity,
      );
      return {
        event_slug: event.slug,
        event_name: event.name,
        event_type: event.event_type,
        event_date: event.date,
        player: deck.player,
        rank: standingByPlayer.get(normalizeName(deck.player)) ?? null,
        wins: record.wins,
        losses: record.losses,
        color_identity: mainIdentity,
        mainboard,
        sideboard,
        archetype: {
          slug: classification.slug,
          name: classification.name,
          confidence: classification.confidence,
        },
        classification_version: version,
        scraped_at: now,
      } satisfies MetagameDeck;
    });
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db
      .collection("metagame_events")
      .createIndex({ slug: 1 }, { unique: true }),
    db
      .collection("metagame_events")
      .createIndex({ date: -1, event_type: 1 }),
    db
      .collection("metagame_decks")
      .createIndex({ event_slug: 1, player: 1 }, { unique: true }),
    db.collection("metagame_decks").createIndex({ "archetype.slug": 1 }),
    db.collection("metagame_decks").createIndex({ event_date: -1 }),
    db.collection("metagame_decks").createIndex({ "mainboard.oracle_id": 1 }),
    db.collection("metagame_decks").createIndex({ "sideboard.oracle_id": 1 }),
  ]);
}

async function processSlug(
  db: Db,
  options: Options,
  resolver: CardResolver,
  slug: string,
  now: string,
) {
  if (!options.force) {
    const existing = await db
      .collection("metagame_events")
      .findOne({ slug }, { projection: { slug: 1 } });
    if (existing) {
      console.log(`[metagame] ${slug} already stored — skipping`);
      return;
    }
  }

  const res = await fetch(`${BASE}/decklist/${slug}`, { headers: headers() });
  if (!res.ok) {
    console.warn(`[metagame] ${slug}: ${res.status} ${res.statusText}`);
    await sleep(DELAY_MS);
    return;
  }
  const html = await res.text();
  const data = extractDecklistData(html);
  if (!data) {
    console.warn(`[metagame] ${slug}: no embedded deck data found`);
    await sleep(DELAY_MS);
    return;
  }

  const event = normalizeEvent(data, now);
  const decks = normalizeDecks(
    data,
    event,
    CLASSIFICATION_VERSION,
    now,
    resolver,
  );
  event.deck_count = decks.length;

  if (options.dryRun) {
    const counts = new Map<string, number>();
    for (const deck of decks) {
      counts.set(deck.archetype.name, (counts.get(deck.archetype.name) ?? 0) + 1);
    }
    console.log(
      `[metagame] ${slug}: ${decks.length} decks — ${[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name} ${count}`)
        .join(", ")}`,
    );
  } else {
    await db
      .collection<MetagameEvent>("metagame_events")
      .updateOne({ slug: event.slug }, { $set: event }, { upsert: true });

    const operations: AnyBulkWriteOperation<MetagameDeck>[] = decks.map(
      (deck) => ({
        updateOne: {
          filter: { event_slug: deck.event_slug, player: deck.player },
          update: { $set: deck },
          upsert: true,
        },
      }),
    );
    if (operations.length) {
      await db
        .collection<MetagameDeck>("metagame_decks")
        .bulkWrite(operations, { ordered: false });
    }
    console.log(`[metagame] ${slug}: stored ${decks.length} decks`);
  }

  await sleep(DELAY_MS);
}

async function run(db: Db, options: Options) {
  const now = new Date().toISOString();
  if (!options.dryRun) await ensureIndexes(db);
  const resolver = await buildCardIndex(db);

  const months = options.months.length ? options.months : [options.month];
  for (const month of months) {
    let slugs = await fetchPauperDecklistSlugs(options.year, month);
    if (options.limit) slugs = slugs.slice(0, options.limit);
    console.log(
      `[metagame] ${slugs.length} Pauper decklists found for ${options.year}-${String(
        month,
      ).padStart(2, "0")}`,
    );
    for (const slug of slugs) {
      await processSlug(db, options, resolver, slug, now);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) console.log("[metagame] dry run — nothing will be written");
  await withDb((db) => run(db, options));
  console.log("[metagame] done");
}

void main().catch((error) => {
  console.error("[metagame] failed:", error);
  process.exitCode = 1;
});
