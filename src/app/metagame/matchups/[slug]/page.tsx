import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/env";
import { getArchetypeMatchups } from "@/lib/metagame/queries";
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

  const matchups = await getArchetypeMatchups(slug, 30).catch(() => []);

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
        description={`Head-to-head win rates against other archetypes (last 30 days).`}
      />

      {matchups.length === 0 ? (
        <div className="mt-8 text-center text-muted-foreground">
          <p>No matchup data available yet.</p>
          <p className="mt-2 text-sm">
            Run <code className="font-mono">pnpm sync:endstep</code> to populate
            endstep metagame data.
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
                  <th scope="col" className="px-3 py-2 text-right font-medium">Matches</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Win rate</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Record</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Deff</th>
                </tr>
              </thead>
              <tbody>
                {matchups.map((record) => {
                  const m = record.match;
                  const total = m.wins + m.losses;
                  const winPct = total > 0 ? (m.wins / total) * 100 : 0;
                  const opponentName =
                    m.opponent_name || m.opponent_slug || m.opponent_id;
                  return (
                    <tr
                      key={m.opponent_slug || m.opponent_id || opponentName}
                      className="border-bottom border-border/60 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-1.5 font-medium">
                        {opponentName}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {m.matches}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {winPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {`${m.wins}-${m.losses}`}
                      </td>
                      <td className="px-3 py-1.5 text-right numeric">
                        {m.deff != null ? m.deff.toFixed(2) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Window: {matchups[0]?.window ?? "30d"} | Population: {matchups[0]?.population ?? "rated"}</p>
            <p>Data refreshed: {matchups[0]?.fetched_at ? new Date(matchups[0].fetched_at).toLocaleDateString() : "—"}</p>
          </div>
        </section>
      )}
    </div>
  );
}