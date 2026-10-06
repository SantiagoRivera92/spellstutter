import type { CardColor } from "./types";
import { COLOR_ORDER } from "./mana";

/**
 * A practical subset of Scryfall search syntax, parsed against the local Mongo
 * catalog (used by `/api/cards/search`). Note the deckbuilder UI instead proxies
 * live Scryfall results, so this parser is only on the Mongo-backed path.
 *
 * Supported filters:
 *
 *   lightning bolt        name terms (all must match)
 *   !"Counterspell"       exact name
 *   t:creature            type line contains
 *   o:"draw a card"       oracle text contains
 *   c:ub                  card colors (matches cards containing any listed color)
 *   id:wu                 color identity is a subset of the listed colors
 *   cmc<=3  mv>=4         mana value bounds
 *   r:common              rarity
 *   kw:flying             keyword
 */
export interface ParsedQuery {
  nameTerms: string[];
  exactName: string | null;
  types: string[];
  oracleTerms: string[];
  colors: CardColor[];
  colorIdentity: CardColor[];
  keywords: string[];
  rarities: string[];
  cmcMin: number | null;
  cmcMax: number | null;
  errors: string[];
}

const COLOR_ALIASES: Record<string, CardColor> = {
  w: "W",
  white: "W",
  u: "U",
  blue: "U",
  b: "B",
  black: "B",
  r: "R",
  red: "R",
  g: "G",
  green: "G",
};

const RARITIES = new Set(["common", "uncommon", "rare", "mythic"]);

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const regex = /(?:[^\s"]+|"[^"]*")+/g;
  const matches = input.match(regex);
  if (!matches) return tokens;
  for (const raw of matches) {
    tokens.push(raw);
  }
  return tokens;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseColors(value: string, errors: string[]): CardColor[] {
  const letters = value.toUpperCase().replace(/[^WUBRG]/g, "");
  const colors: CardColor[] = [];
  for (const entry of Object.keys(COLOR_ALIASES)) {
    if (value.toLowerCase() === entry) {
      const mapped = COLOR_ALIASES[entry];
      if (!colors.includes(mapped)) colors.push(mapped);
      return colors;
    }
  }
  for (const letter of letters) {
    const color = letter as CardColor;
    if (!colors.includes(color)) colors.push(color);
  }
  if (!colors.length) errors.push(`Unknown color filter "${value}"`);
  return colors;
}

export function parseQuery(input: string): ParsedQuery {
  const parsed: ParsedQuery = {
    nameTerms: [],
    exactName: null,
    types: [],
    oracleTerms: [],
    colors: [],
    colorIdentity: [],
    keywords: [],
    rarities: [],
    cmcMin: null,
    cmcMax: null,
    errors: [],
  };

  for (const token of tokenize(input)) {
    const exactMatch = token.match(/^!"?(.+?)"?$/);
    if (exactMatch) {
      parsed.exactName = unquote(exactMatch[1]);
      continue;
    }

    const comparison = token.match(/^(cmc|mv)(<=|>=|=|<|>)(\d+(?:\.\d+)?)$/i);
    if (comparison) {
      const value = Number.parseFloat(comparison[3]);
      const operator = comparison[2];
      if (operator === "<=") parsed.cmcMax = value;
      else if (operator === ">=") parsed.cmcMin = value;
      else if (operator === "<") parsed.cmcMax = value - 0.5;
      else if (operator === ">") parsed.cmcMin = value + 0.5;
      else {
        parsed.cmcMin = value;
        parsed.cmcMax = value;
      }
      continue;
    }

    const field = token.match(
      /^(t|type|o|oracle|c|color|id|identity|r|rarity|kw|keyword):"?(.+?)"?$/i,
    );
    if (field) {
      const key = field[1].toLowerCase();
      const value = unquote(field[2]);
      if (!value) {
        parsed.errors.push(`Filter "${key}:" needs a value`);
        continue;
      }
      if (key === "t" || key === "type") parsed.types.push(value);
      else if (key === "o" || key === "oracle") parsed.oracleTerms.push(value);
      else if (key === "c" || key === "color")
        parsed.colors.push(...parseColors(value, parsed.errors));
      else if (key === "id" || key === "identity")
        parsed.colorIdentity.push(...parseColors(value, parsed.errors));
      else if (key === "r" || key === "rarity") {
        if (RARITIES.has(value.toLowerCase()))
          parsed.rarities.push(value.toLowerCase());
        else parsed.errors.push(`Unknown rarity "${value}"`);
      } else if (key === "kw" || key === "keyword") parsed.keywords.push(value);
      continue;
    }

    if (/^(legal|banned|f):/i.test(token)) continue; // implied by Pauper-only data

    parsed.nameTerms.push(unquote(token));
  }

  parsed.colors = COLOR_ORDER.filter((color) => parsed.colors.includes(color));
  parsed.colorIdentity = COLOR_ORDER.filter((color) =>
    parsed.colorIdentity.includes(color),
  );
  return parsed;
}

export function isQueryEmpty(parsed: ParsedQuery): boolean {
  return (
    !parsed.exactName &&
    !parsed.nameTerms.length &&
    !parsed.types.length &&
    !parsed.oracleTerms.length &&
    !parsed.colors.length &&
    !parsed.colorIdentity.length &&
    !parsed.keywords.length &&
    !parsed.rarities.length &&
    parsed.cmcMin == null &&
    parsed.cmcMax == null
  );
}
