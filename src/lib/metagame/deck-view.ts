import "server-only";
import { getCardsByOracleIds, getPrintingsByIds } from "@/lib/cards/queries";
import type { Card, CardColor, Printing } from "@/lib/cards/types";
import type { Deck, DeckBoard } from "@/lib/supabase/types";
import type { DeckCardView, DeckView } from "@/lib/decks/types";
import { computeDeckStats, deriveCategory } from "@/lib/decks/utils";
import { formatDate } from "@/lib/utils";
import { getEventDeck } from "./queries";
import { frontFace } from "./card-type";
import type { MetagameCardEntry, MetagameDeck, MetagameEvent } from "./types";

export interface MetagameDeckView {
  event: MetagameEvent;
  deck: MetagameDeck;
  view: DeckView;
}

function cardImage(card: Card): string | null {
  return (
    card.image_uris.normal ??
    card.card_faces?.[0]?.image_uris.normal ??
    null
  );
}

function cardArt(card: Card): string | null {
  return (
    card.image_uris.art_crop ??
    card.card_faces?.[0]?.image_uris.art_crop ??
    null
  );
}

function printingImage(printing: Printing): string | null {
  return (
    printing.image_uris.normal ??
    printing.card_faces?.[0]?.image_uris.normal ??
    null
  );
}

function printingArt(printing: Printing): string | null {
  return (
    printing.image_uris.art_crop ??
    printing.card_faces?.[0]?.image_uris.art_crop ??
    null
  );
}

function toDeckCard(
  entry: MetagameCardEntry,
  board: DeckBoard,
  position: number,
  deck: MetagameDeck,
  byOracle: Map<string, Card>,
  byPrinting: Map<string, Printing>,
): DeckCardView {
  const details = entry.oracle_id ? byOracle.get(entry.oracle_id) : undefined;
  const printing = entry.printing_id
    ? byPrinting.get(entry.printing_id)
    : undefined;
  const typeLine = details?.type_line ?? entry.type_line ?? "";
  const faceCosts = (details?.card_faces ?? [])
    .map((face) => face.mana_cost)
    .filter(Boolean);
  const manaCost = details?.mana_cost ?? faceCosts[0] ?? "";
  const oracleId = entry.oracle_id ?? details?.oracle_id ?? "";

  return {
    id: `${deck.event_slug}:${deck.player}:${board}:${position}`,
    deck_id: `event:${deck.event_slug}`,
    oracle_id: oracleId,
    printing_id: entry.printing_id ?? null,
    card_name: details?.name ?? entry.name,
    quantity: entry.quantity,
    board,
    category: null,
    position,
    created_at: deck.event_date,
    updated_at: deck.scraped_at,
    mana_cost: manaCost,
    mana_costs: faceCosts.length ? faceCosts : manaCost ? [manaCost] : [],
    mana_value: details?.cmc ?? 0,
    type_line: typeLine ? frontFace(typeLine) : "",
    oracle_text: details?.oracle_text ?? "",
    rarity: printing?.rarity ?? details?.rarity ?? "common",
    mtgo_id: printing?.mtgo_id ?? details?.mtgo_id ?? null,
    colors: (details?.colors ?? entry.colors ?? []) as CardColor[],
    color_identity: (details?.color_identity ??
      entry.colors ??
      []) as CardColor[],
    art_crop:
      (printing ? printingArt(printing) : null) ??
      (details ? cardArt(details) : null),
    image_normal:
      (printing ? printingImage(printing) : null) ??
      entry.image ??
      (details ? cardImage(details) : null),
    price_usd: printing?.prices.usd ?? details?.prices.usd ?? null,
    category_group: typeLine ? deriveCategory(typeLine) : "Other",
  };
}

function deckDescription(deck: MetagameDeck): string {
  const parts = [
    deck.event_name,
    deck.event_date ? formatDate(deck.event_date) : null,
  ];
  if (deck.rank != null) parts.push(`Rank ${deck.rank}`);
  if (deck.wins != null && deck.losses != null) {
    parts.push(
      `Record ${deck.wins}-${deck.losses}${
        deck.draws ? `-${deck.draws}` : ""
      }`,
    );
  }
  return parts.filter(Boolean).join(" · ");
}

function buildDeckView(
  deck: MetagameDeck,
  byOracle: Map<string, Card>,
  byPrinting: Map<string, Printing>,
): DeckView {
  const entries = [
    ...deck.mainboard.map((entry, index) => ({
      entry,
      board: "main" as const,
      position: index,
    })),
    ...deck.sideboard.map((entry, index) => ({
      entry,
      board: "side" as const,
      position: deck.mainboard.length + index,
    })),
  ];

  const deckCards = entries.map(({ entry, board, position }) =>
    toDeckCard(entry, board, position, deck, byOracle, byPrinting),
  );
  const cover = deckCards.find(
    (card) => card.board === "main" && card.art_crop,
  )?.art_crop;

  const viewDeck: Deck = {
    id: `event:${deck.event_slug}:${deck.player}`,
    user_id: "",
    folder_id: null,
    name: `${deck.player} — ${deck.archetype.name}`,
    description: deckDescription(deck),
    format: "pauper",
    visibility: "public",
    archetype_slug: deck.archetype.slug,
    cover_oracle_id: null,
    cover_printing_id: null,
    cover_art_url: cover ?? null,
    created_at: deck.event_date,
    updated_at: deck.scraped_at,
  };

  return {
    deck: viewDeck,
    cards: deckCards,
    stats: computeDeckStats(deckCards),
  };
}

/**
 * Build full DeckView data for a batch of stored metagame decks, resolving the
 * card catalog in one pair of queries so listings can render the same board as
 * the deck viewer.
 */
export async function getMetagameDeckViews(
  decks: MetagameDeck[],
): Promise<DeckView[]> {
  if (!decks.length) return [];

  const oracleIds = [
    ...new Set(
      decks.flatMap((deck) =>
        [...deck.mainboard, ...deck.sideboard].map((entry) => entry.oracle_id),
      ),
    ),
  ].filter((id): id is string => Boolean(id));
  const printingIds = [
    ...new Set(
      decks.flatMap((deck) =>
        [...deck.mainboard, ...deck.sideboard].map(
          (entry) => entry.printing_id,
        ),
      ),
    ),
  ].filter((id): id is string => Boolean(id));

  const [cards, printings] = await Promise.all([
    getCardsByOracleIds(oracleIds).catch(() => []),
    getPrintingsByIds(printingIds).catch(() => []),
  ]);
  const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));
  const byPrinting = new Map(
    printings.map((printing) => [printing.scryfall_id, printing]),
  );

  return decks.map((deck) => buildDeckView(deck, byOracle, byPrinting));
}

export async function getMetagameDeckView(
  eventSlug: string,
  player: string,
): Promise<MetagameDeckView | null> {
  const result = await getEventDeck(eventSlug, player);
  if (!result) return null;

  const { event, deck } = result;
  const [view] = await getMetagameDeckViews([deck]);
  return { event, deck, view };
}
