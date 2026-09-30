import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { DeckDetails } from "@/components/metagame/deck-details";
import { ColorPips } from "@/components/cards/color-pips";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/env";
import { archetypeName } from "@/lib/metagame/archetypes";
import {
  getArchetypeBreakdown,
  getMetagameSummary,
  listDecksByArchetype,
} from "@/lib/metagame/queries";
import type { ArchetypeCardStat } from "@/lib/metagame/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/metagame/archetypes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: archetypeName(slug) };
}

export default async function ArchetypePage({
  params,
}: PageProps<"/metagame/archetypes/[slug]">) {
  const { slug } = await params;

  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SetupNotice title="Connect the metagame store">
          <p>Configure MongoDB and run the MTGO sync to view archetypes.</p>
        </SetupNotice>
      </div>
    );
  }

  const [session, decks] = await Promise.all([
    getSession(),
    listDecksByArchetype(slug).catch(() => []),
  ]);
  const summary = session
    ? await getMetagameSummary(30).catch(() => null)
    : null;
  const breakdown = session
    ? await getArchetypeBreakdown(slug, 30).catch(() => null)
    : null;

  const stat = summary?.archetypes.find((entry) => entry.slug === slug) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <ol className="flex items-center gap-2 text-muted-foreground">
          <li>
            <Link href="/metagame" className="hover:text-foreground">
              Metagame
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{archetypeName(slug)}</li>
        </ol>
      </nav>

      <PageHeader
        title={archetypeName(slug)}
        description="Top-performing and recent MTGO lists for this archetype."
      />

      {session && stat ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Meta share" value={`${(stat.meta_share * 100).toFixed(1)}%`} />
          <Metric label="Decks (30d)" value={stat.decks} />
          <Metric
            label="Record"
            value={
              stat.win_rate != null
                ? `${stat.wins}-${stat.losses}`
                : "—"
            }
          />
          <Metric
            label="Avg rank"
            value={stat.average_rank != null ? stat.average_rank.toFixed(1) : "—"}
          />
        </dl>
      ) : !session ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-5">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          <p className="flex-1 text-sm text-muted-foreground">
            Statistics for this archetype are available with a free account.
          </p>
          <Link
            href={`/signup?next=/metagame/archetypes/${slug}`}
            className={buttonVariants({ size: "sm" })}
          >
            Create free account
          </Link>
        </div>
      ) : null}

      {breakdown ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-medium">
              Average deck composition
            </h2>
            <p className="numeric text-xs text-muted-foreground">
              {breakdown.decks} lists · avg {breakdown.average_main_size.toFixed(1)}{" "}
              main / {breakdown.average_side_size.toFixed(1)} side
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cards marked Core appear in every stored list of this archetype.
          </p>
          <CardStatTable stats={breakdown.main} totalDecks={breakdown.decks} />
          {breakdown.side.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">
                Sideboard averages
              </summary>
              <CardStatTable
                stats={breakdown.side}
                totalDecks={breakdown.decks}
              />
            </details>
          ) : null}
        </section>
      ) : stat?.top_cards.length ? (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-base font-medium">Most played cards</h2>
          <ul className="flex flex-wrap gap-2">
            {stat.top_cards.map((card) => (
              <li
                key={card.name}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs"
              >
                {card.name}{" "}
                <span className="numeric text-muted-foreground">{card.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-2 font-display text-base font-medium">Recent lists</h2>
        {decks.length ? (
          <div className="rounded-lg border border-border bg-card">
            {decks.map((deck) => (
              <DeckDetails
                key={`${deck.event_slug}-${deck.player}`}
                deck={deck}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No stored lists for this archetype yet.
          </p>
        )}
      </section>

      {stat ? (
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <ColorPips colors={stat.color_identity} size={14} label={false} />
          Typical colors: {stat.color_identity.join("") || "Colorless"}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-medium numeric">{value}</dd>
    </div>
  );
}

function CardStatTable({
  stats,
  totalDecks,
}: {
  stats: ArchetypeCardStat[];
  totalDecks: number;
}) {
  return (
    <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Average cards played</caption>
        <thead className="sticky top-0 bg-muted">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              Card
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Avg copies
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              In lists
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.slice(0, 120).map((card) => (
            <tr
              key={`${card.oracle_id ?? "na"}-${card.name}`}
              className="border-b border-border/60 last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-1.5">
                {card.oracle_id ? (
                  <Link
                    href={`/cards/${card.oracle_id}`}
                    className="hover:text-primary"
                  >
                    {card.name}
                  </Link>
                ) : (
                  card.name
                )}
                {card.decks >= totalDecks ? (
                  <Badge tone="outline" className="ml-2 border-primary/40 text-primary">
                    Core
                  </Badge>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-right numeric">
                {card.avg_qty.toFixed(2)}
              </td>
              <td className="px-3 py-1.5 text-right numeric">
                {(card.include_rate * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
