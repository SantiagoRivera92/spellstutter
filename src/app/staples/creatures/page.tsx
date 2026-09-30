import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { MetagameWindowSelect } from "@/components/metagame/window-select";
import { StapleList } from "@/components/metagame/staple-list";
import { StapleTabs } from "@/components/metagame/staple-tabs";
import { isMongoConfigured } from "@/lib/env";
import { listStapleCategory } from "@/lib/metagame/queries";
import { parseMetagameWindow } from "@/lib/metagame/windows";

export const metadata: Metadata = { title: "Creature staples" };
export const dynamic = "force-dynamic";

export default async function CreatureStaplesPage({
  searchParams,
}: PageProps<"/staples/creatures">) {
  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Creature staples" />
        <div className="mt-6">
          <SetupNotice title="Connect the metagame store">
            <p>Configure MongoDB and run the MTGO sync to view staples.</p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const days = parseMetagameWindow(
    typeof params.window === "string" ? params.window : undefined,
  );
  const { decks, cards } = await listStapleCategory(days, "creatures", 100).catch(
    () => ({ decks: 0, cards: [] }),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Creature staples"
        description={`Top 100 maindeck creatures over the last ${days} days, across ${decks.toLocaleString()} decklists.`}
        actions={<MetagameWindowSelect value={days} />}
      />
      <div className="mt-4">
        <StapleTabs active="/staples/creatures" />
      </div>
      <div className="mt-6">
        <StapleList title="Creatures" cards={cards} />
      </div>
    </div>
  );
}
