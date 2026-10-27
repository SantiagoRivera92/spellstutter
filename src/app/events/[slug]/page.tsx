import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { DeckDetails } from "@/components/metagame/deck-details";
import { Badge } from "@/components/ui/badge";
import { isMongoConfigured } from "@/lib/env";
import { getEvent } from "@/lib/metagame/queries";
import { archetypeName } from "@/lib/metagame/archetypes";
import { eventSourceName } from "@/lib/metagame/event-source";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isMongoConfigured()) return { title: "Event" };
  const result = await getEvent(slug).catch(() => null);
  return { title: result?.event.name ?? "Event" };
}

export default async function EventPage({
  params,
  searchParams,
}: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const sort = query.sort === "archetype" ? "archetype" : "placement";

  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SetupNotice title="Connect the metagame store">
          <p>Configure MongoDB and run a metagame sync to view events.</p>
        </SetupNotice>
      </div>
    );
  }

  const result = await getEvent(slug).catch(() => null);
  if (!result) notFound();
  const { event, decks } = result;

  const counts = new Map<string, number>();
  for (const deck of decks) {
    counts.set(deck.archetype.slug, (counts.get(deck.archetype.slug) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const grouped = new Map<string, typeof decks>();
  for (const deck of decks) {
    const list = grouped.get(deck.archetype.slug) ?? [];
    list.push(deck);
    grouped.set(deck.archetype.slug, list);
  }

  const byPlacement = [...decks].sort((a, b) => {
    const rankA = a.rank ?? Number.POSITIVE_INFINITY;
    const rankB = b.rank ?? Number.POSITIVE_INFINITY;
    return rankA === rankB ? a.player.localeCompare(b.player) : rankA - rankB;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <ol className="flex items-center gap-2 text-muted-foreground">
          <li>
            <Link href="/events" className="hover:text-foreground">
              Events
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate text-foreground">{event.name}</li>
        </ol>
      </nav>

      <PageHeader
        title={event.name}
        description={`${event.deck_count} decklists${
          event.date ? ` · ${formatDate(event.date)}` : ""
        }`}
        actions={
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            View on {eventSourceName(event)}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Sort decks"
          className="flex items-center gap-1"
        >
          <Link
            href={`/events/${slug}`}
            aria-current={sort === "placement" ? "true" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
              sort === "placement"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Placement
          </Link>
          <Link
            href={`/events/${slug}?sort=archetype`}
            aria-current={sort === "archetype" ? "true" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
              sort === "archetype"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Archetype
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="outline">{event.event_type}</Badge>
          {breakdown.map(([archetypeSlug, count]) => (
            <Badge key={archetypeSlug} tone="neutral">
              {archetypeName(archetypeSlug)}{" "}
              <span className="numeric text-muted-foreground">{count}</span>
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {sort === "archetype" ? (
          <div className="space-y-8">
            {[...grouped.entries()].map(([archetypeSlug, list]) => (
              <section key={archetypeSlug} aria-label={archetypeName(archetypeSlug)}>
                <h2 className="mb-2 flex items-center justify-between font-display text-base font-medium">
                  <Link
                    href={`/metagame/archetypes/${archetypeSlug}`}
                    className="hover:text-primary"
                  >
                    {archetypeName(archetypeSlug)}
                  </Link>
                  <span className="numeric text-xs text-muted-foreground">
                    {list.length} deck{list.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="rounded-lg border border-border bg-card">
                  {list.map((deck) => (
                    <DeckDetails
                      key={`${deck.event_slug}-${deck.player}`}
                      deck={deck}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section aria-label="Decks by placement">
            <h2 className="mb-2 flex items-center justify-between font-display text-base font-medium">
              <span>Placement</span>
              <span className="numeric text-xs text-muted-foreground">
                {decks.length} deck{decks.length === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="rounded-lg border border-border bg-card">
              {byPlacement.map((deck) => (
                <DeckDetails key={`${deck.event_slug}-${deck.player}`} deck={deck} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
