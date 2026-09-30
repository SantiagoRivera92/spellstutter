import Image from "next/image";
import Link from "next/link";
import type { StapleCard } from "@/lib/metagame/queries";
import { cn } from "@/lib/utils";

export function StapleList({
  title,
  cards,
  href,
}: {
  title: string;
  cards: StapleCard[];
  href?: string;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="text-xs font-medium text-primary hover:underline"
          >
            Top 100 →
          </Link>
        ) : null}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for this window.</p>
      ) : (
        <ol className="overflow-hidden rounded-lg border border-border">
          {cards.map((card, index) => {
            const hasArt = Boolean(card.art_crop);
            return (
              <li
                key={card.name}
                className={cn(
                  "group relative h-16 overflow-hidden border-b border-border last:border-0 sm:h-20",
                  !hasArt && "bg-card",
                )}
              >
                {hasArt ? (
                  <>
                    <Image
                      src={card.art_crop!}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition-transform duration-150 group-hover:scale-[1.03] motion-reduce:transform-none"
                      unoptimized
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-ink-black-950/70"
                    />
                  </>
                ) : null}
                <span
                  className={cn(
                    "relative z-10 flex h-full items-center gap-3 px-4",
                    hasArt && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]",
                  )}
                >
                  <span
                    className={cn(
                      "w-7 shrink-0 font-display text-lg font-bold numeric",
                      hasArt ? "text-ink-black-100/80" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-display text-base font-semibold leading-tight",
                        hasArt ? "text-ink-black-50" : "text-foreground",
                      )}
                    >
                      {card.oracle_id ? (
                        <Link
                          href={`/cards/${card.oracle_id}`}
                          className={hasArt ? "hover:underline" : "hover:text-primary"}
                        >
                          {card.name}
                        </Link>
                      ) : (
                        card.name
                      )}
                    </span>
                    {card.type_line ? (
                      <span
                        className={cn(
                          "mt-0.5 block truncate text-xs",
                          hasArt ? "text-ink-black-200" : "text-muted-foreground",
                        )}
                      >
                        {card.type_line}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={cn(
                        "block font-display text-base font-bold numeric leading-none",
                        hasArt ? "text-ink-black-50" : "text-foreground",
                      )}
                    >
                      {(card.inclusion * 100).toFixed(0)}%
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[10px] uppercase tracking-wide",
                        hasArt
                          ? "text-ink-black-200/80"
                          : "text-muted-foreground",
                      )}
                    >
                      of decks
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
