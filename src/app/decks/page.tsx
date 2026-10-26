import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LibraryBrowser } from "@/components/decks/library-browser";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { getLibrary } from "@/lib/decks/queries";
import { isMongoConfigured, isSupabaseConfigured } from "@/lib/env";
import { listArchetypes } from "@/lib/metagame/queries";
import { listEndstepArchetypes } from "@/lib/metagame/endstep";

export const metadata: Metadata = { title: "My decks" };
export const dynamic = "force-dynamic";

export default async function DecksPage({
  searchParams,
}: PageProps<"/decks">) {
  const params = await searchParams;
  const passwordUpdated = params.password === "updated";

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="My decks" />
        <div className="mt-6">
          <SetupNotice title="Connect Supabase" icon="key">
            <p>
              Set <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              in <code className="font-mono text-foreground">.env.local</code>,
              then apply the migrations in{" "}
              <code className="font-mono text-foreground">supabase/migrations</code>.
            </p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const library = await getLibrary();
  if (!library) {
    redirect("/login?next=/decks");
  }

  const archetypes = isMongoConfigured()
    ? await listArchetypes().catch(() => [])
    : [];
  const endstepArchetypes = isMongoConfigured()
    ? await listEndstepArchetypes().catch(() => [])
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {passwordUpdated ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          Your password has been updated.
        </p>
      ) : null}
      <PageHeader
        title="My decks"
        description="Group decks into nested folders. Start from scratch or seed a list from an archetype's core."
      />
      <div className="mt-6">
        <LibraryBrowser
          folders={library.folders}
          decks={library.decks}
          archetypes={archetypes}
          endstepArchetypes={endstepArchetypes}
          openNewDeck={params.new === "1"}
        />
      </div>
    </div>
  );
}
