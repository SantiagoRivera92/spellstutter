import { normalizeName } from "@/lib/cards/normalize-name";

/**
 * MTGO occasionally uses a different name for a card than Scryfall. The digital
 * set "Through the Omenpaths" (om1) is the main case: Scryfall lists it under
 * the paper Spider-Man names, while MTGO ships reskinned names.
 *
 * Keys and values are full card names; matching is done on normalized names.
 * Values are the canonical names we display, so the metagame shows the
 * Marvel's Spider-Man version rather than the MTGO reskin.
 */
export const MTGO_CARD_ALIASES: Record<string, string> = {
  "Darval, Whose Web Protects": "Spider-Man, Web-Slinger",
  "Wonderweave Aerialist": "Skyward Spider",
  "Leyline Weaver": "Spider Manifestation",
  "Skittering Kitten": "Masked Meower",
  "Wekhdu, Midnight Hunter": "Swarm, Being of Bees",
};

const ALIAS_KEYS = new Set(Object.keys(MTGO_CARD_ALIASES).map(normalizeName));

/** Whether this (MTGO) name is a reskin we display under its canonical name. */
export function isMtgoCardAlias(name: string): boolean {
  return ALIAS_KEYS.has(normalizeName(name));
}
