import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { EventTable } from "@/components/metagame/event-table";
import { buttonVariants } from "@/components/ui/button";
import { isMongoConfigured } from "@/lib/env";
import { listEvents } from "@/lib/metagame/queries";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Events" />
        <div className="mt-6">
          <SetupNotice title="Connect the metagame store">
            <p>
              Set <code className="font-mono text-foreground">MONGODB_URI</code>{" "}
              and run a metagame sync to load league, challenge, and paper results.
            </p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const events = await listEvents(60).catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Events"
        description="Recent Pauper events from MTGO, Melee, Cardsrealm, and MTGTop8. Open an event to browse its decklists."
        actions={
          <Link href="/metagame" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Metagame
          </Link>
        }
      />
      <div className="mt-6">
        <EventTable events={events} />
      </div>
    </div>
  );
}
