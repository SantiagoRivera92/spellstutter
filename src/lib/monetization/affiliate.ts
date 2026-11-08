import "server-only";
import type { DeckCardView } from "@/lib/decks/types";
import { isAffiliateEnabled } from "./flags";

export interface BuyLink {
  label: string;
  href: string;
}

type BuyableCard = Pick<DeckCardView, "card_name" | "quantity" | "board">;

function partnerUrl(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function cardList(cards: BuyableCard[]): string {
  return cards
    .map((card) => `${card.quantity} ${card.card_name}`)
    .join("\n");
}

/**
 * Affiliate links for a deck. Tags and templates stay server-side; only the
 * finished URLs are passed to client components.
 */
export function deckBuyLinks(cards: BuyableCard[]): BuyLink[] {
  if (!isAffiliateEnabled() || !cards.length) return [];

  const links: BuyLink[] = [];
  const tcgplayer = partnerUrl("AFFILIATE_TCGPLAYER_URL");
  const template = partnerUrl("AFFILIATE_DECK_BUY_URL_TEMPLATE");
  if (tcgplayer) {
    const href = template
      ? template.replace("{cards}", encodeURIComponent(cardList(cards)))
      : tcgplayer;
    links.push({ label: "TCGplayer", href });
  }

  const manapool = partnerUrl("AFFILIATE_MANAPOOL_URL");
  if (manapool) links.push({ label: "ManaPool", href: manapool });

  const cardKingdom = partnerUrl("AFFILIATE_CARDKINGDOM_URL");
  if (cardKingdom) links.push({ label: "Card Kingdom", href: cardKingdom });

  return links;
}

export function affiliateDisclosure(): string | null {
  if (!isAffiliateEnabled()) return null;
  const hasLink =
    partnerUrl("AFFILIATE_TCGPLAYER_URL") ||
    partnerUrl("AFFILIATE_MANAPOOL_URL") ||
    partnerUrl("AFFILIATE_CARDKINGDOM_URL");
  if (!hasLink) return null;
  return "Some card and deck links are affiliate links. We may earn a commission at no extra cost to you.";
}
