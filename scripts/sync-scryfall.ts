/**
 * Sync the full Scryfall card catalog into MongoDB.
 *
 * Downloads `default_cards` (one document per printing), and writes two
 * collections:
 *
 *   cards     — one canonical document per oracle_id (all cards, all formats)
 *   printings — one document per printing (so players can pick any version)
 *
 * Every card is stored, not just Pauper-legal ones. `cards.legalities` carries
 * the full format legality map, and `metagame_printing_id` points at the
 * earliest common printing with original art (the default for MTGO decklists).
 *
 * Usage:
 *   pnpm sync:cards                 # all cards, incremental
 *   pnpm sync:cards -- --force      # re-download and re-upsert
 *   pnpm sync:cards -- --pauper-only
 *   pnpm sync:cards -- --limit=5000 --dry-run
 */
import { config } from "dotenv";
import { createInterface } from "node:readline";
import { Readable, type Readable as NodeReadable } from "node:stream";
import { createGunzip } from "node:zlib";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import type { Card, Printing } from "../src/lib/cards/types";
import {
  isBetterCanonical,
  isBetterEarliestPrinting,
  isBetterMetagamePrinting,
  isScryfallPauperLegal,
  printingRank,
  scryfallToCanonical,
  scryfallToPrinting,
  toPrice,
  type PrintingRank,
  type ScryfallCard,
} from "../src/lib/scryfall/normalize";
import { scryfallHeaders, withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const BULK_TYPE = "default_cards";
const BULK_ENDPOINT = `https://api.scryfall.com/bulk-data/${BULK_TYPE}`;
const BATCH_SIZE = 1000;

interface BulkInfo {
  updated_at: string;
  jsonl_download_uri: string;
  compressed_size: number;
}

interface Options {
  force: boolean;
  dryRun: boolean;
  pauperOnly: boolean;
  limit: number | null;
}

interface CanonicalEntry {
  doc: Card;
  rank: PrintingRank;
}

function parseArgs(argv: string[]): Options {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  return {
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
    pauperOnly: argv.includes("--pauper-only"),
    limit: limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : null,
  };
}

async function fetchBulkInfo(): Promise<BulkInfo> {
  const res = await fetch(BULK_ENDPOINT, { headers: scryfallHeaders() });
  if (!res.ok) {
    throw new Error(
      `Scryfall bulk-data request failed: ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as BulkInfo;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("cards").createIndex({ oracle_id: 1 }, { unique: true }),
    db.collection("cards").createIndex({ name_normalized: 1 }),
    db.collection("cards").createIndex({ name: "text", oracle_text: "text" }),
    db.collection("cards").createIndex({ color_identity: 1 }),
    db.collection("cards").createIndex({ cmc: 1 }),
    db.collection("cards").createIndex({ "legalities.pauper": 1 }),
    db.collection("printings").createIndex({ scryfall_id: 1 }, { unique: true }),
    db.collection("printings").createIndex({ oracle_id: 1, released_at: -1 }),
    db.collection("printings").createIndex({
      oracle_id: 1,
      rarity: 1,
      released_at: 1,
    }),
    db.collection("sync_runs").createIndex({ job: 1, started_at: -1 }),
  ]);
}

async function flushPrintings(
  db: Db,
  operations: AnyBulkWriteOperation<Printing>[],
) {
  if (!operations.length) return;
  await db.collection<Printing>("printings").bulkWrite(operations, {
    ordered: false,
  });
  operations.length = 0;
}

async function run(db: Db, options: Options, info: BulkInfo, now: string) {
  if (!options.force && !options.dryRun) {
    const previous = await db
      .collection("sync_runs")
      .findOne({ job: "scryfall", status: "success" });
    if (previous?.source_updated_at === info.updated_at) {
      console.log(
        "[scryfall] bulk data unchanged since last successful sync — skipping",
      );
      return;
    }
  }

  await ensureIndexes(db);

  const runId = (
    await db.collection("sync_runs").insertOne({
      job: "scryfall",
      status: "running",
      scope: options.pauperOnly ? "pauper" : "all",
      source_updated_at: info.updated_at,
      started_at: new Date(),
    })
  ).insertedId;

  const res = await fetch(info.jsonl_download_uri, {
    headers: scryfallHeaders(),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Bulk download failed: ${res.status} ${res.statusText}`);
  }

  const source = Readable.fromWeb(
    res.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
  ) as NodeReadable;
  const lines = createInterface({
    input: source.pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  const canonical = new Map<string, CanonicalEntry>();
  const metagamePrinting = new Map<string, { id: string; rank: PrintingRank }>();
  const earliestPrinting = new Map<string, { id: string; rank: PrintingRank }>();
  const commonNonZeta = new Map<string, { id: string; rank: PrintingRank }>();
  const anyNonZeta = new Map<string, { id: string; rank: PrintingRank }>();
  const printingsCount = new Map<string, number>();
  // Any Magic Online catalog id for the card, used as a .dek export fallback.
  const fallbackMtgoId = new Map<string, number>();
  const cheapestUsd = new Map<string, number>();
  const cheapestFoil = new Map<string, number>();
  const printingOps: AnyBulkWriteOperation<Printing>[] = [];
  let scanned = 0;
  let stored = 0;

  for await (const line of lines) {
    if (!line) continue;
    let raw: ScryfallCard;
    try {
      raw = JSON.parse(line) as ScryfallCard;
    } catch {
      continue;
    }
    scanned += 1;
    if (options.pauperOnly && !isScryfallPauperLegal(raw)) continue;

    const oracleId = raw.oracle_id ?? raw.id;
    const rank = printingRank(raw);

    const printing = scryfallToPrinting(raw, now);
    printingOps.push({
      updateOne: {
        filter: { scryfall_id: printing.scryfall_id },
        update: { $set: printing },
        upsert: true,
      },
    });
    printingsCount.set(oracleId, (printingsCount.get(oracleId) ?? 0) + 1);

    if (raw.mtgo_id != null && !fallbackMtgoId.has(oracleId)) {
      fallbackMtgoId.set(oracleId, raw.mtgo_id);
    }

    // Price the card by its cheapest available printing, so a Secret Lair or
    // unpriced The List printing can't inflate or blank out the price.
    const usd = toPrice(raw.prices?.usd);
    if (usd != null) {
      const current = cheapestUsd.get(oracleId);
      if (current == null || usd < current) cheapestUsd.set(oracleId, usd);
    }
    const foil = toPrice(raw.prices?.usd_foil);
    if (foil != null) {
      const current = cheapestFoil.get(oracleId);
      if (current == null || foil < current) cheapestFoil.set(oracleId, foil);
    }

    const existingCanonical = canonical.get(oracleId);
    if (!existingCanonical) {
      canonical.set(oracleId, { doc: scryfallToCanonical(raw, now), rank });
    } else if (isBetterCanonical(rank, existingCanonical.rank)) {
      canonical.set(oracleId, { doc: scryfallToCanonical(raw, now), rank });
    }

    const currentMeta = metagamePrinting.get(oracleId);
    if (isBetterMetagamePrinting(rank, currentMeta?.rank ?? null)) {
      metagamePrinting.set(oracleId, { id: printing.scryfall_id, rank });
    }

    if (isBetterEarliestPrinting(rank, earliestPrinting.get(oracleId)?.rank ?? null)) {
      earliestPrinting.set(oracleId, { id: printing.scryfall_id, rank });
    }
    // A Zeta printing must never be the default art, so track the earliest
    // non-Zeta printing at common and at any rarity.
    if (!rank.promo && rank.set !== "slz") {
      const currentAny = anyNonZeta.get(oracleId);
      if (!currentAny || rank.releasedAt < currentAny.rank.releasedAt) {
        anyNonZeta.set(oracleId, { id: printing.scryfall_id, rank });
      }
      if (rank.rarity === "common") {
        const currentCommon = commonNonZeta.get(oracleId);
        if (!currentCommon || rank.releasedAt < currentCommon.rank.releasedAt) {
          commonNonZeta.set(oracleId, { id: printing.scryfall_id, rank });
        }
      }
    }

    stored += 1;

    if (printingOps.length >= BATCH_SIZE) {
      if (!options.dryRun) await flushPrintings(db, printingOps);
      else printingOps.length = 0;
      console.log(
        `[scryfall] scanned ${scanned.toLocaleString()} — stored ${stored.toLocaleString()} printings`,
      );
    }

    if (options.limit && stored >= options.limit) {
      console.log(`[scryfall] reached limit of ${options.limit}`);
      break;
    }
  }

  if (!options.dryRun) await flushPrintings(db, printingOps);

  const cardOps: AnyBulkWriteOperation<Card>[] = [];
  for (const [oracleId, entry] of canonical) {
    const doc = entry.doc;
    // Earliest non-Zeta common, then earliest non-Zeta printing, then the
    // earliest common, then anything non-promo — Zeta is the last resort.
    doc.metagame_printing_id =
      commonNonZeta.get(oracleId)?.id ??
      anyNonZeta.get(oracleId)?.id ??
      metagamePrinting.get(oracleId)?.id ??
      earliestPrinting.get(oracleId)?.id ??
      doc.default_printing_id;
    doc.printings_count = printingsCount.get(oracleId) ?? 1;
    // Keep the canonical printing's MTGO id if it has one, else any on MTGO.
    doc.mtgo_id = doc.mtgo_id ?? fallbackMtgoId.get(oracleId) ?? null;
    doc.prices = {
      usd: cheapestUsd.get(oracleId) ?? null,
      usd_foil: cheapestFoil.get(oracleId) ?? null,
    };
    cardOps.push({
      updateOne: {
        filter: { oracle_id: doc.oracle_id },
        update: { $set: doc },
        upsert: true,
      },
    });
  }

  if (!options.dryRun) {
    for (let i = 0; i < cardOps.length; i += BATCH_SIZE) {
      await db
        .collection<Card>("cards")
        .bulkWrite(cardOps.slice(i, i + BATCH_SIZE), { ordered: false });
    }
  }

  const summary = {
    scanned,
    printings: stored,
    unique_cards: canonical.size,
    scope: options.pauperOnly ? "pauper" : "all",
  };

  if (!options.dryRun) {
    await db.collection("sync_runs").updateOne(
      { _id: runId },
      { $set: { status: "success", finished_at: new Date(), ...summary } },
    );
  }

  console.log(
    `[scryfall] done — ${summary.printings.toLocaleString()} printings, ` +
      `${summary.unique_cards.toLocaleString()} unique cards (${summary.scope})`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const now = new Date().toISOString();
  const info = await fetchBulkInfo();

  console.log(
    `[scryfall] bulk data updated at ${info.updated_at} (${(
      info.compressed_size /
      1024 /
      1024
    ).toFixed(1)} MB compressed, JSONL)`,
  );
  if (options.dryRun) console.log("[scryfall] dry run — nothing will be written");
  if (options.pauperOnly)
    console.log("[scryfall] pauper-only scope — non-Pauper cards will be skipped");

  await withDb((db) => run(db, options, info, now));
}

void main().catch((error) => {
  console.error("[scryfall] failed:", error);
  process.exitCode = 1;
});
