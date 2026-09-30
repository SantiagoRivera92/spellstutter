import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Profile settings" };
export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Settings" />
        <div className="mt-6">
          <SetupNotice title="Connect Supabase" icon="key">
            <p>Profiles are stored in Postgres. Configure Supabase to continue.</p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/settings/profile");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Profile settings"
        description="Your display name, bio, and avatar are shown on public decks and your profile page."
      />
      <div className="mt-6">
        {session.profile ? (
          <ProfileSettings profile={session.profile} />
        ) : (
          <SetupNotice title="Profile not provisioned">
            <p>
              This account has no profile row yet. Re-run the init migration so
              the <code className="font-mono text-foreground">handle_new_user</code>{" "}
              trigger is installed.
            </p>
          </SetupNotice>
        )}
      </div>
    </div>
  );
}
