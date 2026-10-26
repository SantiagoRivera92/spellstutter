"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Plus, Search, TriangleAlert } from "lucide-react";
import type { CardSearchResult } from "@/lib/cards/types";
import { cn, formatUsd } from "@/lib/utils";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ManaCost } from "./mana-cost";

interface CardSearchProps {
  onAddCard?: (card: CardSearchResult) => void;
  onSelectCard?: (card: CardSearchResult) => void;
  autoFocus?: boolean;
  draggable?: boolean;
  /** Restrict results to Pauper-legal cards (deckbuilding, avatar picker). */
  pauperOnly?: boolean;
  className?: string;
  emptyHint?: string;
  /** Seed the input, e.g. from a global-search `?q=` parameter. */
  initialQuery?: string;
}

type Status = "idle" | "loading" | "ready" | "error";

const SYNTAX_EXAMPLES = [
  ["t:creature", "type line"],
  ['o:"draw a card"', "oracle text"],
  ["c:ub", "card color"],
  ["id:wu", "color identity"],
  ["cmc<=2", "mana value"],
  ["is:spell", "card kind"],
  ["!" + '"Counterspell"', "exact name"],
];

export function CardSearch({
  onAddCard,
  onSelectCard,
  autoFocus,
  draggable,
  pauperOnly,
  className,
  emptyHint = "Search Scryfall by name, or use full syntax like t:instant c:u cmc<=2.",
  initialQuery = "",
}: CardSearchProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState<CardSearchResult[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const active = query.trim().length > 0;

  const runSearch = React.useCallback(
    async (trimmed: string, nextPage: number, append: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      if (!append) setMessage(null);

      const searchQuery = pauperOnly ? `${trimmed} f:pauper` : trimmed;

      try {
        const response = await fetch(
          `/api/scryfall/search?q=${encodeURIComponent(searchQuery)}&page=${nextPage}`,
          { signal: controller.signal },
        );
        const data = (await response.json().catch(() => null)) as
          | {
              cards: CardSearchResult[];
              total: number;
              has_more: boolean;
              message?: string;
            }
          | null;

        if (!response.ok || !data) {
          setStatus("error");
          setMessage(
            data?.message ??
              "Scryfall could not run that search. Check the syntax and try again.",
          );
          return;
        }

        setResults((current) =>
          append ? [...current, ...data.cards] : data.cards,
        );
        setTotal(data.total);
        setHasMore(data.has_more);
        setPage(nextPage);
        setMessage(null);
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setStatus("error");
        setMessage("Scryfall is unreachable. Try again in a moment.");
      }
    },
    [pauperOnly],
  );

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      return;
    }
    const timeout = setTimeout(() => {
      void runSearch(trimmed, 1, false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cards on Scryfall…"
          aria-label="Search cards on Scryfall"
          className="pl-9 pr-20"
        />
        <button
          type="button"
          onClick={() => setHelpOpen((value) => !value)}
          aria-expanded={helpOpen}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Syntax
        </button>
      </div>

      {helpOpen ? (
        <div className="mt-2 rounded-md border border-border bg-card p-3 text-xs">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {SYNTAX_EXAMPLES.map(([syntax, label]) => (
              <div key={syntax} className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-foreground">{syntax}</dt>
                <dd className="text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
          <a
            href="https://scryfall.com/docs/syntax"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Full Scryfall syntax
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      ) : null}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <p className="sr-only" role="status" aria-live="polite">
          {active && status === "loading"
            ? "Searching…"
            : active && status === "error"
              ? message
              : active && status === "ready"
                ? `${total} cards found, showing ${results.length}`
                : ""}
        </p>
        {!active ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">{emptyHint}</p>
        ) : null}

        {active && status === "loading" && !results.length ? (
          <div className="flex justify-center py-8">
            <Spinner label="Searching Scryfall" />
          </div>
        ) : null}

        {active && status === "error" ? (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
            <div>
              <p className="font-medium text-foreground">No results</p>
              <p className="text-muted-foreground">{message}</p>
            </div>
          </div>
        ) : null}

        {active && status === "ready" && results.length === 0 ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">
            Nothing on Scryfall matches “{query.trim()}”.
          </p>
        ) : null}

        {results.length > 0 ? (
          <>
            <p className="mb-1 px-1 text-xs numeric text-muted-foreground">
              {total.toLocaleString()} card{total === 1 ? "" : "s"} · showing{" "}
              {results.length}
            </p>
            <ul
              className="min-h-0 flex-1 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card"
              aria-label="Card search results"
            >
              {results.map((card) => (
                <CardResultRow
                  key={card.oracle_id}
                  card={card}
                  draggable={draggable && card.pauper_legal}
                  onActivate={onSelectCard}
                  onAdd={onAddCard}
                />
              ))}
            </ul>
            {hasMore ? (
              <div className="mt-2 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={status === "loading"}
                  onClick={() => runSearch(query.trim(), page + 1, true)}
                >
                  {status === "loading" ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function CardResultRow({
  card,
  draggable,
  onActivate,
  onAdd,
}: {
  card: CardSearchResult;
  draggable?: boolean;
  onActivate?: (card: CardSearchResult) => void;
  onAdd?: (card: CardSearchResult) => void;
}) {
  function handleDragStart(event: React.DragEvent<HTMLLIElement>) {
    event.dataTransfer.setData(
      "application/x-spellstutter-card",
      JSON.stringify({
        oracle_id: card.oracle_id,
        name: card.name,
        mana_cost: card.mana_cost,
      }),
    );
    event.dataTransfer.effectAllowed = "copy";
  }

  const content = (
    <>
      <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded border border-border bg-muted">
        {card.art_crop ? (
          <Image
            src={card.art_crop}
            alt=""
            fill
            sizes="36px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{card.name}</span>
          <ManaCost cost={card.mana_costs} />
          {card.pauper_legal ? (
            <Badge tone="outline" className="border-primary/40 text-primary">
              Pauper
            </Badge>
          ) : (
            <Badge tone="outline" className="text-muted-foreground">
              Not Pauper
            </Badge>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{card.type_line}</span>
        </span>
      </span>
      <span className="hidden shrink-0 text-xs numeric text-muted-foreground sm:block">
        {formatUsd(card.price_usd)}
      </span>
    </>
  );

  return (
    <li
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      className={cn(
        "group flex items-center gap-3 px-2.5 py-2 transition-colors duration-150 hover:bg-muted/60",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      {onActivate ? (
        <button
          type="button"
          onClick={() => onActivate(card)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {content}
        </button>
      ) : (
        <Link
          href={`/cards/${card.oracle_id}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {content}
        </Link>
      )}
      {onAdd && card.pauper_legal ? (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={`Add ${card.name} to deck`}
          onClick={() => onAdd(card)}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}
