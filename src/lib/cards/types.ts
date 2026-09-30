export type CardColor = "W" | "U" | "B" | "R" | "G";

export type LegalityStatus =
  | "legal"
  | "not_legal"
  | "banned"
  | "restricted";

export type Legalities = Partial<Record<string, LegalityStatus>>;

export interface CardImages {
  small: string | null;
  normal: string | null;
  large: string | null;
  art_crop: string | null;
}

export interface CardFace {
  name: string;
  mana_cost: string;
  type_line: string;
  oracle_text: string;
  image_uris: CardImages;
}

/** Printings only need face names + art; oracle text lives on the canonical card. */
export interface PrintingFace {
  name: string;
  image_uris: CardImages;
}

export interface CardPrice {
  usd: number | null;
  usd_foil: number | null;
}

export interface Card {
  oracle_id: string;
  name: string;
  name_normalized: string;
  layout: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  colors: CardColor[];
  color_identity: CardColor[];
  keywords: string[];
  rarity: string;
  set: string;
  set_name: string;
  collector_number: string;
  released_at: string;
  image_uris: CardImages;
  card_faces: CardFace[] | null;
  prices: CardPrice;
  edhrec_rank: number | null;
  scryfall_uri: string;
  /** Magic Online catalog id for the default printing. */
  mtgo_id: number | null;
  /** Most recent non-promo, non-digital printing (best default art). */
  default_printing_id: string;
  /** Earliest common printing with original art — used for metagame lists. */
  metagame_printing_id: string | null;
  printings_count: number;
  legalities: Legalities;
  updated_at: string;
}

export interface Printing {
  scryfall_id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  released_at: string;
  image_uris: CardImages;
  card_faces: PrintingFace[] | null;
  prices: CardPrice;
  finishes: string[];
  promo: boolean;
  digital: boolean;
  /** Magic Online catalog id, used by .dek exports. */
  mtgo_id: number | null;
  updated_at: string;
}

export interface CardSearchResult {
  oracle_id: string;
  scryfall_id: string;
  name: string;
  mana_cost: string;
  /** Per-face costs for split/adventure/DFC cards (empty for normal cards). */
  mana_costs: string[];
  mana_value: number;
  type_line: string;
  oracle_text: string;
  colors: CardColor[];
  color_identity: CardColor[];
  rarity: string;
  set_name: string;
  art_crop: string | null;
  image_normal: string | null;
  price_usd: number | null;
  pauper_legal: boolean;
}

export interface CardSearchResponse {
  cards: CardSearchResult[];
  total: number;
  page: number;
  page_size: number;
}

export function isPauperLegal(card: Pick<Card, "legalities">): boolean {
  return card.legalities?.pauper === "legal";
}
