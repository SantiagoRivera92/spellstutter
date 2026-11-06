"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2 } from "lucide-react";
import { cloneMetagameDeck } from "@/lib/decks/actions";
import { Button } from "@/components/ui/button";

export function EventDeckActions({
  eventSlug,
  player,
  sharePath,
  shareTitle,
}: {
  eventSlug: string;
  player: string;
  sharePath: string;
  shareTitle: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cloning, startClone] = React.useTransition();

  async function share() {
    setError(null);
    const url = `${window.location.origin}${sharePath}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch (shareError) {
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link.");
    }
  }

  function cloneDeck() {
    setError(null);
    startClone(async () => {
      const result = await cloneMetagameDeck({
        eventSlug,
        player,
      });
      if (result.ok && result.deckId) {
        router.push(`/decks/${result.deckId}/edit`);
        return;
      }
      if (!result.ok) {
        if (result.error === "unauthenticated") {
          router.push(`/login?next=${encodeURIComponent(sharePath)}`);
        } else if (result.error === "migration_required") {
          setError("The database is missing the latest migration.");
        } else {
          setError("Could not clone this deck.");
        }
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={share}
          aria-label={copied ? "Link copied" : "Share deck link"}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Share2 className="size-4" aria-hidden />
          )}
          {copied ? "Link copied" : "Share"}
        </Button>
        <Button onClick={cloneDeck} disabled={cloning}>
          <Copy className="size-4" aria-hidden />
          {cloning ? "Cloning…" : "Clone to my decks"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
