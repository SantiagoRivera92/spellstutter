import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { ColorPips } from "@/components/cards/color-pips";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicDecks } from "@/lib/decks/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "User decks" };
export const dynamic = "force-dynamic";

export default async function PublicDecksPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="User decks" />
        <div className="mt-6">
          <SetupNotice title="Connect Supabase" icon="key">
            <p>Public decks are stored in Postgres. Configure Supabase to continue.</p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const decks = await getPublicDecks(60).catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="User-submitted decks"
        description="Public decks brewed by the community. Open one to comment on it or clone it into your library."
      />
      <div className="mt-6">
        {decks.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50"
              >
                <Link href={`/decks/${deck.id}`} className="block">
                  <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    {deck.cover_art_url ? (
                      <Image
                        src={deck.cover_art_url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 320px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Layers className="size-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="truncate font-display text-sm font-medium">
                      {deck.name}
                    </h2>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <ColorPips colors={deck.color_identity} size={14} label={false} />
                      <span className="numeric">{deck.card_count} cards</span>
                      <span className="ml-auto">{formatDate(deck.updated_at)}</span>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                  <Avatar
                    src={deck.owner?.avatar_art_url}
                    name={deck.owner?.display_name ?? deck.owner?.username ?? "?"}
                    size={20}
                  />
                  {deck.owner ? (
                    <Link
                      href={`/users/${deck.owner.username}`}
                      className="truncate text-xs text-muted-foreground hover:text-foreground"
                    >
                      @{deck.owner.username}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unknown</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No public decks yet"
            description="When players mark a deck public, it shows up here."
          />
        )}
      </div>
    </div>
  );
}
