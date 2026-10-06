import { getSession } from "@/lib/auth/session";
import { MobileTabBarNav } from "./mobile-tab-bar-nav";

export async function MobileTabBar() {
  const session = await getSession();
  const profileHref = session?.profile?.username
    ? `/users/${session.profile.username}`
    : "/login";
  return <MobileTabBarNav profileHref={profileHref} />;
}
