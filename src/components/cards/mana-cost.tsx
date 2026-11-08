import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { parseManaCost } from "@/lib/cards/mana";

const SYMBOL_BASE = "https://svgs.scryfall.io/card-symbols";

/** `{W/U}` -> `WU`, `{∞}` -> `INF`, `{½}` -> `H`, matching Scryfall file names. */
function symbolFile(value: string): string {
  if (value === "∞") return "INF";
  if (value === "½") return "H";
  return value.toUpperCase().replace(/\//g, "");
}

function symbolUrl(value: string): string {
  return `${SYMBOL_BASE}/${symbolFile(value)}.svg`;
}

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
      role="img"
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
              src={symbolUrl(symbol.value)}
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

/**
 * Oracle text with inline mana symbols, e.g. Ninja of the Deep Hours'
 * "{1}{U}: Draw a card." renders the {1} and {U} as symbols.
 */
export function ManaText({
  text,
  className,
  size = 14,
}: {
  text: string;
  className?: string;
  size?: number;
}) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const match = /^\{([^}]+)\}$/.exec(part);
        if (!match) {
          return <React.Fragment key={index}>{part}</React.Fragment>;
        }
        return (
          <Image
            key={index}
            src={symbolUrl(match[1])}
            alt={part}
            width={size}
            height={size}
            unoptimized
            className="mx-0.5 inline-block shrink-0 align-[-0.15em]"
          />
        );
      })}
    </span>
  );
}
