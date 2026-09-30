import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeckHeader } from "@/components/decks/deck-header";
import { DeckView } from "@/components/decks/deck-view";
import { CommentSection } from "@/components/decks/comment-section";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth/session";
import {
  getDeckComments,
  getDeckView,
  getFolders,
  getProfileByUserId,
} from "@/lib/decks/queries";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/decks/[deckId]">): Promise<Metadata> {
  const { deckId } = await params;
  if (!isSupabaseConfigured()) return { title: "Deck" };
  const view = await getDeckView(deckId);
  return { title: view?.deck.name ?? "Deck" };
}

export default async function DeckPage({ params }: PageProps<"/decks/[deckId]">) {
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
  const canEdit = session?.id === view.deck.user_id;
  const [owner, comments, folders] = await Promise.all([
    canEdit ? Promise.resolve(null) : getProfileByUserId(view.deck.user_id),
    getDeckComments(deckId),
    canEdit ? getFolders() : Promise.resolve([]),
  ]);

  return (
    <div>
      <DeckHeader
        view={view}
        canEdit={canEdit}
        ownerName={owner?.username}
        folders={folders}
      />
      <DeckView view={view} />
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <CommentSection
          deckId={deckId}
          comments={comments}
          canComment={Boolean(session)}
          currentUserId={session?.id ?? null}
        />
      </div>
    </div>
  );
}
