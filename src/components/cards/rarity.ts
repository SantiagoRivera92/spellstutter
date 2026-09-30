export const RARITY_LABEL: Record<string, string> = {
  common: "C",
  uncommon: "U",
  rare: "R",
  mythic: "M",
  special: "S",
  bonus: "B",
};

export const RARITY_CLASS: Record<string, string> = {
  common: "text-muted-foreground",
  uncommon: "text-twilight-indigo-400",
  rare: "text-toffee-brown-400",
  mythic: "text-vibrant-coral-400",
};

export function rarityClass(rarity: string): string {
  return RARITY_CLASS[rarity] ?? "text-muted-foreground";
}
