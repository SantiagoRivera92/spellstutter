import type { CardColor } from "@/lib/cards/types";

export type MetagameEventType =
  | "league"
  | "challenge"
  | "preliminary"
  | "showcase"
  | "qualifier"
  | "other";

export interface MetagameCardEntry {
  name: string;
  quantity: number;
  /** Resolved from the card catalog at scrape time. */
  oracle_id: string | null;
  /** Earliest common printing (original art). */
  printing_id: string | null;
  /** Card type line, for grouping the decklist. */
  type_line?: string | null;
  /** Card image (normal size), for the hover preview. */
  image?: string | null;
  /** Colours the card contributes to identity (hybrid/Phyrexian excluded). */
  colors?: CardColor[];
}

export interface ArchetypeCardStat {
  oracle_id: string | null;
  name: string;
  decks: number;
  include_rate: number;
  avg_qty: number;
  min_qty: number;
  max_qty: number;
}

export interface ArchetypeBreakdown {
  slug: string;
  name: string;
  decks: number;
  average_main_size: number;
  average_side_size: number;
  main: ArchetypeCardStat[];
  side: ArchetypeCardStat[];
}

export interface ArchetypeOption {
  slug: string;
  name: string;
  decks: number;
}

export interface MetagameEvent {
  slug: string;
  name: string;
  event_type: MetagameEventType;
  date: string;
  url: string;
  player_count: number;
  deck_count: number;
  scraped_at: string;
}

export interface MetagameDeck {
  event_slug: string;
  event_name: string;
  event_type: MetagameEventType;
  event_date: string;
  player: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  color_identity: CardColor[];
  mainboard: MetagameCardEntry[];
  sideboard: MetagameCardEntry[];
  archetype: {
    slug: string;
    name: string;
    confidence: number;
  };
  classification_version: string;
  scraped_at: string;
}

export interface ArchetypeStat {
  slug: string;
  name: string;
  decks: number;
  meta_share: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  average_rank: number | null;
  color_identity: CardColor[];
  top_cards: { name: string; count: number }[];
}

export interface MetagameSummary {
  events: number;
  decks: number;
  since: string | null;
  archetypes: ArchetypeStat[];
}
