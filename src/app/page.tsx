import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ArchetypeGrid } from "@/components/metagame/archetype-grid";
import { DeckCard } from "@/components/decks/deck-card";
import { getCardArtByName } from "@/lib/cards/queries";
import {
  getPublicDecks,
  type PublicDeckSummary,
} from "@/lib/decks/queries";
import { isMongoConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  listArchetypeOverview,
  listBigEvents,
  listEvents,
  type ArchetypeOverview,
} from "@/lib/metagame/queries";
import type { MetagameEvent } from "@/lib/metagame/types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const mongo = isMongoConfigured();
  const supabase = isSupabaseConfigured();

  const [art, archetypes, bigEvents, events, decks] = await Promise.all([
    mongo ? getCardArtByName("Spellstutter Sprite").catch(() => null) : null,
    mongo ? listArchetypeOverview(30).catch(() => []) : Promise.resolve([]),
    mongo ? listBigEvents(3).catch(() => []) : Promise.resolve([]),
    mongo ? listEvents(6).catch(() => []) : Promise.resolve([]),
    supabase ? getPublicDecks(4).catch(() => []) : Promise.resolve([]),
  ]);

  const featured: ArchetypeOverview[] = archetypes.slice(0, 6);
  const latestBigEvents: MetagameEvent[] = bigEvents;
  const recentEvents: MetagameEvent[] = events;
  const freshDecks: PublicDeckSummary[] = decks;

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8">
      <Hero art={art} />

      <section aria-labelledby="featured-archetypes">
        <SectionHeading
          id="featured-archetypes"
          title="Featured archetypes"
          href="/metagame"
          linkLabel="Full metagame"
        />
        <div className="mt-4">
          <ArchetypeGrid archetypes={featured} />
        </div>
      </section>

      <section aria-labelledby="big-events">
        <SectionHeading
          id="big-events"
          title="Most recent big events"
          href="/events"
          linkLabel="All events"
        />
        {latestBigEvents.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {latestBigEvents.map((event) => (
              <li key={event.slug}>
                <Link
                  href={`/events/${event.slug}`}
                  className="flex h-full flex-col justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-3 transition-colors duration-150 hover:bg-muted/60"
                >
                  <span className="text-sm font-medium">{event.name}</span>
                  <span className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">
                      {event.event_type} · {formatDate(event.date)}
                    </span>
                    <span className="numeric whitespace-nowrap">
                      {event.player_count} players
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder text="No 100+ player events stored yet." />
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div aria-labelledby="recent-events">
          <SectionHeading
            id="recent-events"
            title="Recent events"
            href="/events"
            linkLabel="All events"
          />
          {recentEvents.length ? (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
              {recentEvents.map((event) => (
                <li key={event.slug}>
                  <Link
                    href={`/events/${event.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {event.name}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {event.event_type} · {formatDate(event.date)}
                      </span>
                    </span>
                    <span className="numeric text-xs text-muted-foreground">
                      {event.deck_count} decks
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder text="Metagame data isn't loaded yet." />
          )}
        </div>

        <div aria-labelledby="fresh-decks">
          <SectionHeading
            id="fresh-decks"
            title="Fresh from the community"
            href="/decks/public"
            linkLabel="Browse decks"
          />
          {freshDecks.length ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {freshDecks.map((deck) => (
                <li key={deck.id}>
                  <DeckCard deck={deck} href={`/decks/${deck.id}`} />
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder text="No public decks yet. Be the first to share one." />
          )}
        </div>
      </section>
    </div>
  );
}

function Hero({ art }: { art: string | null }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-panel px-6 py-10 sm:px-10 sm:py-14">
      {art ? (
        <>
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover object-[center_30%]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-ink-black-950/95 via-ink-black-950/85 to-ink-black-950/60"
          />
        </>
      ) : null}

      <div className="relative max-w-xl">
        <p className="font-display text-sm font-medium text-primary">
          Pauper, for Pauper players.
        </p>
        <h1 className="mt-2 font-display text-title font-bold text-ink-black-50">
          Build Pauper decks and explore the metagame
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-black-100">
          Search the full card pool, drag cards into a list, and seed a deck
          from a real archetype&apos;s core. Then see what the metagame is playing.
        </p>

        <form
          action="/cards"
          method="get"
          role="search"
          className="relative mt-6 max-w-md"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            placeholder="Search any card on Scryfall…"
            aria-label="Search cards"
            className="h-11 w-full rounded-lg border border-input bg-background/80 pl-9 pr-28 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className={buttonVariants({
              size: "sm",
              className: "absolute right-1.5 top-1.5",
            })}
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/decks" className={buttonVariants({ variant: "outline", size: "sm" })}>
            My decks
          </Link>
          <Link href="/decks/public" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Browse decks
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-lg font-medium">
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {linkLabel}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
