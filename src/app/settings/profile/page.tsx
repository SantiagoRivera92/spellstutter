import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { SetupNotice } from "@/components/setup-notice";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import {
  donationUrl,
  isPatreonOAuthEnabled,
} from "@/lib/monetization/flags";
import { getPatreonSupporter } from "@/lib/monetization/supporter";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Profile settings" };
export const dynamic = "force-dynamic";

export default async function SettingsProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ patreon?: string }>;
}) {
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

  const params = await searchParams;
  const patreonEnabled = isPatreonOAuthEnabled();
  const supporter = patreonEnabled ? await getPatreonSupporter() : null;
  const supportUrl = donationUrl();

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

        {patreonEnabled || supportUrl ? (
          <section className="mt-6 rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-base font-medium">
              Patreon support
            </h2>
            {params.patreon === "connected" ? (
              <p className="mt-2 text-sm text-primary">
                Patreon connected.
              </p>
            ) : params.patreon === "error" ||
              params.patreon === "state_error" ||
              params.patreon === "denied" ? (
              <p className="mt-2 text-sm text-destructive">
                Could not connect Patreon. Try again.
              </p>
            ) : null}
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Linking Patreon verifies your membership, unlocks premium
              analytics, and shows a supporter badge. The core deckbuilder
              stays free.
            </p>
            {supporter?.connected ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {supporter.active
                  ? `Supporting${supporter.tierTitle ? ` at ${supporter.tierTitle}` : ""}. Thank you!`
                  : "No active membership found for this campaign."}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {patreonEnabled ? (
                <a
                  href="/api/patreon/connect"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {supporter?.connected
                    ? "Refresh Patreon status"
                    : "Connect Patreon"}
                </a>
              ) : null}
              {supportUrl ? (
                <a
                  href={supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm" })}
                >
                  Support on Patreon
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
