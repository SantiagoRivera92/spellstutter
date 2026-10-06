import "server-only";
import type { Filter } from "mongodb";
import { COLLECTIONS, getDb } from "@/lib/mongo/client";
import { normalizeName } from "@/lib/cards/normalize-name";
import { parseQuery, isQueryEmpty } from "./search-syntax";
import { isPauperLegal } from "./types";
import type {
  Card,
  CardSearchResponse,
  CardSearchResult,
  Printing,
} from "./types";

export interface SearchOptions {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "cmc" | "price" | "rarity";
  dir?: "asc" | "desc";
}

const MAX_PAGE_SIZE = 100;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(q: string): Filter<Card> {
  const parsed = parseQuery(q);
  const filter: Filter<Card> = {};

  if (parsed.exactName) {
    filter.name_normalized = parsed.exactName.toLowerCase();
  }

  if (!isQueryEmpty(parsed)) {
    const and: Filter<Card>[] = [];

    for (const term of parsed.nameTerms) {
      and.push({ name_normalized: { $regex: escapeRegex(term.toLowerCase()) } });
    }
    for (const term of parsed.types) {
      and.push({ type_line: { $regex: escapeRegex(term), $options: "i" } });
    }
    for (const term of parsed.oracleTerms) {
      and.push({
        $or: [
          { oracle_text: { $regex: escapeRegex(term), $options: "i" } },
          {
            "card_faces.oracle_text": {
              $regex: escapeRegex(term),
              $options: "i",
            },
          },
        ],
      });
    }
    for (const term of parsed.keywords) {
      and.push({ keywords: { $regex: `^${escapeRegex(term)}$`, $options: "i" } });
    }
    if (parsed.colors.length) {
      and.push({ colors: { $in: parsed.colors } });
    }
    if (parsed.colorIdentity.length) {
      and.push({
        color_identity: { $not: { $elemMatch: { $nin: parsed.colorIdentity } } },
      } as Filter<Card>);
    }
    if (parsed.rarities.length) {
      and.push({ rarity: { $in: parsed.rarities } });
    }
    if (parsed.cmcMin != null || parsed.cmcMax != null) {
      const cmc: Record<string, number> = {};
      if (parsed.cmcMin != null) cmc.$gte = parsed.cmcMin;
      if (parsed.cmcMax != null) cmc.$lte = parsed.cmcMax;
      and.push({ cmc: cmc } as Filter<Card>);
    }

    if (and.length) filter.$and = and;
  }

  return filter;
}

function toResult(card: Card): CardSearchResult {
  const face = card.card_faces?.[0];
  const faceCosts = (card.card_faces ?? [])
    .map((entry) => entry.mana_cost)
    .filter(Boolean);
  const manaCost = card.mana_cost || face?.mana_cost || "";
  return {
    oracle_id: card.oracle_id,
    scryfall_id: card.default_printing_id,
    pauper_legal: isPauperLegal(card),
    name: card.name,
    mana_cost: manaCost,
    mana_costs: faceCosts.length ? faceCosts : manaCost ? [manaCost] : [],
    mana_value: card.cmc,
    type_line: card.type_line || face?.type_line || "",
    oracle_text: card.oracle_text || face?.oracle_text || "",
    colors: card.colors,
    color_identity: card.color_identity,
    rarity: card.rarity,
    set_name: card.set_name,
    art_crop: card.image_uris.art_crop ?? face?.image_uris.art_crop ?? null,
    image_normal:
      card.image_uris.normal ?? face?.image_uris.normal ?? null,
    price_usd: card.prices.usd,
  };
}

export async function searchCards(
  options: SearchOptions,
): Promise<CardSearchResponse> {
  const db = await getDb();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options.pageSize ?? 50),
  );
  const q = options.q?.trim() ?? "";
  const filter = q ? buildFilter(q) : {};

  const sortField: Record<string, 1 | -1> = {};
  const dir = options.dir === "desc" ? -1 : 1;
  switch (options.sort) {
    case "cmc":
      sortField.cmc = dir;
      sortField.name_normalized = 1;
      break;
    case "price":
      sortField["prices.usd"] = dir;
      sortField.name_normalized = 1;
      break;
    case "rarity":
      sortField.rarity = dir;
      sortField.name_normalized = 1;
      break;
    default:
      sortField.name_normalized = dir;
  }

  const collection = db.collection<Card>(COLLECTIONS.cards);
  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sortField)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    cards: docs.map(toResult),
    total,
    page,
    page_size: pageSize,
  };
}

// `_id` is an ObjectId (has toJSON), which React refuses to pass from Server
// to Client Components, so it is always projected out.
const WITHOUT_ID = { projection: { _id: 0 } } as const;

export async function getCardByOracleId(
  oracleId: string,
): Promise<Card | null> {
  const db = await getDb();
  return db
    .collection<Card>(COLLECTIONS.cards)
    .findOne({ oracle_id: oracleId }, WITHOUT_ID);
}

export async function getCardsByOracleIds(
  oracleIds: string[],
): Promise<Card[]> {
  if (!oracleIds.length) return [];
  const db = await getDb();
  return db
    .collection<Card>(COLLECTIONS.cards)
    .find({ oracle_id: { $in: oracleIds } }, WITHOUT_ID)
    .toArray();
}

export async function getCardsByNames(names: string[]): Promise<Card[]> {
  const normalized = names
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  if (!normalized.length) return [];
  const db = await getDb();
  return db
    .collection<Card>(COLLECTIONS.cards)
    .find({ name_normalized: { $in: normalized } }, WITHOUT_ID)
    .toArray();
}

export async function getPrintingsByIds(
  scryfallIds: string[],
): Promise<Printing[]> {
  if (!scryfallIds.length) return [];
  const db = await getDb();
  return db
    .collection<Printing>(COLLECTIONS.printings)
    .find({ scryfall_id: { $in: scryfallIds } }, WITHOUT_ID)
    .toArray();
}

export async function getPrintings(oracleId: string): Promise<Printing[]> {
  const db = await getDb();
  return db
    .collection<Printing>(COLLECTIONS.printings)
    .find({ oracle_id: oracleId }, WITHOUT_ID)
    .sort({ released_at: -1 })
    .toArray();
}

/** Cropped art for a card by name, preferring its earliest common printing. */
export async function getCardArtByName(name: string): Promise<string | null> {
  const db = await getDb();
  const card = await db
    .collection<Card>(COLLECTIONS.cards)
    .findOne({ name_normalized: normalizeName(name) });
  if (!card) return null;

  if (card.metagame_printing_id) {
    const printing = await db
      .collection<Printing>(COLLECTIONS.printings)
      .findOne({ scryfall_id: card.metagame_printing_id });
    const art =
      printing?.image_uris.art_crop ??
      printing?.card_faces?.[0]?.image_uris.art_crop;
    if (art) return art;
  }

  return (
    card.image_uris.art_crop ??
    card.card_faces?.[0]?.image_uris.art_crop ??
    null
  );
}


