import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommentAuthor,
  Notification,
  NotificationView,
  Profile,
} from "@/lib/supabase/types";

function toAuthor(profile: Profile | undefined): CommentAuthor | null {
  if (!profile) return null;
  return {
    username: profile.username,
    display_name: profile.display_name,
    avatar_art_url: profile.avatar_art_url,
  };
}

/** Cached per request; the header only needs this once per render. */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const session = await getSession();
  if (!session) return 0;
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.id)
    .is("read_at", null);
  return count ?? 0;
});

export async function getNotifications(
  limit = 50,
): Promise<{ items: NotificationView[]; unread: number }> {
  const session = await getSession();
  if (!session) return { items: [], unread: 0 };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const notifications = (data ?? []) as Notification[];
  if (!notifications.length) return { items: [], unread: 0 };

  const actorIds = [
    ...new Set(notifications.map((item) => item.actor_id).filter(Boolean)),
  ] as string[];
  const deckIds = [
    ...new Set(notifications.map((item) => item.deck_id).filter(Boolean)),
  ] as string[];
  const commentIds = [
    ...new Set(notifications.map((item) => item.comment_id).filter(Boolean)),
  ] as string[];

  const [profilesResult, decksResult, commentsResult] = await Promise.all([
    actorIds.length
      ? supabase
          .from("profiles")
          .select("id,username,display_name,avatar_art_url")
          .in("id", actorIds)
      : Promise.resolve({ data: [] as Profile[] }),
    deckIds.length
      ? supabase.from("decks").select("id,name").in("id", deckIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    commentIds.length
      ? supabase.from("deck_comments").select("id,body").in("id", commentIds)
      : Promise.resolve({ data: [] as { id: string; body: string }[] }),
  ]);

  const profiles = new Map(
    ((profilesResult.data ?? []) as Profile[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const deckNames = new Map(
    ((decksResult.data ?? []) as { id: string; name: string }[]).map((deck) => [
      deck.id,
      deck.name,
    ]),
  );
  const commentBodies = new Map(
    ((commentsResult.data ?? []) as { id: string; body: string }[]).map(
      (comment) => [comment.id, comment.body],
    ),
  );

  const items: NotificationView[] = notifications.map((notification) => ({
    ...notification,
    actor: notification.actor_id
      ? toAuthor(profiles.get(notification.actor_id))
      : null,
    deck_name: notification.deck_id
      ? (deckNames.get(notification.deck_id) ?? null)
      : null,
    comment_body: notification.comment_id
      ? (commentBodies.get(notification.comment_id) ?? null)
      : null,
  }));

  return {
    items,
    unread: notifications.filter((item) => !item.read_at).length,
  };
}
