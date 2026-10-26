"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy } from "lucide-react";
import type { MetagameCardEntry, MetagameDeck } from "@/lib/metagame/types";
import { CATEGORY_ORDER, categoryFor } from "@/lib/metagame/card-type";
import { cloneMetagameDeck } from "@/lib/decks/actions";
import { ColorPips } from "@/components/cards/color-pips";
import { Button } from "@/components/ui/button";

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 279;

export function DeckDetails({ deck }: { deck: MetagameDeck }) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<MetagameCardEntry | null>(null);
  const [cloning, startClone] = React.useTransition();
  const [cloneError, setCloneError] = React.useState<string | null>(null);

  const mainCount = deck.mainboard.reduce((sum, card) => sum + card.quantity, 0);
  const sideCount = deck.sideboard.reduce((sum, card) => sum + card.quantity, 0);

  function cloneDeck() {
    setCloneError(null);
    startClone(async () => {
      const result = await cloneMetagameDeck({
        eventSlug: deck.event_slug,
        player: deck.player,
      });
      if (result.ok && result.deckId) {
        router.push(`/decks/${result.deckId}/edit`);
        return;
      }
      if (!result.ok) {
        if (result.error === "unauthenticated") {
          router.push(
            `/login?next=${encodeURIComponent(`/events/${deck.event_slug}`)}`,
          );
        } else if (result.error === "migration_required") {
          setCloneError("The database is missing the latest migration.");
        } else {
          setCloneError("Could not clone this deck.");
        }
      }
    });
  }

  return (
    <details className="group border-b border-border/60 last:border-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 hover:bg-muted/40">
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-90"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {deck.player}
        </span>
        <ColorPips colors={deck.color_identity} size={14} label={false} />
        <span className="text-xs text-muted-foreground">
          {deck.archetype.name}
        </span>
        <span className="numeric text-xs text-muted-foreground">
          {mainCount}/{sideCount}
        </span>
        {deck.rank != null ? (
          <span className="numeric text-xs text-muted-foreground">
            Rank {deck.rank}
          </span>
        ) : null}
        {deck.wins != null && deck.losses != null ? (
          <span
            className="numeric text-xs text-muted-foreground"
            title="Match record (wins-losses-draws); byes excluded when known"
          >
            {deck.wins}-{deck.losses}
            {deck.draws ? `-${deck.draws}` : ""}
            {deck.byes ? ` · ${deck.byes} bye` : ""}
          </span>
        ) : deck.wins != null ? (
          <span className="numeric text-xs text-muted-foreground">
            {deck.wins} wins
          </span>
        ) : null}
      </summary>

      <div className="px-3 pb-4 pt-1">
        <div className="mb-3 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={cloneDeck}
            disabled={cloning}
          >
            <Copy className="size-3.5" aria-hidden />
            {cloning ? "Cloning…" : "Clone to my decks"}
          </Button>
          {cloneError ? (
            <span role="alert" className="text-xs text-destructive">
              {cloneError}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 px-3 pb-4 pt-1 sm:grid-cols-2">
        <MainDeck cards={deck.mainboard} count={mainCount} onHover={setPreview} />

        <div>
          <Sideboard cards={deck.sideboard} count={sideCount} onHover={setPreview} />

          {/* Fixed preview slot, below the sideboard. */}
          <div className="mt-4 flex min-h-[18.5rem] items-start justify-center rounded-lg border border-dashed border-border bg-card/50 p-3">
            {preview?.image ? (
              <Image
                src={preview.image}
                alt=""
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                unoptimized
                className="rounded-md border border-border"
              />
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}

function MainDeck({
  cards,
  count,
  onHover,
}: {
  cards: MetagameCardEntry[];
  count: number;
  onHover: (entry: MetagameCardEntry) => void;
}) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    cards: cards.filter((card) => categoryFor(card.type_line) === category),
  })).filter((group) => group.cards.length > 0);

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Main deck <span className="numeric">({count})</span>
      </h3>
      <div className="mt-1.5 space-y-2.5">
        {groups.map((group) => (
          <div key={group.category}>
            <h4 className="text-[11px] font-medium text-muted-foreground/80">
              {group.category}{" "}
              <span className="numeric">
                ({group.cards.reduce((sum, card) => sum + card.quantity, 0)})
              </span>
            </h4>
            <CardList cards={group.cards} onHover={onHover} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Sideboard({
  cards,
  count,
  onHover,
}: {
  cards: MetagameCardEntry[];
  count: number;
  onHover: (entry: MetagameCardEntry) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sideboard <span className="numeric">({count})</span>
      </h3>
      {cards.length ? (
        <CardList className="mt-1.5" cards={cards} onHover={onHover} />
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">No sideboard.</p>
      )}
    </div>
  );
}

function CardList({
  cards,
  onHover,
  className,
}: {
  cards: MetagameCardEntry[];
  onHover: (entry: MetagameCardEntry) => void;
  className?: string;
}) {
  return (
    <ul className={`space-y-0.5 text-sm ${className ?? ""}`}>
      {[...cards]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((card) => (
          <li key={card.name} className="flex gap-2">
            <span className="w-6 shrink-0 text-right numeric text-muted-foreground">
              {card.quantity}
            </span>
            <CardNameLink card={card} onHover={onHover} />
          </li>
        ))}
    </ul>
  );
}

function CardNameLink({
  card,
  onHover,
}: {
  card: MetagameCardEntry;
  onHover: (entry: MetagameCardEntry) => void;
}) {
  if (!card.oracle_id) {
    return <span className="min-w-0">{card.name}</span>;
  }

  return (
    <Link
      href={`/cards/${card.oracle_id}`}
      className="min-w-0 rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline"
      onMouseEnter={() => onHover(card)}
      onFocus={() => onHover(card)}
    >
      {card.name}
    </Link>
  );
}
