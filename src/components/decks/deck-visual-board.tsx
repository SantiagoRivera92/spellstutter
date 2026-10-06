"use client";

import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { DeckCardView } from "@/lib/decks/types";
import { groupByCategory } from "@/lib/decks/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EditableBoard = "main" | "side";

/**
 * Image-grid board for the deck editor's visual mode. Same drag-and-drop
 * targets as the list board, with per-tile quantity and remove controls that
 * appear on hover.
 */
export function DeckVisualBoard({
  title,
  count,
  board,
  cards,
  active,
  onDrop,
  onDragOver,
  onHover,
  onQuantity,
  onRemove,
}: {
  title: string;
  count: number;
  board: EditableBoard;
  cards: DeckCardView[];
  active: boolean;
  onDrop: (event: React.DragEvent, board: EditableBoard) => void;
  onDragOver: (board: EditableBoard | null) => void;
  onHover: (card: DeckCardView | null) => void;
  onQuantity: (card: DeckCardView, quantity: number) => void;
  onRemove: (card: DeckCardView) => void;
}) {
  const groups = groupByCategory(cards);

  return (
    <section
      aria-label={title}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(board);
      }}
      onDragLeave={() => onDragOver(null)}
      onDrop={(event) => onDrop(event, board)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "rounded-lg border bg-card transition-colors duration-150",
        active ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2
          className={cn(
            "font-display text-sm font-medium",
            board === "side" && "text-sideboard",
          )}
        >
          {title}
        </h2>
        <span className="numeric text-xs text-muted-foreground">
          {count} card{count === 1 ? "" : "s"}
        </span>
      </div>

      {cards.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Drag cards here to fill the {title.toLowerCase()}.
        </p>
      ) : (
        <div className="space-y-4 p-3">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.category} ·{" "}
                {group.cards.reduce((sum, card) => sum + card.quantity, 0)}
              </h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                {group.cards.map((card) => (
                  <li
                    key={card.id}
                    className="group/tile relative"
                    onMouseEnter={() => onHover(card)}
                  >
                    <div className="relative aspect-[488/680] overflow-hidden rounded-lg border border-border bg-muted">
                      {card.image_normal ? (
                        <Image
                          src={card.image_normal}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 30vw, (max-width: 1280px) 18vw, 150px"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                          {card.card_name}
                        </span>
                      )}
                      <span
                        className="absolute right-1.5 top-1.5 min-w-6 rounded-md bg-ink-black-950/85 px-1.5 text-center text-xs font-semibold numeric text-ink-black-50"
                        aria-hidden
                      >
                        {card.quantity}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink-black-950/80 p-1 opacity-0 transition-opacity duration-150 group-hover/tile:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-ink-black-50 hover:bg-ink-black-50/20 hover:text-ink-black-50"
                          aria-label={`Decrease ${card.card_name}`}
                          onClick={() => onQuantity(card, card.quantity - 1)}
                        >
                          <Minus className="size-3" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-ink-black-50 hover:bg-ink-black-50/20 hover:text-ink-black-50"
                          aria-label={`Increase ${card.card_name}`}
                          onClick={() => onQuantity(card, card.quantity + 1)}
                        >
                          <Plus className="size-3" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-ink-black-50 hover:bg-destructive/80 hover:text-destructive-foreground"
                          aria-label={`Remove ${card.card_name}`}
                          onClick={() => onRemove(card)}
                        >
                          <Trash2 className="size-3" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <p
                      className="mt-1 truncate text-xs text-muted-foreground"
                      title={card.card_name}
                    >
                      {card.card_name}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
