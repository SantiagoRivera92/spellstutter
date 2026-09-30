/**
 * Reclassify stored metagame decks against the current archetype rules.
 *
 * Classification is a pure function of a deck's mainboard card names and its
 * mainboard colour identity, both of which are already stored. This script
 * recomputes `archetype`, `color_identity`, and `classification_version` for
 * every deck without re-fetching anything from mtgo.com — which matters
 * because MTGO frequently serves empty shells for older decklist pages.
 *
 * Usage:
 *   pnpm sync:reclassify
 *   pnpm sync:reclassify -- --dry-run
 */
import { config } from "dotenv";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import { identityColors } from "../src/lib/cards/mana";
import type { Card, CardColor, Printing } from "../src/lib/cards/types";
import {
  CLASSIFICATION_VERSION,
  IDENTITY_EXEMPT_CARDS,
  classifyDeck,
} from "../src/lib/metagame/archetypes";
import { MTGO_CARD_ALIASES } from "../src/lib/metagame/card-aliases";
import type {
  MetagameCardEntry,
  MetagameDeck,
} from "../src/lib/metagame/types";
import { nameAliases, normalizeName } from "../src/lib/cards/normalize-name";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const ORDER: CardColor[] = ["W", "U", "B", "R", "G"];

/** Token / non-deck card layouts, which must never win a name lookup. */
const NON_DECK_LAYOUTS = [
  "token",
  "double_faced_token",
  "emblem",
  "art_series",
  "vanguard",
  "scheme",
  "planar",
];

interface CardIdentity {
  oracleId: string;
  printingId: string | null;
  colors: CardColor[];
  manaCost: string | null;
  typeLine: string | null;
  image: string | null;
}

interface Catalog {
  byOracle: Map<string, CardIdentity>;
  byAlias: Map<string, CardIdentity>;
}

function cardImage(card: Card): string | null {
  return (
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris.normal ??
    card.card_faces?.[0]?.image_uris.small ??
    null
  );
}

function printingImage(printing: Printing): string | null {
  return (
    printing.image_uris?.normal ??
    printing.image_uris?.small ??
    printing.card_faces?.[0]?.image_uris.normal ??
    printing.card_faces?.[0]?.image_uris.small ??
    null
  );
}

/** scryfall_id -> image, so a card can use its earliest-common-printing art. */
async function loadPrintingImages(db: Db): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const cursor = db.collection<Printing>("printings").find(
    {},
    { projection: { scryfall_id: 1, image_uris: 1, card_faces: 1 } },
  );
  for await (const printing of cursor) {
    const image = printingImage(printing);
    if (image) map.set(printing.scryfall_id, image);
  }
  return map;
}

async function loadCatalog(db: Db): Promise<Catalog> {
  const byOracle = new Map<string, CardIdentity>();
  const byAlias = new Map<string, CardIdentity>();
  const printingImages = await loadPrintingImages(db);
  const cursor = db.collection<Card>("cards").find(
    { layout: { $nin: NON_DECK_LAYOUTS } },
    {
      projection: {
        oracle_id: 1,
        name: 1,
        colors: 1,
        mana_cost: 1,
        type_line: 1,
        image_uris: 1,
        card_faces: 1,
        metagame_printing_id: 1,
        default_printing_id: 1,
      },
    },
  );
  for await (const card of cursor) {
    const info: CardIdentity = {
      oracleId: card.oracle_id,
      printingId:
        card.metagame_printing_id ?? card.default_printing_id ?? null,
      colors: (card.colors ?? []) as CardColor[],
      manaCost: card.mana_cost ?? null,
      typeLine: card.type_line ?? null,
      // Prefer the earliest common printing (the metagame default art).
      image:
        (card.metagame_printing_id
          ? printingImages.get(card.metagame_printing_id)
          : undefined) ?? cardImage(card),
    };
    if (card.oracle_id) byOracle.set(card.oracle_id, info);
    for (const alias of nameAliases(card.name)) {
      if (!byAlias.has(alias)) byAlias.set(alias, info);
    }
  }

  for (const [from, to] of Object.entries(MTGO_CARD_ALIASES)) {
    const info = byAlias.get(normalizeName(to));
    if (info) byAlias.set(normalizeName(from), info);
  }

  return { byOracle, byAlias };
}

function lookupIdentity(
  entry: { name: string; oracle_id: string | null },
  catalog: Catalog,
): CardIdentity | undefined {
  return (
    (entry.oracle_id ? catalog.byOracle.get(entry.oracle_id) : undefined) ??
    catalog.byAlias.get(normalizeName(entry.name))
  );
}

function identityOf(
  entries: { name: string; oracle_id: string | null }[],
  catalog: Catalog,
): CardColor[] {
  const set = new Set<CardColor>();
  for (const entry of entries) {
    if (IDENTITY_EXEMPT_CARDS.has(normalizeName(entry.name))) continue;
    const info = lookupIdentity(entry, catalog);
    for (const color of identityColors(info?.manaCost, info?.colors ?? [])) {
      set.add(color);
    }
  }
  return ORDER.filter((color) => set.has(color));
}

/**
 * Re-resolve each stored card entry against the catalog: this corrects oracle
 * ids and default printings, and backfills the type line and image the
 * decklist view needs. It also fixes entries that had resolved to a token.
 */
function resolveBoard(
  entries: MetagameCardEntry[],
  catalog: Catalog,
): MetagameCardEntry[] {
  return entries.map((entry) => {
    const info = lookupIdentity(entry, catalog);
    return {
      ...entry,
      oracle_id: info?.oracleId ?? entry.oracle_id,
      printing_id: info?.printingId ?? entry.printing_id,
      type_line: info?.typeLine ?? entry.type_line ?? null,
      image: info?.image ?? entry.image ?? null,
      colors: IDENTITY_EXEMPT_CARDS.has(normalizeName(entry.name))
        ? []
        : info
          ? identityColors(info.manaCost, info.colors)
          : (entry.colors ?? []),
    };
  });
}

async function run(db: Db, dryRun: boolean) {
  console.log("[reclassify] loading card colours…");
  const catalog = await loadCatalog(db);

  const decks = db.collection<MetagameDeck>("metagame_decks");
  const cursor = decks.find({});
  const operations: AnyBulkWriteOperation<MetagameDeck>[] = [];
  const distribution = new Map<string, number>();
  let total = 0;
  let changed = 0;

  for await (const deck of cursor) {
    total += 1;
    const mainboard = resolveBoard(deck.mainboard ?? [], catalog);
    const sideboard = resolveBoard(deck.sideboard ?? [], catalog);
    const mainIdentity = identityOf(mainboard, catalog);
    const classification = classifyDeck(
      mainboard.map((card) => card.name),
      mainIdentity,
    );
    distribution.set(
      classification.name,
      (distribution.get(classification.name) ?? 0) + 1,
    );

    const identityChanged =
      mainIdentity.join("") !== (deck.color_identity ?? []).join("");
    const archetypeChanged =
      deck.archetype?.slug !== classification.slug ||
      deck.classification_version !== CLASSIFICATION_VERSION;
    const entriesChanged =
      JSON.stringify(mainboard) !== JSON.stringify(deck.mainboard ?? []) ||
      JSON.stringify(sideboard) !== JSON.stringify(deck.sideboard ?? []);

    if (archetypeChanged || identityChanged || entriesChanged) {
      changed += 1;
      operations.push({
        updateOne: {
          filter: { _id: (deck as unknown as { _id: unknown })._id } as never,
          update: {
            $set: {
              archetype: {
                slug: classification.slug,
                name: classification.name,
                confidence: classification.confidence,
              },
              color_identity: mainIdentity,
              classification_version: CLASSIFICATION_VERSION,
              mainboard,
              sideboard,
              reclassified_at: new Date().toISOString(),
            },
          },
        },
      });
    }
  }

  if (!dryRun && operations.length) {
    for (let i = 0; i < operations.length; i += 1000) {
      await decks.bulkWrite(operations.slice(i, i + 1000), { ordered: false });
    }
  }

  console.log(
    `[reclassify] ${total} decks, ${changed} updated` +
      (dryRun ? " (dry run — nothing written)" : ""),
  );
  const top = [...distribution.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    "[reclassify] distribution: " +
      top.map(([name, count]) => `${name} ${count}`).join(", "),
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await withDb((db) => run(db, dryRun));
}

void main().catch((error) => {
  console.error("[reclassify] failed:", error);
  process.exitCode = 1;
});
