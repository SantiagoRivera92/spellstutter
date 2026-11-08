import { getSession } from "@/lib/auth/session";
import { isPatreonOAuthEnabled } from "@/lib/monetization/flags";
import { getPatreonSupporter } from "@/lib/monetization/supporter";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";
import { HeaderNav, type HeaderSession } from "./header-nav";

export async function SiteHeader() {
  const session = await getSession();
  const patreon = isPatreonOAuthEnabled();
  const [unread, supporter] = await Promise.all([
    session ? getUnreadNotificationCount() : 0,
    patreon ? getPatreonSupporter() : null,
  ]);

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

  return (
    <HeaderNav
      session={headerSession}
      unread={unread}
      supporterTier={
        session && supporter?.active
          ? (supporter.tierTitle ?? "Supporter")
          : null
      }
    />
  );
}
