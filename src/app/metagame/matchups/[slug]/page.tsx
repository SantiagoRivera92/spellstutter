import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/env";
import { getCombinedArchetypeMatchups } from "@/lib/metagame/queries";
import { archetypeName } from "@/lib/metagame/archetypes";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/metagame/matchups/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Matchups - ${archetypeName(slug)}` };
}

export default async function MatchupsPage({
  params,
}: PageProps<"/metagame/matchups/[slug]">) {
  const { slug } = await params;

  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Matchups" />
        <SetupNotice title="Connect the metagame store">
          <p>Configure MongoDB and run the endstep sync to view matchup data.</p>
        </SetupNotice>
      </div>
    );
  }

  const session = await getSession();
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Matchups" />
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Statistics for this archetype are available with a free account.
          </p>
          <Link
            href={`/signup?next=/metagame/matchups/${slug}`}
            className={buttonVariants({ size: "sm" })}
          >
            Create free account
          </Link>
        </div>
      </div>
    );
  }

  const matchups = await getCombinedArchetypeMatchups(slug, 30).catch(() => []);

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
          <li aria-hidden>/</li>
          <li className="text-muted-foreground">Matchups</li>
        </ol>
      </nav>

      <PageHeader
        title={`Matchups - ${archetypeName(slug)}`}
        description={`Head-to-head win rates from Melee pairings and endstep (last 30 days).`}
      />

      {matchups.length === 0 ? (
        <div className="mt-8 text-center text-muted-foreground">
          <p>No matchup data available yet.</p>
          <p className="mt-2 text-sm">
            Run <code className="font-mono">pnpm sync:melee</code> and{" "}
            <code className="font-mono">pnpm sync:endstep</code> to populate
            matchup data.
          </p>
        </div>
      ) : (
        <section className="mt-8">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Archetype matchup win rates</caption>
              <thead className="sticky top-0 bg-muted">
                <tr className="border-bottom border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Opponent</th>
                  <th scope="col" className="px-3 py-2 font-medium">Scope</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Melee</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Endstep</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Matches</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Win rate</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {matchups.map((record) => {
                  const winPct =
                    record.win_rate != null ? record.win_rate * 100 : 0;
                  const opponentName = record.opponent_name || record.opponent_slug;
                  const meleeLabel = record.melee.matches
                    ? `${record.melee.wins}-${record.melee.losses}${
                        record.melee.draws ? `-${record.melee.draws}` : ""
                      }`
                    : "—";
                  const endstepLabel = record.endstep.matches
                    ? `${record.endstep.wins}-${record.endstep.losses}`
                    : "—";
                  const recordLabel = `${record.wins}-${record.losses}${
                    record.draws ? `-${record.draws}` : ""
                  }`;
                  return (
                    <tr
                      key={`${record.scope}-${record.opponent_slug}`}
                      className="border-bottom border-border/60 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-1.5 font-medium">
                        {opponentName}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {record.scope === "group" ? "endstep group" : "exact"}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {meleeLabel}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {endstepLabel}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {record.matches}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {winPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {recordLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Window: 30d | Sources: Melee pairings + endstep matchups</p>
            <p>
              Melee rows use exact archetype slugs. “endstep group” rows cannot
              be split into individual variants.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}