import Image from "next/image";
import { cn } from "@/lib/utils";
import { parseManaCost } from "@/lib/cards/mana";

const SYMBOL_BASE = "https://svgs.scryfall.io/card-symbols";

export function ManaCost({
  cost,
  className,
  size = 16,
}: {
  cost: string | string[] | null | undefined;
  className?: string;
  size?: number;
}) {
  const costs = (Array.isArray(cost) ? cost : cost ? [cost] : [])
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!costs.length) return null;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 align-middle", className)}
      aria-label={`Mana cost ${costs.join(" // ")}`}
    >
      {costs.map((group, groupIndex) => (
        <span
          key={`${group}-${groupIndex}`}
          className="inline-flex items-center gap-0.5"
        >
          {groupIndex > 0 ? (
            <span aria-hidden className="px-0.5 text-xs text-muted-foreground">
              {"//"}
            </span>
          ) : null}
          {parseManaCost(group).map((symbol, index) => (
            <Image
              key={`${symbol.value}-${index}`}
              src={`${SYMBOL_BASE}/${symbol.value.replace(/\//g, "")}.svg`}
              alt=""
              width={size}
              height={size}
              unoptimized
              className="shrink-0"
            />
          ))}
        </span>
      ))}
    </span>
  );
}
