"use client";

import * as React from "react";
import Image from "next/image";
import type { CardImages, Printing } from "@/lib/cards/types";
import { cn, formatDate } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { rarityClass } from "@/components/cards/rarity";

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
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/cards/${oracleId}`);
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as { printings: Printing[] };
        if (!cancelled) setPrintings(data.printings);
      } catch {
        if (!cancelled) setError("Could not load printings.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [oracleId]);

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
                      <span className={rarityClass(printing.rarity)}>
                        {printing.rarity}
                      </span>
                      {printing.released_at
                        ? ` · ${formatDate(printing.released_at)}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
