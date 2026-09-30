import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { ArchetypeGrid } from "@/components/metagame/archetype-grid";
import { MetagameWindowSelect } from "@/components/metagame/window-select";
import { buttonVariants } from "@/components/ui/button";
import { isMongoConfigured } from "@/lib/env";
import { listArchetypeOverview } from "@/lib/metagame/queries";
import { parseMetagameWindow } from "@/lib/metagame/windows";

export const metadata: Metadata = { title: "Metagame" };
export const dynamic = "force-dynamic";

export default async function MetagamePage({
  searchParams,
}: PageProps<"/metagame">) {
  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Metagame" />
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

  const archetypes = await listArchetypeOverview(days).catch(() => []);
  const totalDecks = archetypes.reduce((sum, entry) => sum + entry.decks, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Metagame"
        description={`Every archetype from the last ${days} days, sorted by metagame share. ${totalDecks.toLocaleString()} decklists.`}
        actions={
          <div className="flex items-center gap-3">
            <MetagameWindowSelect value={days} />
            <Link
              href="/events"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Recent events
            </Link>
          </div>
        }
      />
      <div className="mt-6">
        <ArchetypeGrid archetypes={archetypes} />
      </div>
    </div>
  );
}
