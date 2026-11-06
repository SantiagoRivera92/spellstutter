import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeckHeader } from "@/components/decks/deck-header";
import { DeckView } from "@/components/decks/deck-view";
import { SetupNotice } from "@/components/setup-notice";
import { EventDeckActions } from "@/components/metagame/event-deck-actions";
import { isMongoConfigured } from "@/lib/env";
import { getMetagameDeckView } from "@/lib/metagame/deck-view";

export const dynamic = "force-dynamic";

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]/decks/[player]">): Promise<Metadata> {
  const { slug, player } = await params;
  const playerName = decodeSegment(player);
  if (!isMongoConfigured()) return { title: "Event deck" };

  const result = await getMetagameDeckView(slug, playerName).catch(() => null);
  if (!result) return { title: "Event deck" };

  const title = result.view.deck.name;
  const description =
    result.view.deck.description ?? "A Pauper event deck on Spellstutter.";
  const image = result.view.deck.cover_art_url ?? undefined;
  return {
    title,
    description,
    alternates: {
      canonical: `/events/${slug}/decks/${encodeURIComponent(playerName)}`,
    },
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

export default async function EventDeckPage({
  params,
}: PageProps<"/events/[slug]/decks/[player]">) {
  const { slug, player } = await params;
  const playerName = decodeSegment(player);

  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SetupNotice title="Connect the metagame store">
          <p>Configure MongoDB and run a metagame sync to view event decks.</p>
        </SetupNotice>
      </div>
    );
  }

  const result = await getMetagameDeckView(slug, playerName).catch(() => null);
  if (!result) notFound();

  const sharePath = `/events/${slug}/decks/${encodeURIComponent(playerName)}`;

  return (
    <div>
      <DeckHeader
        view={result.view}
        canEdit={false}
        folders={[]}
        showVisibility={false}
        breadcrumb={
          <Link
            href={`/events/${result.event.slug}`}
            className="hover:text-ink-black-50"
          >
            {result.event.name}
          </Link>
        }
        toolbar={
          <EventDeckActions
            eventSlug={result.event.slug}
            player={result.deck.player}
            sharePath={sharePath}
            shareTitle={result.view.deck.name}
          />
        }
      />
      <DeckView view={result.view} />
    </div>
  );
}
