import type { CardColor } from "@/lib/cards/types";
import { COLOR_ORDER, manaValueBucket } from "@/lib/cards/mana";
import { frontFace } from "@/lib/metagame/card-type";
import type { DeckStats } from "./types";
import type { DeckCardView } from "./types";

export function deriveCategory(typeLine: string): DeckCardView["category_group"] {
  const type = frontFace(typeLine).toLowerCase();
  if (type.includes("creature")) return "Creature";
  if (type.includes("planeswalker")) return "Planeswalker";
  if (type.includes("land")) return "Land";
  if (type.includes("instant")) return "Instant";
  if (type.includes("sorcery")) return "Sorcery";
  if (type.includes("enchantment")) return "Enchantment";
  if (type.includes("artifact")) return "Artifact";
  if (type.includes("battle")) return "Battle";
  return "Other";
}

export const CATEGORY_ORDER: DeckCardView["category_group"][] = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Battle",
  "Land",
  "Other",
];

export function computeDeckStats(cards: DeckCardView[]): DeckStats {
  let mainCount = 0;
  let sideCount = 0;
  let totalPrice = 0;
  let manaValueSum = 0;
  let nonLandCount = 0;
  const curveMap = new Map<string, number>();
  const colorMap = new Map<CardColor, number>();

  for (const card of cards) {
    const quantity = card.quantity;
    if (card.board === "main") mainCount += quantity;
    if (card.board === "side") sideCount += quantity;
    if (card.price_usd != null) totalPrice += card.price_usd * quantity;

    const isLand = card.category_group === "Land";
    if (card.board !== "side" && !isLand) {
      manaValueSum += card.mana_value * quantity;
      nonLandCount += quantity;
      const bucket = manaValueBucket(card.mana_value);
      curveMap.set(bucket, (curveMap.get(bucket) ?? 0) + quantity);
    }

    if (card.board !== "side" && !isLand) {
      for (const color of card.colors) {
        colorMap.set(color, (colorMap.get(color) ?? 0) + quantity);
      }
    }
  }

  const curveBuckets = ["1 or less", "2", "3", "4", "5", "6+"];
  return {
    main_count: mainCount,
    side_count: sideCount,
    total_count: mainCount + sideCount,
    average_mana_value:
      nonLandCount > 0 ? manaValueSum / nonLandCount : 0,
    total_price: totalPrice,
    curve: curveBuckets.map((bucket) => ({
      bucket,
      count: curveMap.get(bucket) ?? 0,
    })),
    color_counts: COLOR_ORDER.map((color) => ({
      color,
      count: colorMap.get(color) ?? 0,
    })),
  };
}

/**
 * Section order: card type, then mana value, then quantity (most played
 * first), then name.
 */
export function compareDeckCards(a: DeckCardView, b: DeckCardView): number {
  const byCategory =
    CATEGORY_ORDER.indexOf(a.category_group) -
    CATEGORY_ORDER.indexOf(b.category_group);
  if (byCategory !== 0) return byCategory;
  if (a.mana_value !== b.mana_value) return a.mana_value - b.mana_value;
  if (a.quantity !== b.quantity) return b.quantity - a.quantity;
  return a.card_name.localeCompare(b.card_name);
}

export function groupByCategory(cards: DeckCardView[]) {
  const groups = new Map<DeckCardView["category_group"], DeckCardView[]>();
  for (const card of cards) {
    const list = groups.get(card.category_group) ?? [];
    list.push(card);
    groups.set(card.category_group, list);
  }
  return CATEGORY_ORDER.filter((category) => groups.has(category)).map(
    (category) => ({
      category,
      cards: groups.get(category)!.sort(compareDeckCards),
    }),
  );
}
