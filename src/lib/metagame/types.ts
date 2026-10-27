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
  /** Colors the card contributes to identity (hybrid/Phyrexian excluded). */
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
  /** Melee decklist id, used to join pairings back to this deck. */
  decklist_id?: string | null;
  /** Melee team id, used when a pairing omits the decklist id. */
  melee_team_id?: number | null;
  /** Match draws and byes, when reported separately from wins/losses. */
  draws?: number | null;
  byes?: number | null;
  /** Where wins/losses came from. Melee uses pairings when available. */
  record_source?: "standings" | "pairings";
  /** Official standings record, retained when pairings override it. */
  standings_wins?: number | null;
  standings_losses?: number | null;
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

/** One side of a round pairing, stored from that player's perspective. */
export interface MatchRecord {
  event_slug: string;
  event_name: string;
  event_date: string;
  round_id: string;
  round_number: number;
  round_name: string;
  match_id: string;
  table_number: number | null;
  player: string;
  player_team_id: number | null;
  player_decklist_id: string | null;
  player_archetype: { slug: string; name: string } | null;
  opponent: string | null;
  opponent_team_id: number | null;
  opponent_decklist_id: string | null;
  opponent_archetype: { slug: string; name: string } | null;
  result: "win" | "loss" | "draw" | "bye" | "unknown";
  game_wins: number;
  game_losses: number;
  game_draws: number;
  source: "melee" | "cardsrealm";
  scraped_at: string;
}

/** A Melee pairing row. */
export type MeleeMatchRecord = MatchRecord & { source: "melee" };

/** A Cardsrealm pairing row. */
export type CardsrealmMatchRecord = MatchRecord & { source: "cardsrealm" };

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

/** A card in an endstep archetype's canonical sample list. */
export interface EndstepSampleCard {
  name: string;
  count: number;
  /** Resolved from the card catalog at sync time (null if unmatched). */
  oracle_id?: string | null;
  printing_id?: string | null;
}

/** Per-card inclusion statistics for an endstep archetype. */
export interface EndstepCardStat {
  name: string;
  average_copies: number;
  play_rate: number;
  count: number;
  of: number;
}

/**
 * An endstep.cc metagame archetype: its canonical sample decklist plus the
 * aggregate statistics endstep reports for the archetype. Used as a
 * deckbuilding source (seed lists, average composition) rather than for
 * match results.
 */
export interface EndstepArchetype {
  format_id: string;
  slug: string;
  endstep_id: string;
  name: string;
  machine_named: boolean;
  colours: CardColor[];
  key_cards: string[];
  art: { card_name: string | null } | null;
  share_rate: number | null;
  registrations: number;
  players: number;
  match_win_rate: number | null;
  sample_list: { main: EndstepSampleCard[]; side: EndstepSampleCard[] };
  cards_main: EndstepCardStat[];
  cards_side: EndstepCardStat[];
  texture: { average_turns: number | null; mulligan_rate: number | null } | null;
  window: { preset: string; from: string; to: string };
  derivation_version: number | null;
  source: "endstep";
  fetched_at: string;
}

/**
 * A single matchup record for an endstep archetype.
 *
 * endstep returns the opponent as a nested object; the sync flattens it to the
 * `opponent_*` fields below so consumers do not depend on the raw API shape.
 */
export interface EndstepMatchup {
  opponent_id: string;
  opponent_slug: string;
  opponent_name: string;
  wins: number;
  losses: number;
  matches: number;
  rate: number | null; // win rate (0-1); null when endstep gates the sample
  low: number | null; // lower bound confidence interval
  high: number | null; // upper bound confidence interval
  deff: number | null; // degree of dominance
}

/** Matchup data stored per-archetype per-sync run. */
export interface EndstepMatchupRecord {
  format_id: string;
  archetype_slug: string;
  opponent_slug: string;
  window: string;
  population: string;
  share_rate_at_sync: number | null;
  fetched_at: string;
  match: EndstepMatchup;
}

/** One source's contribution to a combined matchup row. */
export interface MatchupSourceRecord {
  wins: number;
  losses: number;
  draws: number;
  matches: number;
}

/**
 * A matchup row that may combine exact Melee and Cardsrealm archetypes with
 * optional endstep data.
 *
 * endstep groups some variants (for example every Affinity colour) under one
 * archetype, so an endstep row is marked `scope: "group"` unless its slug maps
 * back to exactly one app archetype. Melee and Cardsrealm rows always use
 * exact app slugs.
 */
export interface CombinedMatchup {
  opponent_slug: string;
  opponent_name: string;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  win_rate: number | null;
  melee: MatchupSourceRecord;
  cardsrealm: MatchupSourceRecord;
  endstep: MatchupSourceRecord;
  scope: "exact" | "group";
  endstep_opponent_slug: string | null;
  melee_opponent_slugs: string[];
}

/** An endstep archetype with its matchup data. */
export interface EndstepArchetypeWithMatchups extends EndstepArchetype {
  matchups: EndstepMatchup[];
}

/** Lightweight endstep archetype for pickers and grids. */
export interface EndstepArchetypeOption {
  slug: string;
  name: string;
  colours: CardColor[];
  key_cards: string[];
  share_rate: number | null;
  players: number;
  art: { card_name: string | null } | null;
}
