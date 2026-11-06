"use client";

import * as React from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import {
  PRINTINGS_PAGE_SIZE,
  type CardImages,
  type Printing,
} from "@/lib/cards/types";
import { setFavoritePrinting } from "@/lib/decks/actions";
import { cn, formatDate } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

function printingImage(printing: Printing): CardImages {
  return printing.image_uris.normal
    ? printing.image_uris
    : (printing.card_faces?.[0]?.image_uris ?? printing.image_uris);
}

interface PrintingPageResponse {
  printings: Printing[];
  total: number;
  favoritePrintingId: string | null;
}

export function PrintingPickerDialog({
  oracleId,
  cardName,
  currentPrintingId,
  pending,
  onClose,
  onSelect,
}: {
  oracleId: string;
  cardName: string;
  currentPrintingId: string | null;
  pending: boolean;
  onClose: () => void;
  onSelect: (printing: Printing) => void;
}) {
  const [printings, setPrintings] = React.useState<Printing[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [appliedQuery, setAppliedQuery] = React.useState("");
  const [loadedQuery, setLoadedQuery] = React.useState<string | null>(null);
  const [favoriteId, setFavoriteId] = React.useState<string | null>(null);
  const [favoritePending, setFavoritePending] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(
      () => setAppliedQuery(query.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadPage = React.useCallback(
    async (
      offset: number,
      search: string,
    ): Promise<PrintingPageResponse> => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PRINTINGS_PAGE_SIZE),
      });
      if (currentPrintingId) params.set("prefer", currentPrintingId);
      if (search) params.set("q", search);
      const response = await fetch(`/api/cards/${oracleId}?${params}`);
      if (!response.ok) throw new Error("failed");
      return (await response.json()) as PrintingPageResponse;
    },
    [currentPrintingId, oracleId],
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await loadPage(0, appliedQuery);
        if (!cancelled) {
          setPrintings(data.printings);
          setTotal(data.total);
          setFavoriteId(data.favoritePrintingId ?? null);
          setLoadedQuery(appliedQuery);
          setError(null);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setError("Could not load printings.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [appliedQuery, loadPage]);

  const loading = printings === null || loadedQuery !== appliedQuery;

  async function loadMore() {
    if (!printings) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const data = await loadPage(printings.length, appliedQuery);
      setPrintings((current) => {
        if (!current) return data.printings;
        const seen = new Set(current.map((entry) => entry.scryfall_id));
        return [
          ...current,
          ...data.printings.filter((entry) => !seen.has(entry.scryfall_id)),
        ];
      });
      setTotal(data.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleFavorite(printing: Printing) {
    const next =
      favoriteId === printing.scryfall_id ? null : printing.scryfall_id;
    setFavoritePending(true);
    setError(null);
    const result = await setFavoritePrinting({
      oracleId,
      printingId: next,
    });
    setFavoritePending(false);
    if (result.ok) {
      setFavoriteId(next);
    } else {
      setError(
        result.error === "unauthenticated"
          ? "Sign in to save favourite printings."
          : "Could not save that favourite.",
      );
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Choose a printing — ${cardName}`}
      description="Every paper version on Scryfall, newest first."
      className="w-[min(46rem,calc(100vw-2rem))]"
    >
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by set name, set code, or artist"
        aria-label="Filter printings"
        className="mb-3"
      />

      {!printings || loading ? (
        <div className="flex justify-center py-8">
          <Spinner label="Loading printings" />
        </div>
      ) : printings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {appliedQuery
            ? "No printings match that filter."
            : "No printings on record for this card."}
        </p>
      ) : (
        <>
          <ul className="grid max-h-[28rem] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {printings.map((printing) => {
              const image = printingImage(printing);
              const active = printing.scryfall_id === currentPrintingId;
              const favorite = printing.scryfall_id === favoriteId;
              return (
                <li key={printing.scryfall_id} className="relative">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onSelect(printing)}
                    className={cn(
                      "block w-full overflow-hidden rounded-lg border text-left transition-colors duration-150",
                      active
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="relative block aspect-[488/680] bg-muted">
                      {image.small ? (
                        <Image
                          src={image.small}
                          alt=""
                          fill
                          sizes="120px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <span className="block px-2 py-1.5">
                      <span className="block truncate text-xs font-medium">
                        {printing.set.toUpperCase()} #{printing.collector_number}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {printing.set_name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {printing.artist ?? ""}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {printing.released_at
                          ? formatDate(printing.released_at)
                          : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={favoritePending}
                    onClick={() => toggleFavorite(printing)}
                    aria-label={
                      favorite
                        ? `Remove favourite printing for ${cardName}`
                        : `Set this printing as favourite for ${cardName}`
                    }
                    aria-pressed={favorite}
                    className={cn(
                      "absolute right-1.5 top-1.5 rounded-md border border-border/70 bg-background/90 p-1 shadow-sm transition-colors duration-150 hover:text-primary disabled:opacity-60",
                      favorite ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Star
                      className="size-3.5"
                      fill={favorite ? "currentColor" : "none"}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          {printings.length < total ? (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore || pending}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary/50 disabled:opacity-60"
              >
                {loadingMore
                  ? "Loading…"
                  : `Load more printings (${total - printings.length} left)`}
              </button>
              {loadError ? (
                <p className="mt-2 text-xs text-destructive">
                  Could not load more printings. Try again.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Dialog>
  );
}
