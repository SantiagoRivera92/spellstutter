import "server-only";
import type { CardColor, CardSearchResult } from "@/lib/cards/types";
import {
  normalizeImages,
  toPrice,
  type ScryfallCard,
} from "./normalize";

const BASE = "https://api.scryfall.com";

/** Scryfall asks for a descriptive User-Agent and no more than ~10 req/s. */
function headers(): Record<string, string> {
  return {
    "User-Agent":
      process.env.SCRYFALL_USER_AGENT ??
      "spellstutter/0.1 (+https://github.com/spellstutter)",
    Accept: "application/json",
  };
}

let lastRequest = 0;
const MIN_INTERVAL_MS = 110;

/** Serialise outbound calls so a burst of searches cannot trip the rate limit. */
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastRequest + MIN_INTERVAL_MS - now);
  lastRequest = now + wait;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export class ScryfallError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function getJson<T>(url: string): Promise<T> {
  await throttle();
  const res = await fetch(url, {
    headers: headers(),
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    let code = String(res.status);
    let message = `Scryfall request failed (${res.status})`;
    try {
      const body = (await res.json()) as { code?: string; details?: string };
      if (body.code) code = body.code;
      if (body.details) message = body.details;
    } catch {
      // Non-JSON error body; keep the default message.
    }
    throw new ScryfallError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export function toSearchResult(card: ScryfallCard): CardSearchResult {
  const face = card.card_faces?.[0];
  const faceCosts = (card.card_faces ?? [])
    .map((entry) => entry.mana_cost ?? "")
    .filter(Boolean);
  const manaCost = card.mana_cost ?? face?.mana_cost ?? "";
  return {
    oracle_id: card.oracle_id ?? card.id,
    scryfall_id: card.id,
    name: card.name,
    mana_cost: manaCost,
    mana_costs: faceCosts.length ? faceCosts : manaCost ? [manaCost] : [],
    mana_value: card.cmc ?? 0,
    type_line: card.type_line ?? face?.type_line ?? "",
    oracle_text: card.oracle_text ?? face?.oracle_text ?? "",
    colors: (card.colors ?? []) as CardColor[],
    color_identity: (card.color_identity ?? []) as CardColor[],
    rarity: card.rarity ?? "common",
    set_name: card.set_name ?? "",
    art_crop:
      normalizeImages(card.image_uris).art_crop ??
      normalizeImages(face?.image_uris).art_crop,
    image_normal:
      normalizeImages(card.image_uris).normal ??
      normalizeImages(face?.image_uris).normal,
    price_usd: toPrice(card.prices?.usd),
    pauper_legal: card.legalities?.pauper === "legal",
  };
}

interface ScryfallList {
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}

export interface ScryfallSearchResult {
  cards: CardSearchResult[];
  total: number;
  has_more: boolean;
}

export async function scryfallSearch(
  query: string,
  page = 1,
): Promise<ScryfallSearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    unique: "cards",
    order: "name",
    include_extras: "false",
  });
  try {
    const data = await getJson<ScryfallList>(
      `${BASE}/cards/search?${params.toString()}`,
    );
    return {
      cards: data.data.map(toSearchResult),
      total: data.total_cards,
      has_more: data.has_more,
    };
  } catch (error) {
    if (error instanceof ScryfallError && error.code === "not_found") {
      return { cards: [], total: 0, has_more: false };
    }
    throw error;
  }
}

export async function scryfallGetCard(id: string): Promise<ScryfallCard> {
  return getJson<ScryfallCard>(`${BASE}/cards/${encodeURIComponent(id)}`);
}

/** All printings of an oracle id, newest first. Used to lazily cache new cards. */
export async function scryfallPrintingsForOracle(
  oracleId: string,
): Promise<ScryfallCard[]> {
  const params = new URLSearchParams({
    q: `oracleid:${oracleId}`,
    unique: "prints",
    order: "released",
    dir: "desc",
  });
  const data = await getJson<ScryfallList>(
    `${BASE}/cards/search?${params.toString()}`,
  );
  return data.data;
}
