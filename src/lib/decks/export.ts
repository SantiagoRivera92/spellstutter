import type { DeckCardView } from "./types";
import { CATEGORY_ORDER } from "./utils";

const CATEGORY_HEADERS: Record<DeckCardView["category_group"], string> = {
  Creature: "Creatures",
  Planeswalker: "Planeswalkers",
  Instant: "Instants",
  Sorcery: "Sorceries",
  Enchantment: "Enchantments",
  Artifact: "Artifacts",
  Battle: "Battles",
  Land: "Lands",
  Other: "Other",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface MtgoDek {
  text: string;
  /** Cards with no Magic Online printing, which cannot be in a .dek file. */
  missing: string[];
}

/**
 * Build an MTGO `.dek` (XML) deck file. Each `<Cards>` entry references the
 * card's MTGO catalog id (Scryfall `mtgo_id`) for the chosen printing.
 */
export function deckToMtgoDek(cards: DeckCardView[]): MtgoDek {
  const missing: string[] = [];
  const entries: string[] = [];

  const ordered = [...cards].sort(
    (a, b) =>
      Number(a.board === "side") - Number(b.board === "side") ||
      a.card_name.localeCompare(b.card_name),
  );

  for (const card of ordered) {
    if (!card.mtgo_id) {
      if (!missing.includes(card.card_name)) missing.push(card.card_name);
      continue;
    }
    entries.push(
      `  <Cards CatID="${card.mtgo_id}" Quantity="${card.quantity}" Sideboard="${
        card.board === "side" ? "true" : "false"
      }" Name="${escapeXml(card.card_name)}" Annotation="0" />`,
    );
  }

  const text = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    "  <NetDeckID>0</NetDeckID>",
    "  <PreconstructedDeckID>0</PreconstructedDeckID>",
    ...entries,
    "</Deck>",
    "",
  ].join("\n");

  return { text, missing };
}

export function deckToText(cards: DeckCardView[]): string {
  const main = cards.filter((card) => card.board === "main");
  const side = cards.filter((card) => card.board === "side");

  const byCategory = new Map<DeckCardView["category_group"], DeckCardView[]>();
  for (const card of main) {
    const list = byCategory.get(card.category_group) ?? [];
    list.push(card);
    byCategory.set(card.category_group, list);
  }

  const lines: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const list = byCategory.get(category);
    if (!list?.length) continue;
    lines.push(`// ${CATEGORY_HEADERS[category]}`);
    list
      .sort((a, b) => a.card_name.localeCompare(b.card_name))
      .forEach((card) => lines.push(`${card.quantity} ${card.card_name}`));
    lines.push("");
  }

  if (side.length) {
    lines.push("Sideboard");
    side
      .sort((a, b) => a.card_name.localeCompare(b.card_name))
      .forEach((card) => lines.push(`${card.quantity} ${card.card_name}`));
  }

  return `${lines.join("\n").trim()}\n`;
}
