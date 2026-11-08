import type { DeckCardView } from "@/lib/decks/types";
import { deckBuyLinks } from "@/lib/monetization/affiliate";

export function BuyDeckLinks({ cards }: { cards: DeckCardView[] }) {
  const links = deckBuyLinks(cards);
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-ink-black-200">Buy this deck:</span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="rounded-md border border-ink-black-600 px-2.5 py-1 font-medium text-ink-black-50 transition-colors duration-150 hover:border-primary hover:text-primary"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
