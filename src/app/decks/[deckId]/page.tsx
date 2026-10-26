import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeckHeader } from "@/components/decks/deck-header";
import { DeckView } from "@/components/decks/deck-view";
import { DeckTabs } from "@/components/decks/deck-tabs";
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
import { getEndstepArchetype } from "@/lib/metagame/endstep";

const ENDSTEP_PREFIX = "endstep:";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/decks/[deckId]">): Promise<Metadata> {
  const { deckId } = await params;
  if (!isSupabaseConfigured()) return { title: "Deck" };
  const view = await getDeckView(deckId).catch(() => null);
  const title = view?.deck.name ?? "Deck";
  const description =
    view?.deck.description ?? "A Pauper deck on Spellstutter.";
  const image = view?.deck.cover_art_url ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
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
  const archetypeSlug = view.deck.archetype_slug;
  const [owner, comments, folders, endstepArchetype] = await Promise.all([
    canEdit ? Promise.resolve(null) : getProfileByUserId(view.deck.user_id),
    getDeckComments(deckId),
    canEdit ? getFolders() : Promise.resolve([]),
    archetypeSlug?.startsWith(ENDSTEP_PREFIX)
      ? getEndstepArchetype(
          archetypeSlug.slice(ENDSTEP_PREFIX.length),
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <DeckHeader
        view={view}
        canEdit={canEdit}
        ownerName={owner?.username}
        folders={folders}
        archetypeLabel={endstepArchetype?.name}
      />
      <DeckTabs
        defaultTab="list"
        tabs={[
          {
            id: "list",
            label: "List",
            content: <DeckView view={view} />,
          },
          {
            id: "primer",
            label: "Primer",
            content: (
              <div className="mx-auto max-w-3xl px-4 py-8">
                <h2 className="font-display text-base font-medium">Primer</h2>
                {view.deck.description?.trim() ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {view.deck.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {canEdit
                      ? "Add a primer from the deck details dialog — cover your game plan, key interactions, and sideboard map."
                      : "The author hasn't written a primer for this deck yet."}
                  </p>
                )}
              </div>
            ),
          },
          {
            id: "comments",
            label: "Comments",
            content: (
              <div className="mx-auto max-w-6xl px-4 py-8">
                <CommentSection
                  deckId={deckId}
                  comments={comments}
                  canComment={Boolean(session)}
                  currentUserId={session?.id ?? null}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
