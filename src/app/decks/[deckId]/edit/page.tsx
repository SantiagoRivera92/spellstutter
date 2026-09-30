import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeckEditor } from "@/components/decks/deck-editor";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth/session";
import { getDeckView } from "@/lib/decks/queries";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Brew a deck" };
export const dynamic = "force-dynamic";

export default async function EditDeckPage({
  params,
}: PageProps<"/decks/[deckId]/edit">) {
  const { deckId } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SetupNotice title="Connect Supabase" icon="key">
          <p>Deck data lives in Postgres. Configure Supabase to continue.</p>
        </SetupNotice>
      </div>
    );
  }

  const view = await getDeckView(deckId);
  if (!view) notFound();

  const session = await getSession();
  if (!session || session.id !== view.deck.user_id) {
    redirect(`/decks/${deckId}`);
  }

  return (
    <DeckEditor
      view={view}
      username={session.profile?.username ?? "planeswalker"}
    />
  );
}
