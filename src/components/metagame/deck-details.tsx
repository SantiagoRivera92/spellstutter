"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy } from "lucide-react";
import type { MetagameDeck } from "@/lib/metagame/types";
import type { DeckView as DeckViewData } from "@/lib/decks/types";
import { cloneMetagameDeck } from "@/lib/decks/actions";
import { ColorPips } from "@/components/cards/color-pips";
import { DeckView } from "@/components/decks/deck-view";
import { Button } from "@/components/ui/button";

export function DeckDetails({
  deck,
  view,
}: {
  deck: MetagameDeck;
  view: DeckViewData;
}) {
  const router = useRouter();
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
        <Link
          href={`/events/${deck.event_slug}/decks/${encodeURIComponent(deck.player)}`}
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Open
        </Link>
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

      <DeckView view={view} />
    </details>
  );
}

