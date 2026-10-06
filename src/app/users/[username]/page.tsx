import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { ColorPips } from "@/components/cards/color-pips";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { getPublicProfile } from "@/lib/decks/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/users/[username]">): Promise<Metadata> {
  const { username } = await params;
  if (!isSupabaseConfigured()) return { title: `@${username}` };

  const data = await getPublicProfile(username).catch(() => null);
  const title = data?.profile.display_name ?? `@${username}`;
  const description =
    data?.profile.bio ?? `Pauper decks by @${username} on Spellstutter.`;
  const image = data?.profile.avatar_art_url ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function UserProfilePage({
  params,
}: PageProps<"/users/[username]">) {
  const { username } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SetupNotice title="Connect Supabase" icon="key">
          <p>Profiles are stored in Postgres. Configure Supabase to continue.</p>
        </SetupNotice>
      </div>
    );
  }

  const result = await getPublicProfile(username);
  if (!result) notFound();
  const { profile, decks } = result;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {profile.avatar_art_url ? (
            <Image
              src={profile.avatar_art_url}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <Avatar name={profile.display_name ?? profile.username} size={80} />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-title font-bold">
            {profile.display_name ?? profile.username}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Joined {formatDate(profile.created_at)}
          </p>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-4 font-display text-lg font-medium">Public decks</h2>
        {decks.length === 0 ? (
          <EmptyState
            title="No public decks"
            description="This brewer has not published any decks yet."
          />
        ) : (
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
                    <h3 className="truncate font-display text-sm font-medium">
                      {deck.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <ColorPips colors={deck.color_identity} size={14} label={false} />
                      <span className="numeric">{deck.card_count} cards</span>
                      <span className="ml-auto">{formatDate(deck.updated_at)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
