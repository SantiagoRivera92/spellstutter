import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  donationLabel,
  donationUrl,
  isPatreonOAuthEnabled,
} from "@/lib/monetization/flags";
import { getPatreonSupporter } from "@/lib/monetization/supporter";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const url = donationUrl();
  if (!url) notFound();

  const patreon = isPatreonOAuthEnabled();
  const supporter = patreon ? await getPatreonSupporter() : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Support Spellstutter"
        description="Spellstutter is a free, independent Pauper project. Patreon support covers servers, card data, and new tools."
      />
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Patreon support unlocks premium analytics: the full matchup table,
          win-rate breakdowns, and advanced archetype statistics. The core
          deckbuilder, card search, decklists, exports, and basic metagame
          lists stay free.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ className: "mt-4" })}
        >
          {donationLabel()}
        </a>
      </div>

      {patreon ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-base font-medium">
            Link your Patreon account
          </h2>
          {supporter?.connected ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {supporter.active
                ? `Connected${supporter.tierTitle ? ` · ${supporter.tierTitle}` : ""}. Thank you for supporting Spellstutter.`
                : "Connected, but no active membership was found for this campaign."}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Connect Patreon to verify your membership, unlock premium
              analytics, and show your supporter badge.
            </p>
          )}
          <a
            href="/api/patreon/connect"
            className={buttonVariants({
              variant: "outline",
              className: "mt-3",
            })}
          >
            {supporter?.connected ? "Refresh Patreon status" : "Connect Patreon"}
          </a>
        </div>
      ) : null}
    </div>
  );
}
