import "server-only";
import type { DeckCardView } from "@/lib/decks/types";
import { isAffiliateEnabled } from "./flags";

export interface BuyLink {
  label: string;
  href: string;
}

type BuyableCard = Pick<
  DeckCardView,
  "card_name" | "quantity" | "board" | "tcgplayer_product_id"
>;

function partnerUrl(name: string): string | null {
  return process.env[name]?.trim() || null;
}

/** TCGplayer Mass Entry accepts `qty-productId` lines when IDs are known. */
function massEntryLines(cards: BuyableCard[]): string {
  if (cards.every((card) => card.tcgplayer_product_id != null)) {
    return cards
      .map((card) => `${card.quantity}-${card.tcgplayer_product_id}`)
      .join("\n");
  }
  return cards.map((card) => `${card.quantity} ${card.card_name}`).join("\n");
}

export function tcgplayerMassEntryUrl(cards: BuyableCard[]): string {
  return `https://www.tcgplayer.com/massentry?productline=Magic&c=${encodeURIComponent(
    massEntryLines(cards),
  )}`;
}

/**
 * TCGplayer's Impact partner links accept a `u` parameter with the destination
 * URL. Other affiliate URLs are left alone.
 */
function wrapTcgplayerAffiliate(destination: string): string | null {
  const base = partnerUrl("AFFILIATE_TCGPLAYER_URL");
  if (!base) return null;
  try {
    const url = new URL(base);
    if (
      url.hostname === "partner.tcgplayer.com" ||
      url.hostname.endsWith(".partner.tcgplayer.com")
    ) {
      url.searchParams.set("u", destination);
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
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

  if (tcgplayer || template) {
    const massEntry = tcgplayerMassEntryUrl(cards);
    let href: string;
    if (template) {
      const ids = cards
        .filter((card) => card.tcgplayer_product_id != null)
        .map((card) => `${card.quantity}-${card.tcgplayer_product_id}`)
        .join("\n");
      href = template
        .replace("{cards}", encodeURIComponent(massEntryLines(cards)))
        .replace("{ids}", encodeURIComponent(ids));
    } else {
      href = wrapTcgplayerAffiliate(massEntry) ?? massEntry;
    }
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
