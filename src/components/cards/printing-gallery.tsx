"use client";

import * as React from "react";
import Image from "next/image";
import type { CardImages, Printing } from "@/lib/cards/types";
import { cn, formatDate } from "@/lib/utils";

function printingImage(printing: Printing): CardImages {
  return printing.image_uris.normal
    ? printing.image_uris
    : (printing.card_faces?.[0]?.image_uris ?? printing.image_uris);
}

export function PrintingGallery({
  name,
  printings,
  defaultPrintingId,
}: {
  name: string;
  printings: Printing[];
  defaultPrintingId: string;
}) {
  const initialIndex = Math.max(
    0,
    printings.findIndex((printing) => printing.scryfall_id === defaultPrintingId),
  );
  const [index, setIndex] = React.useState(initialIndex);
  const selected = printings[index] ?? printings[0] ?? null;

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
              ({printings.length})
            </span>
          </h2>
          {printings.length > 1 ? (
            <span className="text-xs text-muted-foreground">
              Pick the version you want
            </span>
          ) : null}
        </div>
        <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-4">
          {printings.map((printing, printingIndex) => {
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
      </div>
    </div>
  );
}
