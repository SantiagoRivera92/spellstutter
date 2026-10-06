import type { CardColor } from "./types";

export const COLOR_ORDER: CardColor[] = ["W", "U", "B", "R", "G"];

export const COLOR_NAMES: Record<CardColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

/** Scryfall-hosted official mana symbol SVGs. */
export const MANA_SYMBOL_URL: Record<CardColor | "C", string> = {
  W: "https://svgs.scryfall.io/card-symbols/W.svg",
  U: "https://svgs.scryfall.io/card-symbols/U.svg",
  B: "https://svgs.scryfall.io/card-symbols/B.svg",
  R: "https://svgs.scryfall.io/card-symbols/R.svg",
  G: "https://svgs.scryfall.io/card-symbols/G.svg",
  C: "https://svgs.scryfall.io/card-symbols/C.svg",
};

export function sortColors(colors: CardColor[]): CardColor[] {
  return COLOR_ORDER.filter((color) => colors.includes(color));
}

export interface ParsedManaSymbol {
  kind: "generic" | "color" | "hybrid" | "phyrexian" | "variable" | "snow" | "colorless";
  value: string;
  colors: CardColor[];
}

const COLOR_LETTERS = new Set(["W", "U", "B", "R", "G"]);

export function parseManaCost(manaCost: string | null | undefined): ParsedManaSymbol[] {
  if (!manaCost) return [];
  const matches = manaCost.match(/\{[^}]+\}/g) ?? [];
  return matches.map((raw) => {
    const value = raw.slice(1, -1).toUpperCase();
    const colors = value
      .split("/")
      .filter((part): part is CardColor => COLOR_LETTERS.has(part));
    if (/^\d+$/.test(value)) return { kind: "generic", value, colors };
    if (value === "X" || value === "Y" || value === "Z") {
      return { kind: "variable", value, colors };
    }
    if (value === "C") return { kind: "colorless", value, colors };
    if (value === "S") return { kind: "snow", value, colors };
    if (value.includes("P")) return { kind: "phyrexian", value, colors };
    if (value.includes("/")) return { kind: "hybrid", value, colors };
    return { kind: "color", value, colors };
  });
}

/**
 * Colours a card contributes to a deck's archetype identity. Hybrid (`{U/R}`)
 * and Phyrexian (`{G/P}`) symbols are ignored, since they can be paid without
 * committing to that colour (e.g. Abandon Attachments in a Dimir deck). Falls
 * back to the card's printed colours when there is no mana cost to parse.
 */
export function identityColors(
  manaCost: string | null | undefined,
  fallback: CardColor[],
): CardColor[] {
  if (!manaCost) return fallback;
  const symbols = parseManaCost(manaCost);
  if (!symbols.length) return fallback;
  const set = new Set<CardColor>();
  for (const symbol of symbols) {
    if (symbol.kind === "hybrid" || symbol.kind === "phyrexian") continue;
    for (const color of symbol.colors) set.add(color);
  }
  return [...set];
}

export function manaValueBucket(manaValue: number): string {
  if (manaValue <= 1) return "1 or less";
  if (manaValue <= 2) return "2";
  if (manaValue <= 3) return "3";
  if (manaValue <= 4) return "4";
  if (manaValue <= 5) return "5";
  return "6+";
}
