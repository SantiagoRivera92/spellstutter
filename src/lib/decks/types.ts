import type { CardColor } from "@/lib/cards/types";
import type { Deck, DeckBoard, DeckCard, DeckVisibility } from "@/lib/supabase/types";

export type CardCategory =
  | "Creature"
  | "Instant"
  | "Sorcery"
  | "Enchantment"
  | "Artifact"
  | "Planeswalker"
  | "Land"
  | "Battle"
  | "Other";

export interface DeckCardView extends DeckCard {
  mana_cost: string;
  /** Per-face costs for split/adventure/DFC cards (empty for normal cards). */
  mana_costs: string[];
  mana_value: number;
  type_line: string;
  oracle_text: string;
  rarity: string;
  /** Magic Online catalog id of the chosen printing (for .dek export). */
  mtgo_id: number | null;
  colors: CardColor[];
  color_identity: CardColor[];
  art_crop: string | null;
  image_normal: string | null;
  price_usd: number | null;
  category_group: CardCategory;
}

export interface DeckStats {
  main_count: number;
  side_count: number;
  total_count: number;
  average_mana_value: number;
  total_price: number;
  curve: { bucket: string; count: number }[];
  color_counts: { color: CardColor; count: number }[];
}

export interface DeckView {
  deck: Deck;
  cards: DeckCardView[];
  stats: DeckStats;
}

export interface DeckSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: DeckVisibility;
  folder_id: string | null;
  cover_art_url: string | null;
  updated_at: string;
  card_count: number;
  color_identity: CardColor[];
}

export type { Deck, DeckBoard, DeckCard, DeckVisibility };
