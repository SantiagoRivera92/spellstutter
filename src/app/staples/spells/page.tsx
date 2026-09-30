import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { MetagameWindowSelect } from "@/components/metagame/window-select";
import { StapleList } from "@/components/metagame/staple-list";
import { StapleTabs } from "@/components/metagame/staple-tabs";
import { isMongoConfigured } from "@/lib/env";
import { listStapleCategory } from "@/lib/metagame/queries";
import { parseMetagameWindow } from "@/lib/metagame/windows";

export const metadata: Metadata = { title: "Spell staples" };
export const dynamic = "force-dynamic";

export default async function SpellStaplesPage({
  searchParams,
}: PageProps<"/staples/spells">) {
  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Spell staples" />
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
  const { decks, cards } = await listStapleCategory(days, "spells", 100).catch(
    () => ({ decks: 0, cards: [] }),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Spell staples"
        description={`Top 100 maindeck spells and artifacts over the last ${days} days, across ${decks.toLocaleString()} decklists.`}
        actions={<MetagameWindowSelect value={days} />}
      />
      <div className="mt-4">
        <StapleTabs active="/staples/spells" />
      </div>
      <div className="mt-6">
        <StapleList title="Spells & Artifacts" cards={cards} />
      </div>
    </div>
  );
}
