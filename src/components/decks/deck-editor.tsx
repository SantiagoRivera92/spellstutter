"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowLeftRight,
  Layers,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import type { CardSearchResult, Printing } from "@/lib/cards/types";
import type { DeckCardView, DeckView } from "@/lib/decks/types";
import type { DeckBoard, DeckCard } from "@/lib/supabase/types";
import {
  addDeckCard,
  importDecklist,
  removeDeckCard,
  updateDeckCard,
  type ActionResult,
} from "@/lib/decks/actions";
import { computeDeckStats, deriveCategory, groupByCategory } from "@/lib/decks/utils";
import { cn, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ManaCost } from "@/components/cards/mana-cost";
import { CardSearch } from "@/components/cards/card-search";
import { DeckStatsPanel } from "./deck-stats";
import { DeckVisualBoard } from "./deck-visual-board";
import { PrintingPickerDialog } from "./printing-picker-dialog";

interface DeckEditorProps {
  view: DeckView;
  username: string;
}

type Board = Extract<DeckBoard, "main" | "side">;

/** Minimal shape the preview panel needs, from a search result or deck card. */
interface PreviewCard {
  name: string;
  image_normal: string | null;
  mana_costs: string[];
  type_line: string;
  oracle_text: string;
}

export function DeckEditor({ view, username }: DeckEditorProps) {
  const router = useRouter();
  const [cards, setCards] = React.useState<DeckCardView[]>(view.cards);
  const [syncedFrom, setSyncedFrom] = React.useState<DeckCardView[]>(view.cards);
  const [selected, setSelected] = React.useState<CardSearchResult | null>(null);
  const [hovered, setHovered] = React.useState<DeckCardView | null>(null);
  const [mode, setMode] = React.useState<"list" | "visual">("list");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [dropBoard, setDropBoard] = React.useState<Board | null>(null);
  const [printingFor, setPrintingFor] = React.useState<DeckCardView | null>(
    null,
  );
  const [pending, startTransition] = React.useTransition();

  // Replace optimistic state whenever the server sends a fresh card list.
  if (view.cards !== syncedFrom) {
    setSyncedFrom(view.cards);
    setCards(view.cards);
  }

  const stats = React.useMemo(() => computeDeckStats(cards), [cards]);
  const main = cards.filter((card) => card.board === "main");
  const side = cards.filter((card) => card.board === "side");

  // A hovered deck card takes over the preview; otherwise show the search
  // result the user last selected.
  const preview: PreviewCard | null = hovered
    ? {
        name: hovered.card_name,
        image_normal: hovered.image_normal,
        mana_costs: hovered.mana_costs,
        type_line: hovered.type_line,
        oracle_text: hovered.oracle_text,
      }
    : selected;

  function report(result: ActionResult) {
    if (result.ok) {
      if (result.report) {
        const skipped = result.report.skipped;
        setNotice(
          skipped.length
            ? `Imported ${result.report.added} cards. Skipped (not Pauper-legal or unknown): ${skipped.join(", ")}.`
            : `Imported ${result.report.added} cards.`,
        );
      } else {
        setNotice(null);
      }
      setError(null);
      startTransition(() => router.refresh());
    } else {
      setError(errorText(result.error));
    }
  }

  function handleAdd(card: CardSearchResult, board: Board) {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await addDeckCard({
        deckId: view.deck.id,
        oracleId: card.oracle_id,
        cardName: card.name,
        board,
        quantity: 1,
      });
      if (result.ok && result.card) {
        setCards((current) => mergeServerCard(current, result.card!, card));
      }
      report(result);
    });
  }

  function handleQuantity(card: DeckCardView, quantity: number) {
    setCards((current) =>
      quantity <= 0
        ? current.filter((entry) => entry.id !== card.id)
        : current.map((entry) =>
            entry.id === card.id ? { ...entry, quantity } : entry,
          ),
    );
    startTransition(async () => {
      const result = await updateDeckCard({
        deckId: view.deck.id,
        cardId: card.id,
        quantity,
      });
      report(result);
    });
  }

  function handleRemove(card: DeckCardView) {
    setCards((current) => current.filter((entry) => entry.id !== card.id));
    startTransition(async () => {
      const result = await removeDeckCard({
        deckId: view.deck.id,
        cardId: card.id,
      });
      report(result);
    });
  }

  function handlePrinting(card: DeckCardView, printing: Printing) {
    setCards((current) =>
      current.map((entry) =>
        entry.id === card.id
          ? { ...entry, printing_id: printing.scryfall_id }
          : entry,
      ),
    );
    setPrintingFor(null);
    startTransition(async () => {
      const result = await updateDeckCard({
        deckId: view.deck.id,
        cardId: card.id,
        printingId: printing.scryfall_id,
      });
      report(result);
    });
  }

  function handleMove(card: DeckCardView) {
    const board: Board = card.board === "main" ? "side" : "main";
    setCards((current) =>
      current.map((entry) =>
        entry.id === card.id ? { ...entry, board } : entry,
      ),
    );
    startTransition(async () => {
      const result = await updateDeckCard({
        deckId: view.deck.id,
        cardId: card.id,
        board,
      });
      report(result);
    });
  }

  function handleDrop(event: React.DragEvent, board: Board) {
    event.preventDefault();
    setDropBoard(null);

    const payload = event.dataTransfer.getData("application/x-spellstutter-card");
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as {
          oracle_id: string;
          name: string;
          mana_cost: string;
        };
        handleAdd(
          {
            oracle_id: parsed.oracle_id,
            scryfall_id: "",
            name: parsed.name,
            mana_cost: parsed.mana_cost,
            mana_costs: parsed.mana_cost ? [parsed.mana_cost] : [],
            mana_value: 0,
            type_line: "",
            oracle_text: "",
            colors: [],
            color_identity: [],
            rarity: "common",
            set_name: "",
            art_crop: null,
            image_normal: null,
            price_usd: null,
            pauper_legal: true,
          },
          board,
        );
      } catch {
        setError("That drag could not be read.");
      }
      return;
    }

    const text = event.dataTransfer.getData("text/plain");
    if (text) {
      startTransition(async () => {
        report(
          await importDecklist({
            deckId: view.deck.id,
            text,
            board,
            mode: "add",
          }),
        );
      });
    }
  }

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Link
          href={`/decks/${view.deck.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Deck view
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold">
            {view.deck.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Brewing as @{username}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm numeric text-muted-foreground">
            {stats.main_count}/60 main · {stats.side_count} side
          </p>
          <div
            role="group"
            aria-label="Board display mode"
            className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
          >
            <Button
              variant={mode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              aria-pressed={mode === "list"}
              aria-label="List view"
              onClick={() => setMode("list")}
            >
              <List className="size-4" aria-hidden />
            </Button>
            <Button
              variant={mode === "visual" ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              aria-pressed={mode === "visual"}
              aria-label="Visual view"
              onClick={() => setMode("visual")}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm text-foreground"
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_19rem]">
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <CardSearch
            draggable
            pauperOnly
            onAddCard={(card) => handleAdd(card, "main")}
            onSelectCard={setSelected}
            emptyHint="Drag a result onto a board, or press + to add it to the main deck."
            className="h-full"
          />
        </div>

        <div className="min-w-0 space-y-5">
          {mode === "visual" ? (
            <>
              <DeckVisualBoard
                title="Main deck"
                count={stats.main_count}
                board="main"
                cards={main}
                active={dropBoard === "main"}
                onDrop={handleDrop}
                onDragOver={setDropBoard}
                onHover={setHovered}
                onQuantity={handleQuantity}
                onRemove={handleRemove}
              />
              <DeckVisualBoard
                title="Sideboard"
                count={stats.side_count}
                board="side"
                cards={side}
                active={dropBoard === "side"}
                onDrop={handleDrop}
                onDragOver={setDropBoard}
                onHover={setHovered}
                onQuantity={handleQuantity}
                onRemove={handleRemove}
              />
            </>
          ) : (
            <>
              <Board
                title="Main deck"
                count={stats.main_count}
                board="main"
                cards={main}
                active={dropBoard === "main"}
                onDrop={handleDrop}
                onDragOver={setDropBoard}
                onHover={setHovered}
                onQuantity={handleQuantity}
                onRemove={handleRemove}
                onMove={handleMove}
                onPrinting={setPrintingFor}
              />
              <Board
                title="Sideboard"
                count={stats.side_count}
                board="side"
                cards={side}
                active={dropBoard === "side"}
                onDrop={handleDrop}
                onDragOver={setDropBoard}
                onHover={setHovered}
                onQuantity={handleQuantity}
                onRemove={handleRemove}
                onMove={handleMove}
                onPrinting={setPrintingFor}
              />
            </>
          )}
        </div>

        <aside className="space-y-5 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:self-start">
          <CardPreview card={preview} />
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-sm font-medium">Live stats</h2>
            <DeckStatsPanel stats={stats} />
          </div>
        </aside>
      </div>

      {printingFor ? (
        <PrintingPickerDialog
          oracleId={printingFor.oracle_id}
          cardName={printingFor.card_name}
          currentPrintingId={printingFor.printing_id}
          pending={pending}
          onClose={() => setPrintingFor(null)}
          onSelect={(printing) => handlePrinting(printingFor, printing)}
        />
      ) : null}
    </div>
  );
}

function Board({
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
  onMove,
  onPrinting,
}: {
  title: string;
  count: number;
  board: Board;
  cards: DeckCardView[];
  active: boolean;
  onDrop: (event: React.DragEvent, board: Board) => void;
  onDragOver: (board: Board | null) => void;
  onHover: (card: DeckCardView | null) => void;
  onQuantity: (card: DeckCardView, quantity: number) => void;
  onRemove: (card: DeckCardView) => void;
  onMove: (card: DeckCardView) => void;
  onPrinting: (card: DeckCardView) => void;
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
        <div className="divide-y divide-border">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="bg-muted/40 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.category} ·{" "}
                {group.cards.reduce((sum, card) => sum + card.quantity, 0)}
              </h3>
              <ul>
                {group.cards.map((card) => (
                  <EditorCardRow
                    key={card.id}
                    card={card}
                    onHover={onHover}
                    onQuantity={onQuantity}
                    onRemove={onRemove}
                    onMove={onMove}
                    onPrinting={onPrinting}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EditorCardRow({
  card,
  onHover,
  onQuantity,
  onRemove,
  onMove,
  onPrinting,
}: {
  card: DeckCardView;
  onHover: (card: DeckCardView) => void;
  onQuantity: (card: DeckCardView, quantity: number) => void;
  onRemove: (card: DeckCardView) => void;
  onMove: (card: DeckCardView) => void;
  onPrinting: (card: DeckCardView) => void;
}) {
  return (
    <li
      className="group flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/40"
      onMouseEnter={() => onHover(card)}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`Decrease ${card.card_name}`}
          onClick={() => onQuantity(card, card.quantity - 1)}
        >
          <Minus className="size-3" aria-hidden />
        </Button>
        <span className="w-6 text-center text-sm numeric">{card.quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`Increase ${card.card_name}`}
          onClick={() => onQuantity(card, card.quantity + 1)}
        >
          <Plus className="size-3" aria-hidden />
        </Button>
      </div>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm">{card.card_name}</span>
        <ManaCost cost={card.mana_costs} />
      </span>
      <span className="hidden text-xs text-muted-foreground numeric sm:block">
        {formatUsd(card.price_usd)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Choose printing for ${card.card_name}`}
        onClick={() => onPrinting(card)}
      >
        <Layers className="size-3.5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Move ${card.card_name} to ${card.board === "main" ? "sideboard" : "main deck"}`}
        onClick={() => onMove(card)}
      >
        <ArrowLeftRight className="size-3.5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
        aria-label={`Remove ${card.card_name}`}
        onClick={() => onRemove(card)}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </li>
  );
}

function CardPreview({ card }: { card: PreviewCard | null }) {
  if (!card) {
    return (
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
        Hover a card or select a search result to preview it here.
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative mx-auto aspect-[488/680] w-full max-w-[16rem] bg-muted">
        {card.image_normal ? (
          <Image
            src={card.image_normal}
            alt={`${card.name} card`}
            fill
            sizes="256px"
            className="object-contain"
            unoptimized
          />
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <h2 className="font-display text-sm font-medium">{card.name}</h2>
        <div className="flex items-center gap-2">
          <ManaCost cost={card.mana_costs} />
          <span className="text-xs text-muted-foreground">{card.type_line}</span>
        </div>
        {card.oracle_text ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {card.oracle_text}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Merge a row returned by the server into local state. New rows are enriched
 * with display fields from the search result so the row looks right before the
 * next server refresh lands. Using the server id (never a temporary id) means
 * follow-up quantity/move actions always address a real row.
 */
function mergeServerCard(
  current: DeckCardView[],
  row: DeckCard,
  search: CardSearchResult,
): DeckCardView[] {
  const index = current.findIndex(
    (entry) => entry.oracle_id === row.oracle_id && entry.board === row.board,
  );
  if (index >= 0) {
    const next = [...current];
    next[index] = { ...next[index], id: row.id, quantity: row.quantity };
    return next;
  }
  const view: DeckCardView = {
    ...row,
    mana_cost: search.mana_cost,
    mana_costs: search.mana_costs,
    mana_value: search.mana_value,
    type_line: search.type_line,
    oracle_text: search.oracle_text,
    rarity: search.rarity,
    mtgo_id: null,
    colors: search.colors,
    color_identity: search.color_identity,
    art_crop: search.art_crop,
    image_normal: search.image_normal,
    price_usd: search.price_usd,
    category_group: search.type_line
      ? deriveCategory(search.type_line)
      : "Other",
  };
  return [...current, view];
}

function errorText(code: string): string {
  switch (code) {
    case "not_pauper_legal":
      return "That card is not in the Pauper catalog, so it cannot be added. Only cards with Pauper legality are stored.";
    case "unauthenticated":
      return "Your session expired. Reload the page and sign in again.";
    case "card_catalog_unavailable":
      return "The card catalog is unavailable, so imports cannot be validated.";
    case "empty_list":
      return "That text did not contain any card lines.";
    default:
      return code;
  }
}
