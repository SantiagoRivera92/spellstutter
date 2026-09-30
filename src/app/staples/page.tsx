import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { MetagameWindowSelect } from "@/components/metagame/window-select";
import { StapleList } from "@/components/metagame/staple-list";
import { StapleTabs } from "@/components/metagame/staple-tabs";
import { isMongoConfigured } from "@/lib/env";
import { listStaples } from "@/lib/metagame/queries";
import { parseMetagameWindow } from "@/lib/metagame/windows";

export const metadata: Metadata = { title: "Staples" };
export const dynamic = "force-dynamic";

export default async function StaplesPage({ searchParams }: PageProps<"/staples">) {
  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Staples" />
        <div className="mt-6">
          <SetupNotice title="Connect the metagame store">
            <p>
              Set <code className="font-mono text-foreground">MONGODB_URI</code>{" "}
              and run the MTGO sync to load league and challenge results.
            </p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const days = parseMetagameWindow(
    typeof params.window === "string" ? params.window : undefined,
  );
  const staples = await listStaples(days, 10).catch(() => ({
    decks: 0,
    creatures: [],
    noncreatures: [],
    lands: [],
    sideboard: [],
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Staples"
        description={`The most-played cards over the last ${days} days, across ${staples.decks.toLocaleString()} decklists.`}
        actions={<MetagameWindowSelect value={days} />}
      />
      <div className="mt-4">
        <StapleTabs active="/staples" />
      </div>

      <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <StapleList
          title="Creatures"
          cards={staples.creatures}
          href="/staples/creatures"
        />
        <StapleList
          title="Spells & Artifacts"
          cards={staples.noncreatures}
          href="/staples/spells"
        />
        <StapleList title="Lands" cards={staples.lands} href="/staples/lands" />
        <StapleList
          title="Sideboard"
          cards={staples.sideboard}
          href="/staples/sideboard"
        />
      </div>
    </div>
  );
}
