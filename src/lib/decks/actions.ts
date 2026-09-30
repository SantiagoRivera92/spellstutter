"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getCardByOracleId,
  getCardsByNames,
  getCardsByOracleIds,
} from "@/lib/cards/queries";
import { normalizeName } from "@/lib/cards/normalize-name";
import { isPauperLegal } from "@/lib/cards/types";
import {
  getArchetypeBreakdown,
  getMetagameDeck,
} from "@/lib/metagame/queries";
import type { MetagameDeck } from "@/lib/metagame/types";
import { getSession, type Session } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Deck,
  DeckBoard,
  DeckCard,
  DeckVisibility,
} from "@/lib/supabase/types";

export interface ImportReport {
  added: number;
  skipped: string[];
}

export type ActionResult =
  | { ok: true; deckId?: string; report?: ImportReport; card?: DeckCard }
  | { ok: false; error: string };

const boardSchema = z.enum(["main", "side", "commander", "maybe"]);
const visibilitySchema = z.enum(["private", "unlisted", "public"]);
const nameSchema = z.string().trim().min(1).max(120);
const folderNameSchema = z.string().trim().min(1).max(80);

type ActionContext =
  | { ok: false; error: string }
  | { ok: true; session: Session; supabase: SupabaseClient };

async function context(): Promise<ActionContext> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!session.profile) return { ok: false, error: "no_profile" };
  const supabase = await createSupabaseServerClient();
  return { ok: true, session, supabase };
}

function revalidateDeck(deckId?: string) {
  revalidatePath("/decks");
  if (deckId) revalidatePath(`/decks/${deckId}`);
}

export async function createFolder(input: {
  name: string;
  parentId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = folderNameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: "invalid_name" };

  const { error } = await ctx.supabase.from("folders").insert({
    user_id: ctx.session.id,
    parent_id: input.parentId ?? null,
    name: parsed.data,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/decks");
  return { ok: true };
}

export async function renameFolder(input: {
  id: string;
  name: string;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = folderNameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: "invalid_name" };

  const { error } = await ctx.supabase
    .from("folders")
    .update({ name: parsed.data })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/decks");
  return { ok: true };
}

export async function deleteFolder(input: { id: string }): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("folders")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/decks");
  return { ok: true };
}

export async function moveFolder(input: {
  id: string;
  parentId: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("folders")
    .update({ parent_id: input.parentId })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/decks");
  return { ok: true };
}

export async function createDeck(input: {
  name: string;
  folderId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: "invalid_name" };

  const { data, error } = await ctx.supabase
    .from("decks")
    .insert({
      user_id: ctx.session.id,
      folder_id: input.folderId ?? null,
      name: parsed.data,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateDeck();
  return { ok: true, deckId: (data as { id: string }).id };
}

/**
 * Create a deck seeded with an archetype's core: every card that appears in
 * 100% of the stored lists for that archetype, at the lowest copy count any one
 * list used (so a list running 3 Brainstorm seeds 3, not 4).
 */
export async function createDeckFromArchetype(input: {
  name: string;
  folderId?: string | null;
  archetypeSlug: string;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: "invalid_name" };
  if (!isMongoConfigured()) {
    return { ok: false, error: "card_catalog_unavailable" };
  }

  const breakdown = await getArchetypeBreakdown(
    input.archetypeSlug,
    120,
  ).catch(() => null);
  if (!breakdown) return { ok: false, error: "archetype_unavailable" };

  const { data, error } = await ctx.supabase
    .from("decks")
    .insert({
      user_id: ctx.session.id,
      folder_id: input.folderId ?? null,
      name: parsed.data,
      archetype_slug: input.archetypeSlug,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("archetype_slug")) {
      return { ok: false, error: "migration_required" };
    }
    return { ok: false, error: error.message };
  }
  const deckId = (data as { id: string }).id;

  const core = breakdown.main.filter(
    (entry) => entry.oracle_id && entry.decks >= breakdown.decks && entry.min_qty > 0,
  );

  if (core.length) {
    const oracleIds = core.map((entry) => entry.oracle_id!) as string[];
    const cards = await getCardsByOracleIds(oracleIds).catch(() => []);
    const printingByOracle = new Map(
      cards.map((card) => [
        card.oracle_id,
        card.metagame_printing_id ?? card.default_printing_id ?? null,
      ]),
    );

    await ctx.supabase.from("deck_cards").insert(
      core.map((entry) => ({
        deck_id: deckId,
        oracle_id: entry.oracle_id!,
        printing_id: printingByOracle.get(entry.oracle_id!) ?? null,
        card_name: entry.name,
        quantity: Math.min(999, entry.min_qty),
        board: "main" as const,
      })),
    );
  }

  revalidateDeck(deckId);
  return { ok: true, deckId };
}

interface CloneRow {
  deck_id: string;
  oracle_id: string;
  printing_id: string | null;
  card_name: string;
  quantity: number;
  board: DeckBoard;
}

function buildCloneRows(
  source: MetagameDeck,
  deckId: string,
): { rows: CloneRow[]; skipped: string[] } {
  const skipped: string[] = [];
  const rows: CloneRow[] = [];

  const addBoard = (entries: MetagameDeck["mainboard"], board: DeckBoard) => {
    const byOracle = new Map<string, CloneRow>();
    for (const entry of entries ?? []) {
      if (!entry.oracle_id) {
        if (!skipped.includes(entry.name)) skipped.push(entry.name);
        continue;
      }
      const existing = byOracle.get(entry.oracle_id);
      if (existing) {
        existing.quantity = Math.min(999, existing.quantity + entry.quantity);
      } else {
        byOracle.set(entry.oracle_id, {
          deck_id: deckId,
          oracle_id: entry.oracle_id,
          printing_id: entry.printing_id ?? null,
          card_name: entry.name,
          quantity: Math.min(999, entry.quantity),
          board,
        });
      }
    }
    rows.push(...byOracle.values());
  };

  addBoard(source.mainboard, "main");
  addBoard(source.sideboard, "side");
  return { rows, skipped };
}

/**
 * Create a new deck for the current user from an MTGO metagame decklist.
 */
export async function cloneMetagameDeck(input: {
  eventSlug: string;
  player: string;
  folderId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!isMongoConfigured()) {
    return { ok: false, error: "card_catalog_unavailable" };
  }

  const source = await getMetagameDeck(input.eventSlug, input.player);
  if (!source) return { ok: false, error: "deck_not_found" };

  const { data, error } = await ctx.supabase
    .from("decks")
    .insert({
      user_id: ctx.session.id,
      folder_id: input.folderId ?? null,
      name: `${source.archetype.name} (${source.player})`.slice(0, 120),
      archetype_slug: source.archetype.slug,
      visibility: "private",
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("archetype_slug")) {
      return { ok: false, error: "migration_required" };
    }
    return { ok: false, error: error.message };
  }
  const deckId = (data as { id: string }).id;

  const { rows, skipped } = buildCloneRows(source, deckId);
  if (rows.length) {
    const { error: cardError } = await ctx.supabase
      .from("deck_cards")
      .insert(rows);
    if (cardError) return { ok: false, error: cardError.message };
  }

  revalidateDeck(deckId);
  return {
    ok: true,
    deckId,
    report: {
      added: rows.reduce((sum, row) => sum + row.quantity, 0),
      skipped,
    },
  };
}

export async function updateDeck(input: {
  id: string;
  name?: string;
  description?: string | null;
  visibility?: DeckVisibility;
  folderId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const parsed = nameSchema.safeParse(input.name);
    if (!parsed.success) return { ok: false, error: "invalid_name" };
    patch.name = parsed.data;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.slice(0, 1000) ?? null;
  }
  if (input.visibility !== undefined) {
    const parsed = visibilitySchema.safeParse(input.visibility);
    if (!parsed.success) return { ok: false, error: "invalid_visibility" };
    patch.visibility = parsed.data;
  }
  if (input.folderId !== undefined) patch.folder_id = input.folderId;

  if (!Object.keys(patch).length) return { ok: true };

  const { error } = await ctx.supabase
    .from("decks")
    .update(patch)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.id);
  return { ok: true };
}

export async function deleteDeck(input: {
  id: string;
  redirectTo?: string;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("decks")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/decks");
  if (input.redirectTo) redirect(input.redirectTo);
  return { ok: true };
}

export async function setDeckCover(input: {
  deckId: string;
  oracleId: string | null;
  printingId?: string | null;
  artUrl?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("decks")
    .update({
      cover_oracle_id: input.oracleId,
      cover_printing_id: input.printingId ?? null,
      cover_art_url: input.artUrl ?? null,
    })
    .eq("id", input.deckId);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.deckId);
  return { ok: true };
}

interface LegalityCheck {
  ok: boolean;
  printingId: string | null;
}

/** A card is addable only if the catalog says Pauper-legal. */
async function checkPauperLegality(oracleId: string): Promise<LegalityCheck> {
  if (!isMongoConfigured()) return { ok: true, printingId: null };
  try {
    const card = await getCardByOracleId(oracleId);
    if (!card || !isPauperLegal(card)) return { ok: false, printingId: null };
    return {
      ok: true,
      printingId: card.metagame_printing_id ?? card.default_printing_id ?? null,
    };
  } catch {
    return { ok: false, printingId: null };
  }
}

export async function addDeckCard(input: {
  deckId: string;
  oracleId: string;
  cardName: string;
  printingId?: string | null;
  board?: DeckBoard;
  quantity?: number;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const board = boardSchema.safeParse(input.board ?? "main");
  if (!board.success) return { ok: false, error: "invalid_board" };
  const quantity = Math.max(1, Math.min(999, input.quantity ?? 1));

  const legality = await checkPauperLegality(input.oracleId);
  if (!legality.ok) {
    return { ok: false, error: "not_pauper_legal" };
  }
  const printingId = input.printingId ?? legality.printingId;

  const { data: existing } = await ctx.supabase
    .from("deck_cards")
    .select("id,quantity")
    .eq("deck_id", input.deckId)
    .eq("board", board.data)
    .eq("oracle_id", input.oracleId)
    .maybeSingle();

  let row: DeckCard;
  if (existing) {
    const current = (existing as { id: string; quantity: number }).quantity;
    const { data, error } = await ctx.supabase
      .from("deck_cards")
      .update({ quantity: Math.min(999, current + quantity) })
      .eq("id", (existing as { id: string }).id)
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    row = data as DeckCard;
  } else {
    const { data, error } = await ctx.supabase
      .from("deck_cards")
      .insert({
        deck_id: input.deckId,
        oracle_id: input.oracleId,
        printing_id: printingId,
        card_name: input.cardName,
        quantity,
        board: board.data,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    row = data as DeckCard;
  }

  revalidateDeck(input.deckId);
  return { ok: true, card: row };
}

export async function updateDeckCard(input: {
  deckId: string;
  cardId: string;
  quantity?: number;
  board?: DeckBoard;
  category?: string | null;
  printingId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patch: Record<string, unknown> = {};
  if (input.printingId !== undefined) patch.printing_id = input.printingId;
  if (input.quantity !== undefined) {
    const quantity = Math.max(0, Math.min(999, input.quantity));
    if (quantity === 0) {
      const { error } = await ctx.supabase
        .from("deck_cards")
        .delete()
        .eq("id", input.cardId);
      if (error) return { ok: false, error: error.message };
      revalidateDeck(input.deckId);
      return { ok: true };
    }
    patch.quantity = quantity;
  }
  if (input.board !== undefined) {
    const board = boardSchema.safeParse(input.board);
    if (!board.success) return { ok: false, error: "invalid_board" };
    patch.board = board.data;
  }
  if (input.category !== undefined) patch.category = input.category;

  if (!Object.keys(patch).length) return { ok: true };

  const { error } = await ctx.supabase
    .from("deck_cards")
    .update(patch)
    .eq("id", input.cardId);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.deckId);
  return { ok: true };
}

export async function removeDeckCard(input: {
  deckId: string;
  cardId: string;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("deck_cards")
    .delete()
    .eq("id", input.cardId);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.deckId);
  return { ok: true };
}

export async function clearDeckBoard(input: {
  deckId: string;
  board: DeckBoard;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("deck_cards")
    .delete()
    .eq("deck_id", input.deckId)
    .eq("board", input.board);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.deckId);
  return { ok: true };
}

const LINE_PATTERN = /^(\d+)\s+(.+)$/;

function cleanCardName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^SB:\s*/i, "");
  name = name.replace(/\s+\*[A-Z]+\*/g, "");
  name = name.replace(/\s+#\S+/g, "");
  name = name.replace(/\s+\([A-Z0-9_]+\)\s*[A-Z0-9-]*\s*$/i, "");
  return name.trim();
}

export async function importDecklist(input: {
  deckId: string;
  text: string;
  board?: DeckBoard;
  mode?: "add" | "replace";
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!isMongoConfigured()) {
    return { ok: false, error: "card_catalog_unavailable" };
  }

  const defaultBoard = input.board ?? "main";
  const lines = input.text.split(/\r?\n/);
  const entries: { quantity: number; name: string; board: DeckBoard }[] = [];
  let currentBoard: DeckBoard = defaultBoard;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (/^(sideboard|side board)$/i.test(trimmed)) {
      currentBoard = "side";
      continue;
    }
    if (/^(mainboard|main|deck)$/i.test(trimmed)) {
      currentBoard = defaultBoard;
      continue;
    }
    const match = trimmed.match(LINE_PATTERN);
    if (!match) continue;
    const quantity = Number.parseInt(match[1], 10);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const name = cleanCardName(match[2]);
    if (name) entries.push({ quantity, name, board: currentBoard });
  }

  if (!entries.length) return { ok: false, error: "empty_list" };

  const uniqueNames = [...new Set(entries.map((entry) => entry.name))];
  const found = await getCardsByNames(uniqueNames).catch(() => []);
  const byName = new Map(
    found
      .filter(isPauperLegal)
      .map((card) => [card.name_normalized, card] as const),
  );

  if (input.mode === "replace") {
    await ctx.supabase
      .from("deck_cards")
      .delete()
      .eq("deck_id", input.deckId);
  }

  const skipped: string[] = [];
  let added = 0;

  for (const entry of entries) {
    const card = byName.get(normalizeName(entry.name));
    if (!card) {
      if (!skipped.includes(entry.name)) skipped.push(entry.name);
      continue;
    }

    const { data: existing } = await ctx.supabase
      .from("deck_cards")
      .select("id,quantity")
      .eq("deck_id", input.deckId)
      .eq("board", entry.board)
      .eq("oracle_id", card.oracle_id)
      .maybeSingle();

    if (existing) {
      const current = (existing as { id: string; quantity: number }).quantity;
      await ctx.supabase
        .from("deck_cards")
        .update({ quantity: Math.min(999, current + entry.quantity) })
        .eq("id", (existing as { id: string }).id);
    } else {
      await ctx.supabase.from("deck_cards").insert({
        deck_id: input.deckId,
        oracle_id: card.oracle_id,
        printing_id:
          card.metagame_printing_id ?? card.default_printing_id ?? null,
        card_name: card.name,
        quantity: Math.min(999, entry.quantity),
        board: entry.board,
      });
    }
    added += entry.quantity;
  }

  revalidateDeck(input.deckId);
  return { ok: true, report: { added, skipped } };
}

export async function addDeckComment(input: {
  deckId: string;
  body: string;
  parentId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const body = input.body.trim();
  if (!body || body.length > 2000) return { ok: false, error: "invalid_comment" };

  const { error } = await ctx.supabase.from("deck_comments").insert({
    deck_id: input.deckId,
    user_id: ctx.session.id,
    parent_id: input.parentId ?? null,
    body,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/decks/${input.deckId}`);
  return { ok: true };
}

export async function deleteDeckComment(input: {
  commentId: string;
  deckId: string;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.supabase
    .from("deck_comments")
    .delete()
    .eq("id", input.commentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/decks/${input.deckId}`);
  return { ok: true };
}

/** Copy someone else's (public/unlisted) deck into your own library. */
export async function cloneUserDeck(input: {
  deckId: string;
  folderId?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: sourceData } = await ctx.supabase
    .from("decks")
    .select("*")
    .eq("id", input.deckId)
    .maybeSingle();
  const source = sourceData as Deck | null;
  if (!source) return { ok: false, error: "deck_not_found" };

  const { data: cardData } = await ctx.supabase
    .from("deck_cards")
    .select("*")
    .eq("deck_id", input.deckId);
  const sourceCards = (cardData ?? []) as DeckCard[];

  const { data, error } = await ctx.supabase
    .from("decks")
    .insert({
      user_id: ctx.session.id,
      folder_id: input.folderId ?? null,
      name: `${source.name} (copy)`.slice(0, 120),
      description: source.description,
      visibility: "private",
      cover_oracle_id: source.cover_oracle_id,
      cover_printing_id: source.cover_printing_id,
      cover_art_url: source.cover_art_url,
      archetype_slug: source.archetype_slug ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("archetype_slug")) {
      return { ok: false, error: "migration_required" };
    }
    return { ok: false, error: error.message };
  }
  const deckId = (data as { id: string }).id;

  if (sourceCards.length) {
    const { error: cardError } = await ctx.supabase.from("deck_cards").insert(
      sourceCards.map((card) => ({
        deck_id: deckId,
        oracle_id: card.oracle_id,
        printing_id: card.printing_id,
        card_name: card.card_name,
        quantity: card.quantity,
        board: card.board,
        category: card.category,
      })),
    );
    if (cardError) return { ok: false, error: cardError.message };
  }

  revalidateDeck(deckId);
  return { ok: true, deckId };
}
