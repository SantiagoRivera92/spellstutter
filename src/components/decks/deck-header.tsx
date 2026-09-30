import Image from "next/image";
import Link from "next/link";
import type { DeckView } from "@/lib/decks/types";
import type { Folder } from "@/lib/supabase/types";
import { formatDate, formatUsd } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DeckToolbar, VisibilityControl } from "./deck-toolbar";

export function DeckHeader({
  view,
  ownerName,
  canEdit,
  folders,
}: {
  view: DeckView;
  ownerName?: string;
  canEdit: boolean;
  folders: Folder[];
}) {
  const { deck, stats, cards } = view;
  const cover = deck.cover_art_url;

  return (
    <section className="border-b border-border">
      <div className="relative isolate">
        <div className="absolute inset-0 -z-10 overflow-hidden bg-ink-black-900">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_28%]"
              unoptimized
            />
          ) : null}
          <div className="absolute inset-0 bg-ink-black-950/75" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm">
            <ol className="flex items-center gap-2 text-ink-black-200">
              <li>
                {canEdit ? (
                  <Link href="/decks" className="hover:text-ink-black-50">
                    My decks
                  </Link>
                ) : ownerName ? (
                  <Link href={`/users/${ownerName}`} className="hover:text-ink-black-50">
                    @{ownerName}
                  </Link>
                ) : (
                  "Decks"
                )}
              </li>
              <li aria-hidden>/</li>
              <li className="truncate text-ink-black-50">{deck.name}</li>
            </ol>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-prose">
              {deck.visibility !== "private" ? (
                <div className="flex items-center gap-2">
                  <Badge tone="outline" className="border-ink-black-600 text-ink-black-100">
                    {deck.visibility}
                  </Badge>
                </div>
              ) : null}
              <h1 className="mt-3 font-display text-title font-bold text-ink-black-50">
                {deck.name}
              </h1>
              {!canEdit && ownerName ? (
                <p className="mt-2 text-sm text-ink-black-200">
                  by{" "}
                  <Link
                    href={`/users/${ownerName}`}
                    className="font-medium text-ink-black-50 hover:underline"
                  >
                    @{ownerName}
                  </Link>
                </p>
              ) : null}
              {deck.description ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-black-100">
                  {deck.description}
                </p>
              ) : null}
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-black-200">
                <span className="numeric">{stats.main_count} main</span>
                <span className="numeric">{stats.side_count} side</span>
                <span className="numeric">{formatUsd(stats.total_price)}</span>
                <span>Updated {formatDate(deck.updated_at)}</span>
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <DeckToolbar
                deckId={deck.id}
                deckName={deck.name}
                coverOracleId={deck.cover_oracle_id}
                folderId={deck.folder_id}
                folders={folders}
                cards={cards}
                canEdit={canEdit}
              />
              {canEdit ? (
                <VisibilityControl deckId={deck.id} visibility={deck.visibility} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
