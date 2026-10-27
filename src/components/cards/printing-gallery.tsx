"use client";

import * as React from "react";
import Image from "next/image";
import {
  PRINTINGS_PAGE_SIZE,
  type CardImages,
  type Printing,
} from "@/lib/cards/types";
import { cn, formatDate } from "@/lib/utils";

function printingImage(printing: Printing): CardImages {
  return printing.image_uris.normal
    ? printing.image_uris
    : (printing.card_faces?.[0]?.image_uris ?? printing.image_uris);
}

export function PrintingGallery({
  oracleId,
  name,
  printings,
  total,
  defaultPrintingId,
}: {
  oracleId: string;
  name: string;
  printings: Printing[];
  total: number;
  defaultPrintingId: string;
}) {
  const initialIndex = Math.max(
    0,
    printings.findIndex((printing) => printing.scryfall_id === defaultPrintingId),
  );
  const [items, setItems] = React.useState(printings);
  const [totalCount, setTotalCount] = React.useState(total);
  const [index, setIndex] = React.useState(initialIndex);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const selected = items[index] ?? items[0] ?? null;

  async function loadMore() {
    setLoadingMore(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({
        offset: String(items.length),
        limit: String(PRINTINGS_PAGE_SIZE),
        prefer: defaultPrintingId,
      });
      const response = await fetch(`/api/cards/${oracleId}?${params}`);
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as {
        printings: Printing[];
        total: number;
      };
      setItems((current) => {
        const seen = new Set(current.map((entry) => entry.scryfall_id));
        return [
          ...current,
          ...data.printings.filter((entry) => !seen.has(entry.scryfall_id)),
        ];
      });
      setTotalCount(data.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!selected) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        No printings on record for this card. Run the Scryfall sync to load them.
      </div>
    );
  }

  const image = printingImage(selected);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[488/680] w-full max-w-[20rem] overflow-hidden rounded-xl border border-border bg-muted">
        {image.normal ? (
          <Image
            src={image.normal}
            alt={`${name} — ${selected.set_name}`}
            fill
            priority
            sizes="(max-width: 1024px) 80vw, 320px"
            className="object-contain"
            unoptimized
          />
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <p className="font-medium">{selected.set_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {selected.set.toUpperCase()} #{selected.collector_number}
          {selected.released_at ? ` · ${formatDate(selected.released_at)}` : ""}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-sm font-medium">
            Printings{" "}
            <span className="numeric text-xs text-muted-foreground">
              ({totalCount})
            </span>
          </h2>
          {totalCount > 1 ? (
            <span className="text-xs text-muted-foreground">
              Showing {items.length} of {totalCount}
            </span>
          ) : null}
        </div>
        <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-4">
          {items.map((printing, printingIndex) => {
            const thumb = printingImage(printing);
            const active = printingIndex === index;
            return (
              <li key={printing.scryfall_id}>
                <button
                  type="button"
                  onClick={() => setIndex(printingIndex)}
                  aria-pressed={active}
                  aria-label={`${name}, ${printing.set_name} #${printing.collector_number}`}
                  title={`${printing.set_name} #${printing.collector_number}`}
                  className={cn(
                    "block w-full overflow-hidden rounded-md border transition-colors duration-150",
                    active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
                  )}
                >
                  <span className="relative block aspect-[488/680] bg-muted">
                    {thumb.small ? (
                      <Image
                        src={thumb.small}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </span>
                  <span className="block truncate px-1 py-0.5 text-[10px] text-muted-foreground">
                    {printing.set.toUpperCase()}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {items.length < totalCount ? (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary/50 disabled:opacity-60"
            >
              {loadingMore
                ? "Loading…"
                : `Load more printings (${totalCount - items.length} left)`}
            </button>
            {loadError ? (
              <p className="mt-2 text-xs text-destructive">
                Could not load more printings. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
