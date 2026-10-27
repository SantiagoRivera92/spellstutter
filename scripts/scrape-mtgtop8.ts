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
  MetagameCardEntry,
  MetagameDeck,
  MetagameEvent,
  MetagameEventType,
} from "../src/lib/metagame/types";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const BASE = "https://www.mtgtop8.com";
const SEARCH_URL = `${BASE}/search`;
const FORMAT_CODE = "PAU";
const DEFAULT_DELAY_MS = 1000;
const DEFAULT_MIN_PLAYERS = 16;
const DEFAULT_DAYS = 7;
const MAX_SEARCH_PAGES = 1000;
const SEARCH_DELAY_MS = 250;
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
  Accept: "text/html,application/xhtml+xml",
};

interface Options {
  start: Date;
  end: Date;
  minPlayers: number;
  limitEvents: number | null;
  force: boolean;
  dryRun: boolean;
  delayMs: number;
}

interface SearchEvent {
  id: number;
  name: string;
  date: string | null;
}

interface DeckRef {
  id: number;
  player: string;
  rank: string;
}

interface ParsedEvent {
  title: string;
  playerCount: number;
  date: string;
  isMtgo: boolean;
  decks: DeckRef[];
}

interface RawCard {
  quantity: number;
  name: string;
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

function getArg(argv: string[], flag: string): string | undefined {
  const arg = argv.find((value) => value.startsWith(`--${flag}=`));
  return arg ? arg.split("=").slice(1).join("=") : undefined;
}

function utcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseArgDate(value: string): Date | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const year = Number.parseInt(match[3], 10);
  return new Date(
    Date.UTC(
      year < 100 ? 2000 + year : year,
      Number.parseInt(match[2], 10) - 1,
      Number.parseInt(match[1], 10),
    ),
  );
}

function parseArgs(argv: string[]): Options {
  const today = utcDay();
  const monthArg = getArg(argv, "month");
  let start = addDays(today, -(DEFAULT_DAYS - 1));
  let end = today;

  if (monthArg) {
    const match = monthArg.match(/^(\d{4})-(\d{2})$/);
    if (!match) throw new Error("Use --month=YYYY-MM");
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (month < 1 || month > 12) throw new Error("Use --month=YYYY-MM");
    start = new Date(Date.UTC(year, month - 1, 1));
    end = new Date(Date.UTC(year, month, 0));
  } else {
    const daysValue = Number.parseInt(
      getArg(argv, "days") ?? String(DEFAULT_DAYS),
      10,
    );
    const days = Number.isFinite(daysValue) ? Math.max(1, daysValue) : DEFAULT_DAYS;
    start = addDays(today, -(days - 1));
    end = today;
  }

  const minPlayersValue = Number.parseInt(
    getArg(argv, "min-players") ?? String(DEFAULT_MIN_PLAYERS),
    10,
  );
  const limit = getArg(argv, "limit");
  const delayValue = Number.parseInt(
    getArg(argv, "delay") ?? String(DEFAULT_DELAY_MS),
    10,
  );

  return {
    start,
    end,
    minPlayers: Number.isFinite(minPlayersValue)
      ? minPlayersValue
      : DEFAULT_MIN_PLAYERS,
    limitEvents: limit ? Number.parseInt(limit, 10) : null,
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
    delayMs: Number.isFinite(delayValue)
      ? Math.max(0, delayValue)
      : DEFAULT_DELAY_MS,
  };
}

function formatSearchDate(date: Date): string {
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
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

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: { ...HEADERS, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

function parseSearchPage(html: string): SearchEvent[] {
  const events = new Map<number, SearchEvent>();
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const body = row[1];
    const idMatch = body.match(/event\?e=(\d+)&f=PAU/);
    if (!idMatch) continue;
    const id = Number.parseInt(idMatch[1], 10);
    const nameMatch = body.match(
      new RegExp(`event\\?e=${id}&f=PAU[^>]*>([^<]+)<\\/a>`),
    );
    const dateMatches = [
      ...body.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g),
    ];
    const dateMatch = dateMatches.at(-1);
    const date = dateMatch
      ? parseArgDate(`${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`)
      : null;
    if (!nameMatch) continue;
    events.set(id, {
      id,
      name: cleanText(nameMatch[1]),
      date: date?.toISOString() ?? null,
    });
  }
  return [...events.values()];
}

async function searchEvents(options: Options): Promise<SearchEvent[]> {
  const found = new Map<number, SearchEvent>();
  for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
    const body = new URLSearchParams({
      current_page: String(page),
      format: FORMAT_CODE,
      date_start: formatSearchDate(options.start),
      date_end: formatSearchDate(options.end),
      "compet_check[P]": "1",
      "compet_check[M]": "1",
      "compet_check[C]": "1",
      "compet_check[R]": "1",
      MD_check: "1",
      SB_check: "1",
    });
    const html = await fetchHtml(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const rows = parseSearchPage(html);
    if (!rows.length) break;
    for (const row of rows) {
      if (row.date) {
        const date = new Date(row.date);
        if (date < options.start || date > options.end) continue;
      }
      if (!found.has(row.id)) found.set(row.id, row);
    }
    const oldest = rows
      .map((row) => (row.date ? Date.parse(row.date) : null))
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b)[0];
    if (oldest != null && oldest < options.start.getTime()) break;
    await sleep(Math.min(options.delayMs, SEARCH_DELAY_MS));
  }
  return [...found.values()].sort((a, b) => {
    const aDate = a.date ? Date.parse(a.date) : 0;
    const bDate = b.date ? Date.parse(b.date) : 0;
    return bDate - aDate || b.id - a.id;
  });
}

function parseDeckRefs(html: string, eventId: number): DeckRef[] {
  const decks = new Map<number, DeckRef>();
  const pattern = new RegExp(
    `<div class=(?:chosen_tr|hover_tr)[^>]*>[\\s\\S]*?` +
      `<div[^>]*class=S14[^>]*>([^<]+)<\\/div>[\\s\\S]*?` +
      `<a href=\\?e=${eventId}&(?:amp;)?d=(\\d+)&(?:amp;)?f=${FORMAT_CODE}[^>]*>([^<]+)<\\/a>[\\s\\S]*?` +
      `<a class=player[^>]*>([^<]+)<\\/a>`,
    "g",
  );
  for (const match of html.matchAll(pattern)) {
    const id = Number.parseInt(match[2], 10);
    if (decks.has(id)) continue;
    decks.set(id, {
      id,
      rank: cleanText(match[1]),
      player: cleanText(match[3]),
    });
  }
  return [...decks.values()];
}

function parseEventPage(html: string, eventId: number): ParsedEvent | null {
  const titleMatch = html.match(/<div class=event_title>([\s\S]*?)<\/div>/);
  const fallbackTitle = html.match(
    /<title>Pauper event - ([^<]+) @ mtgtop8\.com<\/title>/i,
  );
  const title = titleMatch
    ? cleanText(titleMatch[1])
    : fallbackTitle
      ? cleanText(fallbackTitle[1])
      : "";
  if (!title) return null;

  const meta = html.match(/<div class=meta_arch[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
  const source = html.match(/Source:\s*<a[^>]*href=([^ >]+)/i)?.[1] ?? "";
  const isMtgo =
    /online\/mtgo\.png/i.test(meta) ||
    /mtgo\.com/i.test(source) ||
    /^MTGO\b/i.test(title);

  const stats = html
    .replace(/&nbsp;/gi, " ")
    .match(/(\d+)\s+players\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (!stats) return null;
  const day = parseArgDate(`${stats[2]}/${stats[3]}/${stats[4]}`);
  if (!day) return null;

  return {
    title,
    playerCount: Number.parseInt(stats[1], 10),
    date: day.toISOString(),
    isMtgo,
    decks: parseDeckRefs(html, eventId),
  };
}

function parseDeckCards(html: string): { main: RawCard[]; side: RawCard[] } {
  const main: RawCard[] = [];
  const side: RawCard[] = [];
  const pattern =
    /<div id=(md[^ >]*|sb[^ >]*)[^>]*>\s*(\d+)\s*<span class=L14>([^<]+)<\/span>/g;
  for (const match of html.matchAll(pattern)) {
    const name = cleanText(match[3]);
    if (!name) continue;
    const card = { quantity: Number.parseInt(match[2], 10), name };
    if (!card.quantity) continue;
    if (match[1].startsWith("sb")) side.push(card);
    else main.push(card);
  }
  return { main, side };
}

function eventTypeFromName(name: string): MetagameEventType {
  if (/challenge/i.test(name)) return "challenge";
  if (/qualifier|nationals|invitational|rcq/i.test(name)) return "qualifier";
  if (/league|lega|liga/i.test(name)) return "league";
  if (/showcase|main event|open/i.test(name)) return "showcase";
  return "other";
}

function normalizeEventName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function eventNameKey(value: string): string {
  return normalizeEventName(value);
}

function dayBounds(iso: string): { start: string; end: string } {
  const start = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  const end = addDays(start, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function findDuplicateEvent(
  db: Db,
  name: string,
  date: string,
): Promise<MetagameEvent | null> {
  const { start, end } = dayBounds(date);
  const events = await db
    .collection<MetagameEvent>("metagame_events")
    .find(
      { date: { $gte: start, $lt: end } },
      { projection: { _id: 0, slug: 1, name: 1, date: 1, url: 1 } },
    )
    .toArray();
  const key = eventNameKey(name);
  return events.find((event) => eventNameKey(event.name) === key) ?? null;
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

  console.log(`[mtgtop8] card index: ${resolver.size.toLocaleString()} names`);
  return resolver;
}

function toEntries(cards: RawCard[], resolver: CardResolver): MetagameCardEntry[] {
  return cards.map((card) => {
    const name = card.name.trim();
    const resolved = resolver.get(normalizeName(name));
    const exempt = IDENTITY_EXEMPT_CARDS.has(
      resolved?.name_normalized ?? normalizeName(name),
    );
    return {
      name,
      quantity: card.quantity,
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
  ref: DeckRef,
  cards: { main: RawCard[]; side: RawCard[] },
  event: MetagameEvent,
  resolver: CardResolver,
  now: string,
): MetagameDeck | null {
  const mainboard = toEntries(cards.main, resolver);
  if (!mainboard.length) return null;
  const sideboard = toEntries(cards.side, resolver);
  const colorIdentity = identityOf(mainboard);
  const classification = classifyDeck(
    mainboard.map((entry) => entry.name),
    colorIdentity,
  );
  const rankMatch = ref.rank.match(/^\d+/);

  return {
    event_slug: event.slug,
    event_name: event.name,
    event_type: event.event_type,
    event_date: event.date,
    player: ref.player || "Unknown",
    rank: rankMatch ? Number.parseInt(rankMatch[0], 10) : null,
    wins: null,
    losses: null,
    draws: null,
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

function summarize(decks: MetagameDeck[]): {
  slug: string;
  name: string;
  decks: number;
}[] {
  const map = new Map<string, { slug: string; name: string; decks: number }>();
  for (const deck of decks) {
    const row = map.get(deck.archetype.slug) ?? {
      slug: deck.archetype.slug,
      name: deck.archetype.name,
      decks: 0,
    };
    row.decks += 1;
    map.set(deck.archetype.slug, row);
  }
  return [...map.values()].sort((a, b) => b.decks - a.decks);
}

async function processEvent(
  db: Db,
  resolver: CardResolver,
  searchEvent: SearchEvent,
  options: Options,
  now: string,
): Promise<MetagameDeck[]> {
  const slug = `mtgtop8-${searchEvent.id}`;
  const url = `${BASE}/event?e=${searchEvent.id}&f=${FORMAT_CODE}`;
  const existing = await db
    .collection<MetagameEvent>("metagame_events")
    .findOne(
      { $or: [{ slug }, { url }] },
      { projection: { _id: 0, slug: 1 } },
    );
  if (existing && !options.force) {
    console.log(`[mtgtop8] ${slug} already stored — skipping`);
    return [];
  }

  if (/^MTGO\b/i.test(searchEvent.name)) {
    console.log(`[mtgtop8] ${slug} is MTGO — skipping`);
    return [];
  }

  await sleep(options.delayMs);
  const html = await fetchHtml(url);
  const parsed = parseEventPage(html, searchEvent.id);
  if (!parsed) {
    console.log(`[mtgtop8] ${slug} has no event data — skipping`);
    return [];
  }
  if (parsed.isMtgo) {
    console.log(`[mtgtop8] ${slug} is MTGO — skipping`);
    return [];
  }
  if (parsed.playerCount < options.minPlayers) {
    console.log(
      `[mtgtop8] ${slug} has ${parsed.playerCount} players — skipping`,
    );
    return [];
  }

  if (!existing) {
    const duplicate = await findDuplicateEvent(
      db,
      parsed.title,
      parsed.date,
    );
    if (duplicate) {
      console.log(`[mtgtop8] ${slug} duplicates ${duplicate.slug} — skipping`);
      return [];
    }
  }

  const event: MetagameEvent = {
    slug,
    name: parsed.title,
    event_type: eventTypeFromName(parsed.title),
    date: parsed.date,
    url,
    player_count: parsed.playerCount,
    deck_count: 0,
    scraped_at: now,
  };

  const decks: MetagameDeck[] = [];
  const seenPlayers = new Map<string, number>();
  for (const ref of parsed.decks) {
    await sleep(options.delayMs);
    let cards: { main: RawCard[]; side: RawCard[] };
    try {
      cards = parseDeckCards(
        await fetchHtml(`${BASE}/event?e=${searchEvent.id}&d=${ref.id}&f=${FORMAT_CODE}`),
      );
    } catch (error) {
      console.warn(
        `[mtgtop8] deck ${ref.id} for ${slug} failed:`,
        error instanceof Error ? error.message : error,
      );
      continue;
    }
    const deck = normalizeDeck(ref, cards, event, resolver, now);
    if (!deck) continue;

    const basePlayer = deck.player;
    const seen = seenPlayers.get(basePlayer) ?? 0;
    if (seen > 0) deck.player = `${basePlayer} (${deck.rank ?? seen + 1})`;
    seenPlayers.set(basePlayer, seen + 1);
    decks.push(deck);
  }

  if (!decks.length) {
    console.log(`[mtgtop8] ${slug} has no decklists — skipping`);
    return [];
  }

  event.deck_count = decks.length;
  if (options.dryRun) {
    console.log(
      `[mtgtop8] ${slug}: ${decks.length} decks, ${event.player_count} players (dry run)`,
    );
    for (const row of summarize(decks)) {
      console.log(`  ${row.name}: ${row.decks}`);
    }
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

  await db
    .collection<MetagameEvent>("metagame_events")
    .updateOne({ slug }, { $set: event }, { upsert: true });

  console.log(
    `[mtgtop8] ${slug}: stored ${decks.length} decks, ${event.player_count} players`,
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
  ]);
}

async function run(db: Db, options: Options) {
  const now = new Date().toISOString();
  if (!options.dryRun) await ensureIndexes(db);
  const resolver = await buildCardIndex(db);
  const events = await searchEvents(options);
  console.log(
    `[mtgtop8] ${events.length} events between ${formatSearchDate(options.start)} and ${formatSearchDate(options.end)}`,
  );

  let stored = 0;
  for (const event of events) {
    if (options.limitEvents != null && stored >= options.limitEvents) break;
    const decks = await processEvent(db, resolver, event, options, now);
    if (decks.length) stored += 1;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) console.log("[mtgtop8] dry run — nothing will be written");
  await withDb((db) => run(db, options));
  console.log("[mtgtop8] done");
}

void main().catch((error) => {
  console.error("[mtgtop8] failed:", error);
  process.exitCode = 1;
});
