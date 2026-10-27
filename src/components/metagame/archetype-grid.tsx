import Link from "next/link";
import Image from "next/image";
import type { ArchetypeOverview } from "@/lib/metagame/queries";
import { ColorPips } from "@/components/cards/color-pips";

export function ArchetypeGrid({
  archetypes,
}: {
  archetypes: ArchetypeOverview[];
}) {
  if (!archetypes.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No archetype data yet. Run the metagame sync to populate it.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {archetypes.map((archetype) => (
        <li key={archetype.slug}>
          <Link
            href={`/metagame/archetypes/${archetype.slug}`}
            className="group relative flex h-full min-h-[10rem] flex-col justify-between overflow-hidden rounded-lg border border-border bg-ink-black-950 p-4 transition-colors duration-150 hover:border-primary/60"
          >
            {archetype.art_crop ? (
              <Image
                src={archetype.art_crop}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover opacity-80 transition-[opacity,transform] duration-300 ease-out group-hover:scale-105 group-hover:opacity-100"
              />
            ) : null}
            <span
              aria-hidden
              className="absolute inset-0 bg-ink-black-950/80"
            />

            <div className="relative z-10 flex items-start justify-between gap-3">
              <h2 className="font-display text-sm font-medium text-ink-black-50">
                {archetype.name}
              </h2>
              <ColorPips
                colors={archetype.color_identity}
                size={14}
                label={false}
              />
            </div>

            <div className="relative z-10 flex items-end justify-between gap-3">
              <p className="font-display text-2xl font-bold numeric text-ink-black-50">
                {(archetype.share * 100).toFixed(1)}
                <span className="text-sm font-medium text-ink-black-200">%</span>
              </p>
              <p className="text-right text-xs numeric text-ink-black-200">
                {archetype.decks} deck{archetype.decks === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
