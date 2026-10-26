import "server-only";
import { COLLECTIONS, getDb } from "@/lib/mongo/client";
import { getCardsByOracleIds, getPrintingsByIds } from "@/lib/cards/queries";
import { COLOR_ORDER } from "@/lib/cards/mana";
import type { Card, CardColor } from "@/lib/cards/types";
import { categoryFor, frontFace } from "./card-type";
import type {
  ArchetypeBreakdown,
  ArchetypeCardStat,
  ArchetypeOption,
  ArchetypeStat,
  MetagameDeck,
  MetagameEvent,
  MetagameSummary,
} from "./types";
import type { EndstepMatchup, EndstepMatchupRecord } from "@/lib/metagame/types";
import { ENDSTEP_ARCHETYPE_BY_RULE, endstepSlugForRule } from "./endstep-archetypes";

// `_id` is an ObjectId (has toJSON) and cannot be passed from Server to Client
// Components, so it is always projected out.
const WITHOUT_ID = { projection: { _id: 0 } } as const;

export async function listEvents(limit = 40): Promise<MetagameEvent[]> {
  const db = await getDb();
  return db
    .collection<MetagameEvent>(COLLECTIONS.events)
    .find({}, WITHOUT_ID)
    .sort({ date: -1, scraped_at: -1 })
    .limit(limit)
    .toArray();
}

export async function getEvent(
  slug: string,
): Promise<{ event: MetagameEvent; decks: MetagameDeck[] } | null> {
  const db = await getDb();
  const event = await db
    .collection<MetagameEvent>(COLLECTIONS.events)
    .findOne({ slug }, WITHOUT_ID);
  if (!event) return null;

  const decks = await db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .find({ event_slug: slug }, WITHOUT_ID)
    .sort({ rank: 1, player: 1 })
    .toArray();

  return { event, decks };
}

export async function listDecksByArchetype(
  slug: string,
  limit = 25,
): Promise<MetagameDeck[]> {
  const db = await getDb();
  return db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .find({ "archetype.slug": slug }, WITHOUT_ID)
    .sort({ event_date: -1, rank: 1 })
    .limit(limit)
    .toArray();
}

export async function listArchetypes(): Promise<ArchetypeOption[]> {
  const db = await getDb();
  const since = isoDateDaysAgo(120);
  const rows = await db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .aggregate<{ _id: string; name: string; decks: number }>([
      { $match: { event_date: { $gte: since } } },
      {
        $group: {
          _id: "$archetype.slug",
          name: { $first: "$archetype.name" },
          decks: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: "other" } } },
      { $sort: { decks: -1 } },
    ])
    .toArray();
  return rows.map((row) => ({ slug: row._id, name: row.name, decks: row.decks }));
}

export async function getMetagameDeck(
  eventSlug: string,
  player: string,
): Promise<MetagameDeck | null> {
  const db = await getDb();
  return db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .findOne({ event_slug: eventSlug, player }, WITHOUT_ID);
}

export interface ArchetypeOverview {
  slug: string;
  name: string;
  decks: number;
  share: number;
  color_identity: CardColor[];
  average_rank: number | null;
  /** Most distinctive non-land card: name + cropped art. */
  signature_name: string | null;
  art_crop: string | null;
}

/** A color is core to an archetype only if it appears in >= this share of its cards. */
const COLOR_SHARE_THRESHOLD = 0.02;

/**
 * Archetype colors are the colors its cards actually play, not the union of
 * its decks' identities: a mono-green Elves deck should not read as five-color
 * just because one list splashes a sideboard card. Colors under the threshold
 * are treated as outliers and dropped.
 */
const ARCHETYPE_COLORS_TTL_MS = 5 * 60_000;
let archetypeColorsCache: {
  since: string;
  expires: number;
  value: Map<string, CardColor[]>;
} | null = null;

async function getArchetypeColors(
  since: string,
): Promise<Map<string, CardColor[]>> {
  const now = Date.now();
  if (
    archetypeColorsCache &&
    archetypeColorsCache.since === since &&
    archetypeColorsCache.expires > now
  ) {
    return archetypeColorsCache.value;
  }

  const db = await getDb();
  const decks = db.collection<MetagameDeck>(COLLECTIONS.decks);

  const [byColor, totals] = await Promise.all([
    decks
      .aggregate<{ _id: { slug: string; color: CardColor }; qty: number }>([
        { $match: { event_date: { $gte: since } } },
        { $unwind: "$mainboard" },
        { $unwind: "$mainboard.colors" },
        {
          $group: {
            _id: { slug: "$archetype.slug", color: "$mainboard.colors" },
            qty: { $sum: "$mainboard.quantity" },
          },
        },
      ])
      .toArray(),
    decks
      .aggregate<{ _id: string; total: number }>([
        { $match: { event_date: { $gte: since } } },
        { $unwind: "$mainboard" },
        {
          $group: {
            _id: "$archetype.slug",
            total: { $sum: "$mainboard.quantity" },
          },
        },
      ])
      .toArray(),
  ]);

  const totalBySlug = new Map(totals.map((row) => [row._id, row.total]));
  const bySlug = new Map<string, Map<CardColor, number>>();
  for (const row of byColor) {
    const color = row._id.color;
    if (!COLOR_ORDER.includes(color)) continue;
    const map = bySlug.get(row._id.slug) ?? new Map<CardColor, number>();
    map.set(color, (map.get(color) ?? 0) + row.qty);
    bySlug.set(row._id.slug, map);
  }

  const result = new Map<string, CardColor[]>();
  for (const [slug, map] of bySlug) {
    const total = totalBySlug.get(slug) ?? 0;
    result.set(
      slug,
      COLOR_ORDER.filter(
        (color) =>
          total > 0 && (map.get(color) ?? 0) / total >= COLOR_SHARE_THRESHOLD,
      ),
    );
  }
  archetypeColorsCache = {
    since,
    expires: now + ARCHETYPE_COLORS_TTL_MS,
    value: result,
  };
  return result;
}

/**
 * endstep's metagame share per archetype, keyed by this app's archetype slug.
 *
 * endstep reports each archetype's share of the whole metagame, unlike the
 * MTGO-derived share which only covers lists that finished well. Only mapped
 * archetypes have a value here; callers fall back to the MTGO share otherwise.
 */
export async function getEndstepShareByRule(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .collection<{ slug: string; share_rate: number | null }>(
      COLLECTIONS.endstepArchetypes,
    )
    .find(
      { format_id: "Pauper" },
      { projection: { _id: 0, slug: 1, share_rate: 1 } },
    )
    .toArray();

  const byEndstepSlug = new Map(rows.map((row) => [row.slug, row.share_rate]));
  const byRule = new Map<string, number>();
  for (const [rule, endstep] of Object.entries(ENDSTEP_ARCHETYPE_BY_RULE)) {
    const rate = byEndstepSlug.get(endstep);
    if (rate != null) byRule.set(rule, rate);
  }
  return byRule;
}

export async function listArchetypeOverview(
  days = 30,
): Promise<ArchetypeOverview[]> {
  const db = await getDb();
  const since = isoDateDaysAgo(days);
  const decks = db.collection<MetagameDeck>(COLLECTIONS.decks);
  const archetypeColors = await getArchetypeColors(since);

  const [rows, cardRows, endstepShares] = await Promise.all([
    decks
      .aggregate<{
        _id: string;
        name: string;
        decks: number;
        ranks: (number | null)[];
      }>([
        { $match: { event_date: { $gte: since } } },
        {
          $group: {
            _id: "$archetype.slug",
            name: { $first: "$archetype.name" },
            decks: { $sum: 1 },
            ranks: { $push: "$rank" },
          },
        },
        { $sort: { decks: -1 } },
      ])
      .toArray(),
    // Per archetype/card inclusion, used to find each archetype's signature card.
    decks
      .aggregate<{
        _id: { slug: string; name: string };
        decks: number;
        oracle_id: string | null;
        type_line: string | null;
      }>([
        { $match: { event_date: { $gte: since } } },
        { $unwind: "$mainboard" },
        {
          $group: {
            _id: { slug: "$archetype.slug", name: "$mainboard.name" },
            decks: { $sum: 1 },
            oracle_id: { $first: "$mainboard.oracle_id" },
            type_line: { $first: "$mainboard.type_line" },
          },
        },
      ])
      .toArray(),
    getEndstepShareByRule(),
  ]);

  const total = rows.reduce((sum, row) => sum + row.decks, 0);
  const decksBySlug = new Map(rows.map((row) => [row._id, row.decks]));

  // name -> (slug -> inclusion rate)
  const cardUsage = new Map<string, Map<string, number>>();
  const cardOracle = new Map<string, string>();
  for (const row of cardRows) {
    if (categoryFor(row.type_line) === "Lands") continue;
    if (!row.oracle_id) continue;
    const slugDecks = decksBySlug.get(row._id.slug) ?? 0;
    if (!slugDecks) continue;
    const perArchetype = cardUsage.get(row._id.name) ?? new Map();
    perArchetype.set(row._id.slug, row.decks / slugDecks);
    cardUsage.set(row._id.name, perArchetype);
    cardOracle.set(row._id.name, row.oracle_id);
  }

  // For each archetype pick the most significant card it does not share with
  // other archetypes: inclusion rate here, weighted (TF-IDF style) by how few
  // other archetypes play it at all.
  const archetypeCount = rows.length;
  const signature = new Map<string, { name: string; oracle_id: string }>();
  for (const row of rows) {
    let bestName: string | null = null;
    let bestOracle: string | null = null;
    let bestScore = -1;
    for (const [name, usage] of cardUsage) {
      const here = usage.get(row._id) ?? 0;
      if (here <= 0) continue;
      const idf = Math.log((archetypeCount + 1) / usage.size);
      const score = here * idf;
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
        bestOracle = cardOracle.get(name) ?? null;
      }
    }
    if (bestName && bestOracle) {
      signature.set(row._id, { name: bestName, oracle_id: bestOracle });
    }
  }

  // Fetch cropped art for the chosen cards, using the earliest common printing
  // (never a Zeta printing), matching the rest of the site.
  const artByOracle = new Map<string, string>();
  const oracleIds = [...signature.values()].map((entry) => entry.oracle_id);
  if (oracleIds.length) {
    const cards = await db
      .collection<Card>(COLLECTIONS.cards)
      .find(
        { oracle_id: { $in: oracleIds } },
        {
          projection: {
            oracle_id: 1,
            image_uris: 1,
            card_faces: 1,
            metagame_printing_id: 1,
          },
        },
      )
      .toArray();
    const printingIds = [
      ...new Set(
        cards.map((card) => card.metagame_printing_id).filter(Boolean),
      ),
    ] as string[];
    const printingDocs = printingIds.length
      ? await getPrintingsByIds(printingIds).catch(() => [])
      : [];
    const artByPrinting = new Map(
      printingDocs.map((printing) => [
        printing.scryfall_id,
        printing.image_uris.art_crop ??
          printing.card_faces?.[0]?.image_uris.art_crop ??
          null,
      ]),
    );
    for (const card of cards) {
      const art =
        (card.metagame_printing_id
          ? artByPrinting.get(card.metagame_printing_id)
          : null) ??
        card.image_uris?.art_crop ??
        card.card_faces?.[0]?.image_uris.art_crop ??
        null;
      if (art) artByOracle.set(card.oracle_id, art);
    }
  }

  return rows
    .map((row) => {
      const ranks = (row.ranks ?? []).filter(
        (rank): rank is number => typeof rank === "number",
      );
      const sig = signature.get(row._id) ?? null;
      return {
        slug: row._id,
        name: row.name,
        decks: row.decks,
        // Prefer endstep's share of the whole metagame; fall back to the share
        // of the MTGO lists we scraped when this archetype has no mapping.
        share: endstepShares.get(row._id) ?? (total ? row.decks / total : 0),
        color_identity: archetypeColors.get(row._id) ?? [],
        average_rank: ranks.length
          ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
          : null,
        signature_name: sig?.name ?? null,
        art_crop: sig ? (artByOracle.get(sig.oracle_id) ?? null) : null,
      };
    })
    .sort((a, b) => b.share - a.share);
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

interface CardAggRow {
  _id: { oracle_id: string | null; name: string };
  decks: number;
  total_qty: number;
  min_qty: number;
  max_qty: number;
}

async function aggregateBoard(
  db: Awaited<ReturnType<typeof getDb>>,
  slug: string,
  since: string,
  board: "mainboard" | "sideboard",
  totalDecks: number,
): Promise<ArchetypeCardStat[]> {
  const rows = await db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .aggregate<CardAggRow>([
      { $match: { "archetype.slug": slug, event_date: { $gte: since } } },
      { $unwind: `$${board}` },
      {
        $group: {
          _id: {
            oracle_id: `$${board}.oracle_id`,
            name: `$${board}.name`,
          },
          decks: { $sum: 1 },
          total_qty: { $sum: `$${board}.quantity` },
          min_qty: { $min: `$${board}.quantity` },
          max_qty: { $max: `$${board}.quantity` },
        },
      },
      { $sort: { decks: -1, total_qty: -1 } },
    ])
    .toArray();

  return rows.map((row) => ({
    oracle_id: row._id.oracle_id,
    name: row._id.name,
    decks: row.decks,
    include_rate: totalDecks ? row.decks / totalDecks : 0,
    avg_qty: row.decks ? row.total_qty / row.decks : 0,
    min_qty: row.min_qty,
    max_qty: row.max_qty,
  }));
}

export async function getArchetypeBreakdown(
  slug: string,
  days = 30,
): Promise<ArchetypeBreakdown | null> {
  const db = await getDb();
  const since = isoDateDaysAgo(days);
  const collection = db.collection<MetagameDeck>(COLLECTIONS.decks);
  const match = { "archetype.slug": slug, event_date: { $gte: since } };

  const totalDecks = await collection.countDocuments(match);
  if (!totalDecks) return null;

  const [nameRow, main, side, sizes] = await Promise.all([
    collection.findOne(match, { projection: { "archetype.name": 1 } }),
    aggregateBoard(db, slug, since, "mainboard", totalDecks),
    aggregateBoard(db, slug, since, "sideboard", totalDecks),
    collection
      .aggregate<{ main: number; side: number }>([
        { $match: match },
        {
          $project: {
            main: {
              $sum: {
                $map: {
                  input: "$mainboard",
                  as: "c",
                  in: "$$c.quantity",
                },
              },
            },
            side: {
              $sum: {
                $map: {
                  input: "$sideboard",
                  as: "c",
                  in: "$$c.quantity",
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            main: { $avg: "$main" },
            side: { $avg: "$side" },
          },
        },
      ])
      .toArray(),
  ]);

  return {
    slug,
    name: nameRow?.archetype.name ?? slug,
    decks: totalDecks,
    average_main_size: sizes[0]?.main ?? 0,
    average_side_size: sizes[0]?.side ?? 0,
    main,
    side,
  };
}

export interface CardArchetypeUsage {
  slug: string;
  name: string;
  decks: number;
  total_decks: number;
  include_rate: number;
  avg_qty: number;
}

export async function getArchetypesForCard(
  oracleId: string,
  days = 120,
): Promise<CardArchetypeUsage[]> {
  const db = await getDb();
  const since = isoDateDaysAgo(days);
  const collection = db.collection<MetagameDeck>(COLLECTIONS.decks);

  const [usageRows, totals] = await Promise.all([
    collection
      .aggregate<{
        _id: string;
        name: string;
        decks: number;
        total_qty: number;
      }>([
        {
          $match: {
            event_date: { $gte: since },
            "mainboard.oracle_id": oracleId,
          },
        },
        {
          $project: {
            archetype: 1,
            qty: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$mainboard",
                      as: "c",
                      cond: { $eq: ["$$c.oracle_id", oracleId] },
                    },
                  },
                  as: "m",
                  in: "$$m.quantity",
                },
              },
            },
          },
        },
        {
          $group: {
            _id: "$archetype.slug",
            name: { $first: "$archetype.name" },
            decks: { $sum: 1 },
            total_qty: { $sum: "$qty" },
          },
        },
        { $sort: { decks: -1 } },
      ])
      .toArray(),
    collection
      .aggregate<{ _id: string; decks: number }>([
        { $match: { event_date: { $gte: since } } },
        { $group: { _id: "$archetype.slug", decks: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const totalBySlug = new Map(totals.map((row) => [row._id, row.decks]));
  return usageRows.map((row) => {
    const totalDecks = totalBySlug.get(row._id) ?? row.decks;
    return {
      slug: row._id,
      name: row.name,
      decks: row.decks,
      total_decks: totalDecks,
      include_rate: totalDecks ? row.decks / totalDecks : 0,
      avg_qty: row.decks ? row.total_qty / row.decks : 0,
    };
  });
}

interface TotalsRow {
  _id: string;
  name: string;
  decks: number;
  wins: number;
  losses: number;
  ranks: number[];
}

export async function getMetagameSummary(
  days = 30,
): Promise<MetagameSummary> {
  const db = await getDb();
  const since = isoDateDaysAgo(days);
  const decks = db.collection<MetagameDeck>(COLLECTIONS.decks);
  const match = { event_date: { $gte: since } };
  const archetypeColors = await getArchetypeColors(since);

  const [totals, cardRows, eventCount, deckCount] = await Promise.all([
    decks
      .aggregate<TotalsRow>([
        { $match: match },
        {
          $group: {
            _id: "$archetype.slug",
            name: { $first: "$archetype.name" },
            decks: { $sum: 1 },
            wins: { $sum: { $ifNull: ["$wins", 0] } },
            losses: { $sum: { $ifNull: ["$losses", 0] } },
            ranks: { $push: "$rank" },
          },
        },
        { $sort: { decks: -1 } },
      ])
      .toArray(),
    decks
      .aggregate<{ _id: { slug: string; name: string }; count: number }>([
        { $match: match },
        { $unwind: "$mainboard" },
        {
          $group: {
            _id: {
              slug: "$archetype.slug",
              name: "$mainboard.name",
            },
            count: { $sum: "$mainboard.quantity" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray(),
    db.collection(COLLECTIONS.events).countDocuments({ date: { $gte: since } }),
    decks.countDocuments(match),
  ]);

  const topCardsBySlug = new Map<string, { name: string; count: number }[]>();
  for (const row of cardRows) {
    const slug = row._id.slug;
    const list = topCardsBySlug.get(slug) ?? [];
    if (list.length < 5) {
      list.push({ name: row._id.name, count: row.count });
      topCardsBySlug.set(slug, list);
    }
  }

  const archetypes: ArchetypeStat[] = totals.map((row) => {
    const wins = row.wins ?? 0;
    const losses = row.losses ?? 0;
    const decided = wins + losses;
    const ranks = (row.ranks ?? []).filter(
      (rank): rank is number => typeof rank === "number",
    );
    return {
      slug: row._id,
      name: row.name,
      decks: row.decks,
      meta_share: deckCount ? row.decks / deckCount : 0,
      wins,
      losses,
      win_rate: decided > 0 ? wins / decided : null,
      average_rank: ranks.length
        ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
        : null,
      color_identity: archetypeColors.get(row._id) ?? [],
      top_cards: topCardsBySlug.get(row._id) ?? [],
    };
  });

  return {
    events: eventCount,
    decks: deckCount,
    since,
    archetypes,
  };
}

export interface StapleCard {
  name: string;
  oracle_id: string | null;
  image: string | null;
  art_crop: string | null;
  type_line: string | null;
  decks: number;
  copies: number;
  inclusion: number;
}

export type StapleCategory = "creatures" | "spells" | "lands" | "sideboard";

export interface StaplesResult {
  decks: number;
  creatures: StapleCard[];
  noncreatures: StapleCard[];
  lands: StapleCard[];
  sideboard: StapleCard[];
}

function stapleCategory(typeLine: string | null): "creature" | "noncreature" | "land" {
  const type = frontFace(typeLine).toLowerCase();
  if (type.includes("creature")) return "creature";
  if (type.includes("land")) return "land";
  return "noncreature";
}

interface StapleAggRow {
  _id: string;
  oracle_id: string | null;
  image: string | null;
  type_line: string | null;
  decks: number;
  copies: number;
}

async function aggregateBoardStaples(
  since: string,
  board: "mainboard" | "sideboard",
): Promise<StapleAggRow[]> {
  const db = await getDb();
  return db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .aggregate<StapleAggRow>([
      { $match: { event_date: { $gte: since } } },
      { $unwind: `$${board}` },
      {
        $group: {
          _id: `$${board}.name`,
          oracle_id: { $first: `$${board}.oracle_id` },
          image: { $first: `$${board}.image` },
          type_line: { $first: `$${board}.type_line` },
          decks: { $sum: 1 },
          copies: { $sum: `$${board}.quantity` },
        },
      },
    ])
    .toArray();
}

function toStapleCards(rows: StapleAggRow[], totalDecks: number): StapleCard[] {
  return rows.map((row) => ({
    name: row._id,
    oracle_id: row.oracle_id ?? null,
    image: row.image ?? null,
    art_crop: null,
    type_line: row.type_line ? frontFace(row.type_line) : null,
    decks: row.decks,
    copies: row.copies,
    inclusion: totalDecks ? row.decks / totalDecks : 0,
  }));
}

const byDecks = (a: StapleCard, b: StapleCard) =>
  b.decks - a.decks || b.copies - a.copies || a.name.localeCompare(b.name);

/** Attach art crops (earliest common printing, never Zeta) to each list. */
async function attachStapleArt(
  lists: StapleCard[][],
): Promise<StapleCard[][]> {
  const oracleIds = [
    ...new Set(lists.flat().map((card) => card.oracle_id).filter(Boolean)),
  ] as string[];
  const artByOracle = new Map<string, string>();
  if (oracleIds.length) {
    const cards = await getCardsByOracleIds(oracleIds).catch(() => []);
    const printingIds = [
      ...new Set(
        cards.map((card) => card.metagame_printing_id).filter(Boolean),
      ),
    ] as string[];
    const printingDocs = printingIds.length
      ? await getPrintingsByIds(printingIds).catch(() => [])
      : [];
    const artByPrinting = new Map(
      printingDocs.map((printing) => [
        printing.scryfall_id,
        printing.image_uris.art_crop ??
          printing.card_faces?.[0]?.image_uris.art_crop ??
          null,
      ]),
    );
    for (const card of cards) {
      const art =
        (card.metagame_printing_id
          ? artByPrinting.get(card.metagame_printing_id)
          : null) ??
        card.image_uris?.art_crop ??
        card.card_faces?.[0]?.image_uris.art_crop ??
        null;
      if (art) artByOracle.set(card.oracle_id, art);
    }
  }
  return lists.map((list) =>
    list.map((card) => ({
      ...card,
      art_crop: card.oracle_id
        ? (artByOracle.get(card.oracle_id) ?? null)
        : null,
    })),
  );
}

/** Top staples for the overview page, split by class plus a sideboard list. */
export async function listStaples(
  days = 30,
  limit = 10,
): Promise<StaplesResult> {
  const since = isoDateDaysAgo(days);
  const db = await getDb();
  const totalDecks = await db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .countDocuments({ event_date: { $gte: since } });

  const [mainRows, sideRows] = await Promise.all([
    aggregateBoardStaples(since, "mainboard"),
    aggregateBoardStaples(since, "sideboard"),
  ]);
  const main = toStapleCards(mainRows, totalDecks);
  const side = toStapleCards(sideRows, totalDecks);

  const creatures = main
    .filter((card) => stapleCategory(card.type_line) === "creature")
    .sort(byDecks)
    .slice(0, limit);
  const noncreatures = main
    .filter((card) => stapleCategory(card.type_line) === "noncreature")
    .sort(byDecks)
    .slice(0, limit);
  const lands = main
    .filter((card) => stapleCategory(card.type_line) === "land")
    .sort(byDecks)
    .slice(0, limit);
  const sideboard = side.sort(byDecks).slice(0, limit);

  const [c, n, l, s] = await attachStapleArt([
    creatures,
    noncreatures,
    lands,
    sideboard,
  ]);
  return {
    decks: totalDecks,
    creatures: c,
    noncreatures: n,
    lands: l,
    sideboard: s,
  };
}

/** Top 100 staples for one class, for the dedicated sub-pages. */
export async function listStapleCategory(
  days = 30,
  category: StapleCategory,
  limit = 100,
): Promise<{ decks: number; cards: StapleCard[] }> {
  const since = isoDateDaysAgo(days);
  const db = await getDb();
  const totalDecks = await db
    .collection<MetagameDeck>(COLLECTIONS.decks)
    .countDocuments({ event_date: { $gte: since } });

  const board = category === "sideboard" ? "sideboard" : "mainboard";
  const rows = await aggregateBoardStaples(since, board);
  let cards = toStapleCards(rows, totalDecks);

  if (category === "creatures") {
    cards = cards.filter((card) => stapleCategory(card.type_line) === "creature");
  } else if (category === "spells") {
    cards = cards.filter((card) => stapleCategory(card.type_line) === "noncreature");
  } else if (category === "lands") {
    cards = cards.filter((card) => stapleCategory(card.type_line) === "land");
  }

  const selected = cards.sort(byDecks).slice(0, limit);
  const [withArt] = await attachStapleArt([selected]);
  return { decks: totalDecks, cards: withArt };
}

/** Single-archetype statistics, without aggregating the whole metagame. */
export async function getArchetypeStat(
  slug: string,
  days = 30,
): Promise<ArchetypeStat | null> {
  const db = await getDb();
  const since = isoDateDaysAgo(days);
  const decks = db.collection<MetagameDeck>(COLLECTIONS.decks);
  const match = { "archetype.slug": slug, event_date: { $gte: since } };

  const [totals, cardRows, deckCount, archetypeColors] = await Promise.all([
    decks
      .aggregate<TotalsRow>([
        { $match: match },
        {
          $group: {
            _id: "$archetype.slug",
            name: { $first: "$archetype.name" },
            decks: { $sum: 1 },
            wins: { $sum: { $ifNull: ["$wins", 0] } },
            losses: { $sum: { $ifNull: ["$losses", 0] } },
            ranks: { $push: "$rank" },
          },
        },
      ])
      .toArray(),
    decks
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $unwind: "$mainboard" },
        {
          $group: {
            _id: "$mainboard.name",
            count: { $sum: "$mainboard.quantity" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
    decks.countDocuments({ event_date: { $gte: since } }),
    getArchetypeColors(since),
  ]);

  const row = totals[0];
  if (!row) return null;

  const wins = row.wins ?? 0;
  const losses = row.losses ?? 0;
  const decided = wins + losses;
  const ranks = (row.ranks ?? []).filter(
    (rank): rank is number => typeof rank === "number",
  );

  return {
    slug: row._id,
    name: row.name,
    decks: row.decks,
    meta_share: deckCount ? row.decks / deckCount : 0,
    wins,
    losses,
    win_rate: decided > 0 ? wins / decided : null,
    average_rank: ranks.length
      ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
      : null,
    color_identity: archetypeColors.get(row._id) ?? [],
    top_cards: cardRows.map((card) => ({ name: card._id, count: card.count })),
  };
}

/**
 * A win/loss record for an archetype. `source` records where the numbers came
 * from so the UI can label them.
 */
export interface ArchetypeRecord {
  wins: number;
  losses: number;
  matches: number;
  win_rate: number | null;
  source: "endstep" | "mtgo";
}

/** Resolve one of this app's archetype slugs to an endstep archetype slug. */
function endstepSlug(slug: string): string | null {
  return endstepSlugForRule(slug);
}

/** Fetch the head-to-head matchup records for an archetype from endstep data. */
export async function getArchetypeMatchups(
  slug: string,
  days = 30,
): Promise<EndstepMatchupRecord[]> {
  const endstepArchetype = endstepSlug(slug);
  if (!endstepArchetype) return [];
  const db = await getDb();
  const collection = db.collection<EndstepMatchupRecord>(COLLECTIONS.endstepMatchups);
  return collection
    .find({
      format_id: "Pauper",
      archetype_slug: endstepArchetype,
      window: `${days}d`,
    })
    .sort({ "match.matches": -1 })
    .toArray();
}

/**
 * Win/loss record for an archetype summed across its endstep matchups.
 *
 * endstep reports a win rate plus per-opponent W/L counts; summing the counts
 * gives the overall record. Returns null when the archetype has no endstep
 * mapping or no matchup data, so callers can fall back to the MTGO record.
 */
export async function getEndstepArchetypeRecord(
  slug: string,
  days = 30,
): Promise<ArchetypeRecord | null> {
  const endstepArchetype = endstepSlug(slug);
  if (!endstepArchetype) return null;

  const db = await getDb();
  const matchups = await db
    .collection<EndstepMatchupRecord>(COLLECTIONS.endstepMatchups)
    .find(
      {
        format_id: "Pauper",
        archetype_slug: endstepArchetype,
        window: `${days}d`,
      },
      { projection: { _id: 0, "match.wins": 1, "match.losses": 1, "match.matches": 1 } },
    )
    .toArray();
  if (!matchups.length) return null;

  let wins = 0;
  let losses = 0;
  let matches = 0;
  for (const record of matchups) {
    const match: Partial<EndstepMatchup> = record.match ?? {};
    wins += match.wins ?? 0;
    losses += match.losses ?? 0;
    matches += match.matches ?? (match.wins ?? 0) + (match.losses ?? 0);
  }

  const decided = wins + losses;
  return {
    wins,
    losses,
    matches,
    win_rate: decided > 0 ? wins / decided : null,
    source: "endstep",
  };
}
