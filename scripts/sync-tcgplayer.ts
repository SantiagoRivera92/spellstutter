/**
 * Resolve TCGplayer catalog product ids for Pauper cards and store them on the
 * matching Scryfall printings. The ids are used to build Mass Entry purchase
 * links (`quantity-productId`).
 *
 * Usage:
 *   pnpm sync:tcgplayer
 *   pnpm sync:tcgplayer -- --force
 *   pnpm sync:tcgplayer -- --limit=500 --dry-run
 */
import { config } from "dotenv";
import type { AnyBulkWriteOperation, Db } from "mongodb";

import type { Card, Printing } from "../src/lib/cards/types";
import { withDb } from "./lib/mongo";

config({ path: ".env.local" });
config();

const API = "https://api.tcgplayer.com";
const API_VERSION = "v1.39.0";
const MAGIC_CATEGORY = 1;
const PAGE_SIZE = 100;
const BATCH_SIZE = 500;
const REQUEST_DELAY_MS = 120;

interface Options {
  force: boolean;
  dryRun: boolean;
  limit: number | null;
}

interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation?: string | null;
}

interface ExtendedField {
  name: string;
  value: string;
}

interface TcgProduct {
  productId: number;
  name: string;
  groupId: number;
  url?: string;
  extendedData?: ExtendedField[];
}

interface GroupResponse {
  totalItems: number;
  results: TcgGroup[];
}

interface ProductResponse {
  totalItems: number;
  results: TcgProduct[];
}

function getArg(argv: string[], flag: string): string | undefined {
  const arg = argv.find((value) => value.startsWith(`--${flag}=`));
  return arg ? arg.split("=").slice(1).join("=") : undefined;
}

function parseArgs(argv: string[]): Options {
  const limit = getArg(argv, "limit");
  return {
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
    limit: limit ? Number.parseInt(limit, 10) : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

async function throttle() {
  const wait = REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function firstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

async function getToken(): Promise<string> {
  const clientId = firstEnv([
    "TCGPLAYER_PUBLIC_KEY",
    "TcGPLAYER_PUBLIC_KEY",
    "TCGPLAYER_PUBLICKEY",
  ]);
  const clientSecret = firstEnv([
    "TCGPLAYER_SECRET_KEY",
    "TCGPLAYER_PRIVATE_KEY",
    "TcGPLAYER_SECRET_KEY",
    "TcGPLAYER_PRIVATE_KEY",
    "TCGPLAYER_SECRETKEY",
    "TCGPLAYER_PRIVATEKEY",
  ]);
  if (!clientId || !clientSecret) {
    throw new Error(
      "TCGPLAYER_PUBLIC_KEY plus TCGPLAYER_SECRET_KEY or TCGPLAYER_PRIVATE_KEY must be set.",
    );
  }

  await throttle();
  const response = await fetch(`${API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `TCGplayer token request failed: ${response.status} ${response.statusText}`,
    );
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("TCGplayer returned no access token");
  return data.access_token;
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await throttle();
    const response = await fetch(`${API}/${API_VERSION}${path}`, {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: "application/json",
        "User-Agent": process.env.SCRYFALL_USER_AGENT ?? "spellstutter",
      },
    });
    if (response.ok) return (await response.json()) as T;

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 1000 * 2 ** attempt;
      console.warn(
        `[tcgplayer] ${response.status} on ${path}; retrying in ${delay}ms`,
      );
      await sleep(delay);
      continue;
    }

    throw new Error(
      `TCGplayer ${response.status} ${response.statusText}: ${path}`,
    );
  }
  throw new Error(`TCGplayer request failed after retries: ${path}`);
}

async function loadGroups(token: string): Promise<Map<number, TcgGroup>> {
  const groups = new Map<number, TcgGroup>();
  let offset = 0;
  while (true) {
    const data = await apiGet<GroupResponse>(
      token,
      `/catalog/categories/${MAGIC_CATEGORY}/groups?offset=${offset}&limit=${PAGE_SIZE}`,
    );
    for (const group of data.results ?? []) groups.set(group.groupId, group);
    offset += PAGE_SIZE;
    if (!data.results?.length || offset >= data.totalItems) break;
  }
  console.log(`[tcgplayer] groups: ${groups.size.toLocaleString()}`);
  return groups;
}

async function productsForName(
  token: string,
  name: string,
): Promise<TcgProduct[]> {
  const products: TcgProduct[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      categoryId: String(MAGIC_CATEGORY),
      productTypes: "Cards",
      getExtendedFields: "true",
      productName: name,
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    const data = await apiGet<ProductResponse>(
      token,
      `/catalog/products?${params}`,
    );
    products.push(...(data.results ?? []));
    offset += PAGE_SIZE;
    if (!data.results?.length || offset >= data.totalItems) break;
  }
  return products;
}

function productNameVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  if (name.includes(" // ")) {
    const [front, back] = name.split(" // ");
    variants.add(front);
    if (back) {
      variants.add(`${front}/${back}`);
      variants.add(`${front} / ${back}`);
    }
  }
  return [...variants];
}

function normalizeNumber(value: string): string {
  return value.trim().toLowerCase().replace(/^#/, "").replace(/^0+(?=\d)/, "");
}

function productNumber(product: TcgProduct): string | null {
  const field = product.extendedData?.find((entry) =>
    /^(card )?number$/i.test(entry.name),
  );
  return field?.value?.trim() || null;
}

async function sync(db: Db, options: Options) {
  const token = await getToken();
  console.log("[tcgplayer] token acquired");
  const groups = await loadGroups(token);
  const now = new Date().toISOString();

  const cards = await db
    .collection<Card>("cards")
    .find(
      { "legalities.pauper": "legal" },
      {
        projection: {
          _id: 0,
          oracle_id: 1,
          name: 1,
          metagame_printing_id: 1,
          default_printing_id: 1,
        },
      },
    )
    .toArray();

  const selected = options.limit ? cards.slice(0, options.limit) : cards;
  const oracleIds = selected.map((card) => card.oracle_id);
  const printings = await db
    .collection<Printing>("printings")
    .find(
      { oracle_id: { $in: oracleIds }, digital: { $ne: true } },
      {
        projection: {
          _id: 0,
          scryfall_id: 1,
          oracle_id: 1,
          name: 1,
          set: 1,
          collector_number: 1,
          tcgplayer_product_id: 1,
        },
      },
    )
    .toArray();

  const printingsByOracle = new Map<string, Printing[]>();
  for (const printing of printings) {
    const list = printingsByOracle.get(printing.oracle_id) ?? [];
    list.push(printing);
    printingsByOracle.set(printing.oracle_id, list);
  }

  console.log(
    `[tcgplayer] pauper cards: ${selected.length.toLocaleString()}, printings: ${printings.length.toLocaleString()}`,
  );

  const printingOps: AnyBulkWriteOperation<Printing>[] = [];
  const cardOps: AnyBulkWriteOperation<Card>[] = [];
  const productCache = new Map<string, TcgProduct[]>();

  async function flush() {
    if (options.dryRun) {
      printingOps.length = 0;
      cardOps.length = 0;
      return;
    }
    if (printingOps.length) {
      await db
        .collection<Printing>("printings")
        .bulkWrite(printingOps, { ordered: false });
      printingOps.length = 0;
    }
    if (cardOps.length) {
      await db
        .collection<Card>("cards")
        .bulkWrite(cardOps, { ordered: false });
      cardOps.length = 0;
    }
  }

  let scanned = 0;
  let matchedPrintings = 0;
  let matchedCards = 0;
  let skipped = 0;

  for (const card of selected) {
    scanned += 1;
    const cardPrintings = printingsByOracle.get(card.oracle_id) ?? [];
    if (!cardPrintings.length) continue;

    if (!options.force && cardPrintings.every((p) => p.tcgplayer_product_id)) {
      skipped += 1;
      continue;
    }

    const bySetAndNumber = new Map<string, Printing>();
    const bySet = new Map<string, Printing[]>();
    for (const printing of cardPrintings) {
      const set = printing.set.toLowerCase();
      bySetAndNumber.set(
        `${set}|${normalizeNumber(printing.collector_number)}`,
        printing,
      );
      const list = bySet.get(set) ?? [];
      list.push(printing);
      bySet.set(set, list);
    }

    const matched = new Map<string, number>();
    let products: TcgProduct[] = [];
    for (const variant of productNameVariants(card.name)) {
      const cached = productCache.get(variant);
      const found = cached ?? (await productsForName(token, variant));
      if (!cached) productCache.set(variant, found);
      if (found.length) {
        products = found;
        break;
      }
    }

    for (const product of products) {
      const group = groups.get(product.groupId);
      const set = group?.abbreviation?.trim().toLowerCase();
      if (!set) continue;

      const number = productNumber(product);
      let printing: Printing | undefined;
      if (number) {
        printing = bySetAndNumber.get(`${set}|${normalizeNumber(number)}`);
      }
      if (!printing) {
        const candidates = bySet.get(set);
        if (candidates?.length === 1) printing = candidates[0];
      }
      if (printing && !matched.has(printing.scryfall_id)) {
        matched.set(printing.scryfall_id, product.productId);
      }
    }

    if (!matched.size) {
      if (products.length) {
        console.warn(
          `[tcgplayer] no printing match for ${card.name} (${products.length} products)`,
        );
      }
      continue;
    }

    for (const [scryfallId, productId] of matched) {
      printingOps.push({
        updateOne: {
          filter: { scryfall_id: scryfallId },
          update: {
            $set: {
              tcgplayer_product_id: productId,
              tcgplayer_updated_at: now,
            },
          },
        },
      });
      matchedPrintings += 1;
    }

    const canonicalId =
      card.metagame_printing_id ?? card.default_printing_id ?? null;
    const canonicalProduct =
      (canonicalId ? matched.get(canonicalId) : undefined) ??
      matched.values().next().value;
    if (canonicalProduct) {
      cardOps.push({
        updateOne: {
          filter: { oracle_id: card.oracle_id },
          update: {
            $set: {
              tcgplayer_product_id: canonicalProduct,
              tcgplayer_updated_at: now,
            },
          },
        },
      });
      matchedCards += 1;
    }

    if (printingOps.length + cardOps.length >= BATCH_SIZE) await flush();

    if (scanned % 250 === 0) {
      console.log(
        `[tcgplayer] scanned ${scanned.toLocaleString()} — printings ${matchedPrintings.toLocaleString()}, cards ${matchedCards.toLocaleString()}, skipped ${skipped.toLocaleString()}`,
      );
    }
  }

  await flush();
  console.log(
    `[tcgplayer] done — printings ${matchedPrintings.toLocaleString()}, cards ${matchedCards.toLocaleString()}, skipped ${skipped.toLocaleString()}${options.dryRun ? " (dry run)" : ""}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) console.log("[tcgplayer] dry run — nothing will be written");
  await withDb((db) => sync(db, options));
}

void main().catch((error) => {
  console.error("[tcgplayer] failed:", error);
  process.exitCode = 1;
});
