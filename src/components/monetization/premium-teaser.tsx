import { buttonVariants } from "@/components/ui/button";
import {
  donationUrl,
  isPatreonOAuthEnabled,
} from "@/lib/monetization/flags";

export function PremiumTeaser({
  title = "Premium analytics",
  description = "Matchups and advanced archetype statistics are available to Patreon supporters.",
}: {
  title?: string;
  description?: string;
}) {
  const supportUrl = donationUrl();
  const patreon = isPatreonOAuthEnabled();

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-base font-medium">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {patreon ? (
          <a
            href="/api/patreon/connect"
            className={buttonVariants({ size: "sm" })}
          >
            Connect Patreon
          </a>
        ) : null}
        {supportUrl ? (
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Support on Patreon
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Already a supporter? Connect Patreon so we can verify your membership.
        The core deckbuilder and metagame lists stay free.
      </p>
    </section>
  );
}
