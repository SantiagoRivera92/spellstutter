import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { DeckCard } from "@/components/decks/deck-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import { getPublicDecks, type PublicDeckSummary } from "@/lib/decks/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { MANA_SYMBOL_URL } from "@/lib/cards/mana";
import type { CardColor } from "@/lib/cards/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "User decks" };
export const dynamic = "force-dynamic";

const COLORS: CardColor[] = ["W", "U", "B", "R", "G"];
const COLOR_NAMES: Record<CardColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

function hrefFor(sort: string, color: string): string {
  const params = new URLSearchParams();
  if (sort && sort !== "recent") params.set("sort", sort);
  if (color) params.set("color", color);
  const qs = params.toString();
  return qs ? `/decks/public?${qs}` : "/decks/public";
}

function sortDecks(decks: PublicDeckSummary[], sort: string): PublicDeckSummary[] {
  const sorted = [...decks];
  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "cards":
      sorted.sort((a, b) => b.card_count - a.card_count);
      break;
    default:
      sorted.sort((a, b) =>
        a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0,
      );
  }
  return sorted;
}

export default async function PublicDecksPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[]; color?: string | string[] }>;
}) {
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

  const params = await searchParams;
  const sort = typeof params.sort === "string" ? params.sort : "recent";
  const color =
    typeof params.color === "string" && COLORS.includes(params.color as CardColor)
      ? (params.color as CardColor)
      : "";

  const all = await getPublicDecks(120).catch(() => []);
  const filtered = color
    ? all.filter((deck) => deck.color_identity.includes(color))
    : all;
  const decks = sortDecks(filtered, sort);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="User-submitted decks"
        description="Public decks brewed by the community. Open one to comment on it or clone it into your library."
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by color"
          className="flex items-center gap-1"
        >
          <Link
            href={hrefFor(sort, "")}
            aria-current={!color ? "true" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
              !color
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            All
          </Link>
          {COLORS.map((entry) => (
            <Link
              key={entry}
              href={hrefFor(sort, entry)}
              aria-current={color === entry ? "true" : undefined}
              aria-label={COLOR_NAMES[entry]}
              title={COLOR_NAMES[entry]}
              className={cn(
                "flex size-8 items-center justify-center rounded-md border transition-colors duration-150",
                color === entry
                  ? "border-nav-active bg-accent"
                  : "border-transparent hover:bg-muted",
              )}
            >
              <Image
                src={MANA_SYMBOL_URL[entry]}
                alt=""
                width={16}
                height={16}
                unoptimized
              />
            </Link>
          ))}
        </div>

        <form className="flex items-center gap-2">
          {color ? <input type="hidden" name="color" value={color} /> : null}
          <label htmlFor="deck-sort" className="text-sm text-muted-foreground">
            Sort
          </label>
          <Select
            id="deck-sort"
            name="sort"
            defaultValue={sort}
            className="h-9 w-auto"
          >
            <option value="recent">Recently updated</option>
            <option value="cards">Most cards</option>
            <option value="name">Name (A–Z)</option>
          </Select>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Apply
          </button>
        </form>
      </div>

      <div className="mt-4">
        {decks.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckCard deck={deck} href={`/decks/${deck.id}`} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No public decks match"
            description={
              color
                ? "No public decks in that color. Try another color or clear the filter."
                : "When players mark a deck public, it shows up here."
            }
            action={
              <Link
                href={hrefFor("recent", "")}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Clear filters
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
