import { normalizeName } from "@/lib/cards/normalize-name";
import type {
  Card,
  CardFace,
  CardImages,
  Legalities,
  Printing,
  PrintingFace,
} from "@/lib/cards/types";

export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  image_uris?: ScryfallImageUris;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  layout?: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  rarity?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  released_at?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallFace[];
  prices?: { usd?: string | null; usd_foil?: string | null };
  edhrec_rank?: number | null;
  scryfall_uri?: string;
  mtgo_id?: number;
  mtgo_foil_id?: number;
  legalities?: Record<string, string>;
  finishes?: string[];
  promo?: boolean;
  digital?: boolean;
  booster?: boolean;
  games?: string[];
}

export function normalizeImages(uris?: ScryfallImageUris): CardImages {
  return {
    small: uris?.small ?? null,
    normal: uris?.normal ?? null,
    large: uris?.large ?? null,
    art_crop: uris?.art_crop ?? null,
  };
}

export function toPrice(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isScryfallPauperLegal(card: ScryfallCard): boolean {
  return card.legalities?.pauper === "legal";
}

function oracleFaces(card: ScryfallCard): CardFace[] | null {
  if (!card.card_faces?.length) return null;
  return card.card_faces.map((face) => ({
    name: face.name,
    mana_cost: face.mana_cost ?? "",
    type_line: face.type_line ?? "",
    oracle_text: face.oracle_text ?? "",
    image_uris: normalizeImages(face.image_uris),
  }));
}

function printingFaces(card: ScryfallCard): PrintingFace[] | null {
  if (!card.card_faces?.length) return null;
  return card.card_faces.map((face) => ({
    name: face.name,
    image_uris: normalizeImages(face.image_uris),
  }));
}

function normalizeLegalities(
  legalities: Record<string, string> | undefined,
): Legalities {
  const result: Legalities = {};
  for (const [format, value] of Object.entries(legalities ?? {})) {
    if (
      value === "legal" ||
      value === "not_legal" ||
      value === "banned" ||
      value === "restricted"
    ) {
      result[format] = value;
    }
  }
  return result;
}

export function scryfallToPrinting(card: ScryfallCard, now: string): Printing {
  return {
    scryfall_id: card.id,
    oracle_id: card.oracle_id ?? card.id,
    name: card.name,
    set: card.set ?? "",
    set_name: card.set_name ?? "",
    collector_number: card.collector_number ?? "",
    rarity: card.rarity ?? "common",
    released_at: card.released_at ?? "",
    image_uris: normalizeImages(card.image_uris),
    card_faces: printingFaces(card),
    prices: {
      usd: toPrice(card.prices?.usd),
      usd_foil: toPrice(card.prices?.usd_foil),
    },
    finishes: card.finishes ?? [],
    promo: card.promo ?? false,
    digital: card.digital ?? false,
    mtgo_id: card.mtgo_id ?? null,
    updated_at: now,
  };
}

export function scryfallToCanonical(card: ScryfallCard, now: string): Card {
  return {
    oracle_id: card.oracle_id ?? card.id,
    name: card.name,
    name_normalized: normalizeName(card.name),
    layout: card.layout ?? "normal",
    mana_cost: card.mana_cost ?? "",
    cmc: card.cmc ?? 0,
    type_line: card.type_line ?? "",
    oracle_text: card.oracle_text ?? "",
    colors: (card.colors ?? []) as Card["colors"],
    color_identity: (card.color_identity ?? []) as Card["color_identity"],
    keywords: card.keywords ?? [],
    rarity: card.rarity ?? "common",
    set: card.set ?? "",
    set_name: card.set_name ?? "",
    collector_number: card.collector_number ?? "",
    released_at: card.released_at ?? "",
    image_uris: normalizeImages(card.image_uris),
    card_faces: oracleFaces(card),
    prices: {
      usd: toPrice(card.prices?.usd),
      usd_foil: toPrice(card.prices?.usd_foil),
    },
    edhrec_rank: card.edhrec_rank ?? null,
    scryfall_uri: card.scryfall_uri ?? "",
    mtgo_id: card.mtgo_id ?? null,
    default_printing_id: card.id,
    metagame_printing_id: null,
    printings_count: 0,
    legalities: normalizeLegalities(card.legalities),
    updated_at: now,
  };
}

/** Metadata used to rank printings for the canonical face and metagame default. */
export interface PrintingRank {
  releasedAt: string;
  promo: boolean;
  digital: boolean;
  rarity: string;
  set: string;
}

export function printingRank(card: ScryfallCard): PrintingRank {
  return {
    releasedAt: card.released_at ?? "",
    promo: card.promo ?? false,
    digital: card.digital ?? false,
    rarity: card.rarity ?? "common",
    set: card.set ?? "",
  };
}

/** Earliest non-promo printing, regardless of rarity. */
export function isBetterEarliestPrinting(
  candidate: PrintingRank,
  incumbent: PrintingRank | null,
): boolean {
  if (candidate.promo) return false;
  if (!incumbent) return true;
  return candidate.releasedAt < incumbent.releasedAt;
}

/**
 * Prefer the most recently released non-promo, non-digital printing, but never
 * let The Zeta Set (slz) be the default art.
 */
export function isBetterCanonical(
  candidate: PrintingRank,
  incumbent: PrintingRank,
): boolean {
  const candidateZeta = candidate.set === "slz";
  const incumbentZeta = incumbent.set === "slz";
  if (candidateZeta !== incumbentZeta) return !candidateZeta;
  if (candidate.promo !== incumbent.promo) return !candidate.promo;
  if (candidate.digital !== incumbent.digital) return !candidate.digital;
  return candidate.releasedAt > incumbent.releasedAt;
}

/** Earliest common, non-promo, non-digital printing with original art. */
export function isBetterMetagamePrinting(
  candidate: PrintingRank,
  incumbent: PrintingRank | null,
): boolean {
  if (candidate.promo) return false;
  if (candidate.rarity !== "common") return false;
  if (!incumbent) return true;
  return candidate.releasedAt < incumbent.releasedAt;
}
