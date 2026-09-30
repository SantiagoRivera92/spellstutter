import Image from "next/image";
import { cn } from "@/lib/utils";
import type { CardColor } from "@/lib/cards/types";
import { COLOR_NAMES, MANA_SYMBOL_URL, sortColors } from "@/lib/cards/mana";

export function ColorPips({
  colors,
  size = 16,
  className,
  label = true,
}: {
  colors: CardColor[];
  size?: number;
  className?: string;
  label?: boolean;
}) {
  const sorted = sortColors(colors);
  const symbols: (CardColor | "C")[] = sorted.length ? sorted : ["C"];
  const description = sorted.length
    ? sorted.map((color) => COLOR_NAMES[color]).join(", ")
    : "Colorless";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-0.5", className)}
      aria-label={label ? description : undefined}
      aria-hidden={label ? undefined : true}
      title={description}
    >
      {symbols.map((symbol) => (
        <Image
          key={symbol}
          src={MANA_SYMBOL_URL[symbol]}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="shrink-0"
        />
      ))}
    </span>
  );
}
