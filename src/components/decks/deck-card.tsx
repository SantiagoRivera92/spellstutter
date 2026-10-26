import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Layers } from "lucide-react";
import type { CardColor } from "@/lib/cards/types";
import type { DeckVisibility } from "@/lib/supabase/types";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ColorPips } from "@/components/cards/color-pips";

export interface DeckCardData {
  id: string;
  name: string;
  cover_art_url: string | null;
  color_identity: CardColor[];
  card_count: number;
  updated_at: string;
  visibility?: DeckVisibility;
  owner?: {
    username: string;
    display_name: string | null;
    avatar_art_url: string | null;
  } | null;
}

/**
 * Art-first deck card: cover art, color identity and count read first, with a
 * footer for the owner (community decks) or a status chip plus actions (your
 * library).
 */
export function DeckCard({
  deck,
  href,
  actions,
  className,
}: {
  deck: DeckCardData;
  href: string;
  actions?: ReactNode;
  className?: string;
}) {
  const owner = deck.owner ?? null;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150 hover:border-nav-active/50",
        className,
      )}
    >
      <Link href={href} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-panel">
          {deck.cover_art_url ? (
            <Image
              src={deck.cover_art_url}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 360px"
              className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Layers className="size-7" aria-hidden />
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-black-950/75 to-transparent"
            aria-hidden
          />
          <span className="absolute left-2 top-2 rounded-md bg-ink-black-950/70 px-1.5 py-0.5">
            <ColorPips colors={deck.color_identity} size={14} label={false} />
          </span>
          {deck.visibility && deck.visibility !== "private" ? (
            <span className="absolute right-2 top-2">
              <Badge tone="outline" className="border-ink-black-600 bg-ink-black-950/70 text-ink-black-100">
                {deck.visibility}
              </Badge>
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="truncate font-display text-sm font-medium">
            {deck.name}
          </h3>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="numeric">{deck.card_count} cards</span>
            <span className="ml-auto numeric">{formatDate(deck.updated_at)}</span>
          </div>
        </div>
      </Link>

      {owner || actions ? (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          {owner ? (
            <>
              <Avatar
                src={owner.avatar_art_url}
                name={owner.display_name ?? owner.username}
                size={20}
              />
              <Link
                href={`/users/${owner.username}`}
                className="truncate text-xs text-muted-foreground hover:text-foreground"
              >
                @{owner.username}
              </Link>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Updated</span>
          )}
          {actions ? <div className="ml-auto">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}
