import { getSession } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";
import { HeaderNav, type HeaderSession } from "./header-nav";

export async function SiteHeader() {
  const session = await getSession();
  const unread = session ? await getUnreadNotificationCount() : 0;

  const headerSession: HeaderSession | null = session
    ? {
        username: session.profile?.username ?? "planeswalker",
        displayName:
          session.profile?.display_name ??
          session.profile?.username ??
          session.email,
        avatarArtUrl: session.profile?.avatar_art_url ?? null,
      }
    : null;

  return <HeaderNav session={headerSession} unread={unread} />;
}
