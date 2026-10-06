"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { DeckCardView, DeckView as DeckViewData } from "@/lib/decks/types";
import { compareDeckCards, groupByCategory } from "@/lib/decks/utils";
import { cn, formatUsd } from "@/lib/utils";
import { ManaCost } from "@/components/cards/mana-cost";
import { Select } from "@/components/ui/field";
import { DeckStatsPanel } from "./deck-stats";

type ViewMode = "text" | "compact" | "visual";

export function DeckView({ view }: { view: DeckViewData }) {
  const [mode, setMode] = React.useState<ViewMode>("text");
  const [preview, setPreview] = React.useState<DeckCardView | null>(null);
  const { cards, stats, deck } = view;

  const main = cards.filter((card) => card.board === "main");
  const side = cards.filter((card) => card.board === "side");
  const previewImage = preview?.image_normal ?? deck.cover_art_url ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          View
          <Select
            aria-label="Deck display mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as ViewMode)}
            className="h-9 w-auto"
          >
            <option value="text">Text</option>
            <option value="compact">Compact</option>
            <option value="visual">Visual</option>
          </Select>
        </label>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {cards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
              This deck has no cards yet. Open the editor to add cards.
            </div>
          ) : mode === "text" ? (
            <TextBoard main={main} side={side} onHover={setPreview} />
          ) : mode === "compact" ? (
            <CompactBoard main={main} side={side} onHover={setPreview} />
          ) : (
            <VisualBoard main={main} side={side} onHover={setPreview} />
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          {mode !== "visual" ? (
            <div className="mb-4 hidden aspect-[488/680] w-full overflow-hidden rounded-lg border border-border bg-muted lg:block">
              {previewImage ? (
                <Image
                  src={previewImage}
                  alt=""
                  width={488}
                  height={680}
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  Hover or focus a card to preview it here.
                </p>
              )}
            </div>
          ) : null}
          <h2 className="mb-3 font-display text-sm font-medium text-muted-foreground">
            Deck analysis
          </h2>
          <DeckStatsPanel stats={stats} />
        </aside>
      </div>
    </div>
  );
}

function BoardHeading({
  label,
  count,
  tone = "main",
}: {
  label: string;
  count: number;
  tone?: "main" | "sideboard";
}) {
  return (
    <h2
      className={cn(
        "mb-2 font-display text-sm font-medium",
        tone === "sideboard" ? "text-sideboard" : "text-muted-foreground",
      )}
    >
      {label} <span className="numeric font-sans text-xs">({count})</span>
    </h2>
  );
}

function sumQuantity(cards: DeckCardView[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function TextBoard({
  main,
  side,
  onHover,
}: {
  main: DeckCardView[];
  side: DeckCardView[];
  onHover: (card: DeckCardView) => void;
}) {
  const groups = groupByCategory(main);
  return (
    <div className="space-y-6">
      <div>
        <BoardHeading label="Mainboard" count={sumQuantity(main)} />
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h3 className="mb-1 font-display text-sm font-medium text-muted-foreground">
                {group.category}{" "}
                <span className="numeric font-sans text-xs">
                  ({sumQuantity(group.cards)})
                </span>
              </h3>
              <CardTable cards={group.cards} onHover={onHover} />
            </section>
          ))}
        </div>
      </div>
      {side.length ? (
        <section aria-label="Sideboard">
          <BoardHeading label="Sideboard" count={sumQuantity(side)} tone="sideboard" />
          <CardTable cards={side} onHover={onHover} />
        </section>
      ) : null}
    </div>
  );
}

function CompactBoard({
  main,
  side,
  onHover,
}: {
  main: DeckCardView[];
  side: DeckCardView[];
  onHover: (card: DeckCardView) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <BoardHeading label="Mainboard" count={sumQuantity(main)} />
        <CompactList cards={main} onHover={onHover} />
      </div>
      {side.length ? (
        <section aria-label="Sideboard">
          <BoardHeading label="Sideboard" count={sumQuantity(side)} tone="sideboard" />
          <CompactList cards={side} onHover={onHover} />
        </section>
      ) : null}
    </div>
  );
}

function CompactList({
  cards,
  onHover,
}: {
  cards: DeckCardView[];
  onHover: (card: DeckCardView) => void;
}) {
  // Sorted by type, then mana value — without printing the type headers.
  const sorted = [...cards].sort(compareDeckCards);
  // Fill the left column completely, then the right.
  const half = Math.ceil(sorted.length / 2);
  const columns = [sorted.slice(0, half), sorted.slice(half)];

  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {columns.map((column, columnIndex) => (
        <ul key={columnIndex}>
          {column.map((card) => (
            <li
              key={card.id}
              className="flex items-center gap-2 border-b border-border/60 py-1 text-sm"
              onMouseEnter={() => onHover(card)}
              onFocus={() => onHover(card)}
            >
              <span className="w-6 shrink-0 text-right numeric text-muted-foreground">
                {card.quantity}
              </span>
              {card.oracle_id ? (
                <Link
                  href={`/cards/${card.oracle_id}`}
                  className="min-w-0 flex-1 truncate underline-offset-4 hover:text-primary hover:underline"
                >
                  {card.card_name}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate">{card.card_name}</span>
              )}
              <ManaCost cost={card.mana_costs} size={14} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function VisualBoard({
  main,
  side,
  onHover,
}: {
  main: DeckCardView[];
  side: DeckCardView[];
  onHover: (card: DeckCardView) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <BoardHeading label="Mainboard" count={sumQuantity(main)} />
        <CardImageGrid cards={main} onHover={onHover} />
      </div>
      {side.length ? (
        <section aria-label="Sideboard">
          <BoardHeading label="Sideboard" count={sumQuantity(side)} tone="sideboard" />
          <CardImageGrid cards={side} onHover={onHover} />
        </section>
      ) : null}
    </div>
  );
}

function CardImageGrid({
  cards,
  onHover,
}: {
  cards: DeckCardView[];
  onHover: (card: DeckCardView) => void;
}) {
  const sorted = [...cards].sort(compareDeckCards);

  return (
    <ul className="grid grid-cols-4 gap-2 sm:gap-3">
      {sorted.map((card) => {
        const image = (
          <div className="relative aspect-[488/680] overflow-hidden rounded-lg border border-border bg-muted">
            {card.image_normal ? (
              <Image
                src={card.image_normal}
                alt=""
                fill
                sizes="(max-width: 1024px) 25vw, 200px"
                unoptimized
                className="object-cover"
              />
            ) : null}
            <span
              className="absolute right-1.5 top-1.5 min-w-6 rounded-md bg-ink-black-950/85 px-1.5 text-center text-xs font-semibold numeric text-ink-black-50"
              aria-hidden
            >
              {card.quantity}
            </span>
          </div>
        );

        return (
          <li
            key={card.id}
            className="group relative"
            onMouseEnter={() => onHover(card)}
            onFocus={() => onHover(card)}
          >
            {card.oracle_id ? (
              <Link
                href={`/cards/${card.oracle_id}`}
                aria-label={`${card.card_name}, ${card.quantity} ${card.quantity === 1 ? "copy" : "copies"}`}
                className="block"
              >
                {image}
              </Link>
            ) : (
              image
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CardTable({
  cards,
  onHover,
}: {
  cards: DeckCardView[];
  onHover: (card: DeckCardView) => void;
}) {
  const sorted = [...cards].sort(compareDeckCards);
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sr-only">
        <tr>
          <th scope="col">Quantity</th>
          <th scope="col">Card</th>
          <th scope="col">Price</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((card) => (
          <tr
            key={card.id}
            className="border-b border-border/60 border-l-2 border-l-transparent focus-within:border-l-primary hover:bg-muted/40"
            onMouseEnter={() => onHover(card)}
            onFocus={() => onHover(card)}
          >
            <td className="w-10 py-1.5 pr-2 text-right align-top numeric text-muted-foreground">
              {card.quantity}
            </td>
            <td className="py-1.5 pr-3 align-top">
              <span className="flex flex-wrap items-center gap-2">
                {card.oracle_id ? (
                  <Link
                    href={`/cards/${card.oracle_id}`}
                    className="font-medium underline-offset-4 hover:text-primary hover:underline"
                  >
                    {card.card_name}
                  </Link>
                ) : (
                  <span className="font-medium">{card.card_name}</span>
                )}
                <ManaCost cost={card.mana_costs} />
              </span>
            </td>
            <td className="hidden w-20 py-1.5 text-right align-top numeric text-xs text-muted-foreground md:table-cell">
              {formatUsd(card.price_usd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
