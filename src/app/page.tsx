import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getCardArtByName } from "@/lib/cards/queries";
import { isMongoConfigured } from "@/lib/env";

export default async function HomePage() {
  const art = isMongoConfigured()
    ? await getCardArtByName("Spellstutter Sprite").catch(() => null)
    : null;

  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-ink-black-950">
      {art ? (
        <>
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-ink-black-950/80" />
        </>
      ) : null}

      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:py-32">
        <p className="font-display text-sm font-medium text-vibrant-coral-400">
          Pauper, for Pauper players.
        </p>
        <h1 className="mt-3 font-display text-display font-bold text-ink-black-50">
          Build Pauper decks and explore the metagame
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-black-200">
          Search the full card pool, drag cards into a list, pick the exact
          printing, and start from a real archetype&apos;s core. Then see what the
          metagame is playing.
        </p>
        <div className="mt-7">
          <Link href="/decks" className={buttonVariants({ size: "lg" })}>
            Start brewing
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
