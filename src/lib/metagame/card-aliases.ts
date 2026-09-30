/**
 * MTGO occasionally uses a different name for a card than Scryfall. The digital
 * set "Through the Omenpaths" (om1) is the main case: Scryfall lists it under
 * the paper Spider-Man names, while MTGO ships reskinned names.
 *
 * Keys and values are full card names; matching is done on normalized names.
 */
export const MTGO_CARD_ALIASES: Record<string, string> = {
  "Darval, Whose Web Protects": "Spider-Man, Web-Slinger",
  "Wonderweave Aerialist": "Skyward Spider",
  "Leyline Weaver": "Spider Manifestation",
};
