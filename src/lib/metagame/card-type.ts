export type DeckCategory =
  | "Creatures"
  | "Spells"
  | "Artifacts"
  | "Enchantments"
  | "Other"
  | "Lands";

/** Display order for a decklist. Lands are always last. */
export const CATEGORY_ORDER: DeckCategory[] = [
  "Creatures",
  "Spells",
  "Artifacts",
  "Enchantments",
  "Other",
  "Lands",
];

/**
 * Front-face type line only. Double-faced cards store both faces joined by
 * " // "; a card's type is always determined by its front face (e.g. The
 * Modern Age is an Enchantment, not the Creature it transforms into).
 */
export function frontFace(typeLine: string | null | undefined): string {
  const value = typeLine ?? "";
  const index = value.indexOf(" // ");
  return index === -1 ? value : value.slice(0, index);
}

/**
 * Which decklist section a card belongs to.
 *
 * Precedence matches the format rules:
 *   - creature + artifact  -> Creatures
 *   - artifact + land      -> Lands
 *   - instant / sorcery    -> Spells
 */
export function categoryFor(typeLine: string | null | undefined): DeckCategory {
  const type = frontFace(typeLine).toLowerCase();
  if (!type) return "Other";
  if (type.includes("creature")) return "Creatures";
  if (type.includes("land")) return "Lands";
  if (type.includes("instant") || type.includes("sorcery")) return "Spells";
  if (type.includes("artifact")) return "Artifacts";
  if (type.includes("enchantment")) return "Enchantments";
  return "Other";
}
