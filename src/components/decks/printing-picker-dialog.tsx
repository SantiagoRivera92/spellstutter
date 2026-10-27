"use client";

import * as React from "react";
import Image from "next/image";
import {
  PRINTINGS_PAGE_SIZE,
  type CardImages,
  type Printing,
} from "@/lib/cards/types";
import { cn, formatDate } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

function printingImage(printing: Printing): CardImages {
  return printing.image_uris.normal
    ? printing.image_uris
    : (printing.card_faces?.[0]?.image_uris ?? printing.image_uris);
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

  const loadPage = React.useCallback(
    async (offset: number): Promise<{ printings: Printing[]; total: number }> => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PRINTINGS_PAGE_SIZE),
      });
      if (currentPrintingId) params.set("prefer", currentPrintingId);
      const response = await fetch(`/api/cards/${oracleId}?${params}`);
      if (!response.ok) throw new Error("failed");
      return (await response.json()) as { printings: Printing[]; total: number };
    },
    [currentPrintingId, oracleId],
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await loadPage(0);
        if (!cancelled) {
          setPrintings(data.printings);
          setTotal(data.total);
        }
      } catch {
        if (!cancelled) setError("Could not load printings.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  async function loadMore() {
    if (!printings) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const data = await loadPage(printings.length);
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

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Choose a printing — ${cardName}`}
      description="Every version on Scryfall, newest first."
      className="w-[min(46rem,calc(100vw-2rem))]"
    >
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !printings ? (
        <div className="flex justify-center py-8">
          <Spinner label="Loading printings" />
        </div>
      ) : printings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No printings on record for this card.
        </p>
      ) : (
        <>
          <ul className="grid max-h-[28rem] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
          {printings.map((printing) => {
            const image = printingImage(printing);
            const active = printing.scryfall_id === currentPrintingId;
            return (
              <li key={printing.scryfall_id}>
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
                      {printing.released_at
                        ? formatDate(printing.released_at)
                        : ""}
                    </span>
                  </span>
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
