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
import { getEndstepArchetype } from "@/lib/metagame/endstep";
import { getSession, type Session } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Deck,
  DeckBoard,
  DeckCard,
  DeckVisibility,
} from "@/lib/supabase/types";
import { buildCloneRows } from "./clone";
import { parseDecklist } from "./parse-decklist";

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

/** Marks an archetype slug that refers to an endstep.cc archetype. */
const ENDSTEP_PREFIX = "endstep:";

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

/**
 * Defensive ownership check. RLS should already enforce this, but we never
 * trust a row id alone before mutating it.
 */
async function ownedDeck(
  supabase: SupabaseClient,
  deckId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
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
    .eq("id", input.id)
    .eq("user_id", ctx.session.id);
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
    .eq("id", input.id)
    .eq("user_id", ctx.session.id);
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
    .eq("id", input.id)
    .eq("user_id", ctx.session.id);
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
 * Create a deck seeded from an archetype.
 *
 * MTGO archetypes seed every card that appears in 100% of the stored lists, at
 * the lowest copy count any one list used (so a list running 3 Brainstorm seeds
 * 3, not 4). endstep archetypes (slugs prefixed `endstep:`) seed their canonical
 * sample mainboard directly.
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

  const seed: {
    name: string;
    quantity: number;
    oracle_id: string;
    printing_id: string | null;
  }[] = [];

  if (input.archetypeSlug.startsWith(ENDSTEP_PREFIX)) {
    const archetype = await getEndstepArchetype(
      input.archetypeSlug.slice(ENDSTEP_PREFIX.length),
    ).catch(() => null);
    if (!archetype || !archetype.sample_list.main.length) {
      return { ok: false, error: "archetype_unavailable" };
    }
    const unresolved = archetype.sample_list.main.filter((entry) => !entry.oracle_id);
    const cards = unresolved.length
      ? await getCardsByNames(
          unresolved.map((entry) => normalizeName(entry.name)),
        ).catch(() => [])
      : [];
    const byName = new Map(cards.map((card) => [card.name_normalized, card]));
    for (const entry of archetype.sample_list.main) {
      const card = byName.get(normalizeName(entry.name));
      const oracleId = entry.oracle_id ?? card?.oracle_id;
      if (!oracleId) continue;
      seed.push({
        name: card?.name ?? entry.name,
        quantity: Math.min(999, Math.max(1, entry.count)),
        oracle_id: oracleId,
        printing_id:
          entry.printing_id ??
          card?.metagame_printing_id ??
          card?.default_printing_id ??
          null,
      });
    }
  } else {
    const breakdown = await getArchetypeBreakdown(
      input.archetypeSlug,
      120,
    ).catch(() => null);
    if (!breakdown) return { ok: false, error: "archetype_unavailable" };

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
      for (const entry of core) {
        seed.push({
          name: entry.name,
          quantity: Math.min(999, entry.min_qty),
          oracle_id: entry.oracle_id!,
          printing_id: printingByOracle.get(entry.oracle_id!) ?? null,
        });
      }
    }
  }

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

  if (seed.length) {
    await ctx.supabase.from("deck_cards").insert(
      seed.map((entry) => ({
        deck_id: deckId,
        oracle_id: entry.oracle_id,
        printing_id: entry.printing_id,
        card_name: entry.name,
        quantity: entry.quantity,
        board: "main" as const,
      })),
    );
  }

  revalidateDeck(deckId);
  return { ok: true, deckId };
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
    .eq("id", input.id)
    .eq("user_id", ctx.session.id);
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
    .eq("id", input.id)
    .eq("user_id", ctx.session.id);
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
    .eq("id", input.deckId)
    .eq("user_id", ctx.session.id);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.deckId);
  return { ok: true };
}

type LegalityCheck =
  | { status: "legal"; printingId: string | null }
  | { status: "not_legal" }
  | { status: "unavailable" };

/**
 * A card is addable only if the catalog says Pauper-legal. Fails closed, but
 * distinguishes a card that is genuinely absent from the catalog from the
 * catalog being unreachable, so the UI reports the real reason instead of
 * blaming the card.
 */
async function checkPauperLegality(oracleId: string): Promise<LegalityCheck> {
  if (!isMongoConfigured()) return { status: "unavailable" };
  try {
    const card = await getCardByOracleId(oracleId);
    if (!card || !isPauperLegal(card)) return { status: "not_legal" };
    return {
      status: "legal",
      printingId: card.metagame_printing_id ?? card.default_printing_id ?? null,
    };
  } catch {
    return { status: "unavailable" };
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
  if (!isMongoConfigured()) {
    return { ok: false, error: "card_catalog_unavailable" };
  }
  if (!(await ownedDeck(ctx.supabase, input.deckId, ctx.session.id))) {
    return { ok: false, error: "not_found" };
  }

  const board = boardSchema.safeParse(input.board ?? "main");
  if (!board.success) return { ok: false, error: "invalid_board" };
  const quantity = Math.max(1, Math.min(999, input.quantity ?? 1));

  const legality = await checkPauperLegality(input.oracleId);
  if (legality.status === "unavailable") {
    return { ok: false, error: "card_catalog_unavailable" };
  }
  if (legality.status !== "legal") {
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
  if (!(await ownedDeck(ctx.supabase, input.deckId, ctx.session.id))) {
    return { ok: false, error: "not_found" };
  }

  const patch: Record<string, unknown> = {};
  if (input.printingId !== undefined) patch.printing_id = input.printingId;
  if (input.quantity !== undefined) {
    const quantity = Math.max(0, Math.min(999, input.quantity));
    if (quantity === 0) {
      const { error } = await ctx.supabase
        .from("deck_cards")
        .delete()
        .eq("id", input.cardId)
        .eq("deck_id", input.deckId);
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
    .eq("id", input.cardId)
    .eq("deck_id", input.deckId);
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
  if (!(await ownedDeck(ctx.supabase, input.deckId, ctx.session.id))) {
    return { ok: false, error: "not_found" };
  }
  const { error } = await ctx.supabase
    .from("deck_cards")
    .delete()
    .eq("id", input.cardId)
    .eq("deck_id", input.deckId);
  if (error) return { ok: false, error: error.message };
  revalidateDeck(input.deckId);
  return { ok: true };
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
  if (!(await ownedDeck(ctx.supabase, input.deckId, ctx.session.id))) {
    return { ok: false, error: "not_found" };
  }
  if (input.text.length > 100_000) {
    return { ok: false, error: "list_too_long" };
  }

  const entries = parseDecklist(input.text, input.board ?? "main");
  if (!entries.length) return { ok: false, error: "empty_list" };

  const uniqueNames = [...new Set(entries.map((entry) => entry.name))];
  let found: Awaited<ReturnType<typeof getCardsByNames>>;
  try {
    found = await getCardsByNames(uniqueNames);
  } catch {
    return { ok: false, error: "card_catalog_unavailable" };
  }
  const byName = new Map(
    found
      .filter(isPauperLegal)
      .map((card) => [card.name_normalized, card] as const),
  );

  if (input.mode === "replace") {
    // Only clear the board(s) the parsed list actually targets, so
    // replacing a sideboard import never wipes the mainboard (and vice versa).
    const targetBoards = [...new Set(entries.map((entry) => entry.board))];
    await ctx.supabase
      .from("deck_cards")
      .delete()
      .eq("deck_id", input.deckId)
      .in("board", targetBoards);
  }

  // One query for the deck's existing rows, then diff in memory, rather than
  // a SELECT per imported line.
  const { data: existingData } = await ctx.supabase
    .from("deck_cards")
    .select("id,oracle_id,board,quantity")
    .eq("deck_id", input.deckId);
  const existingByKey = new Map<string, { id: string; quantity: number }>();
  for (const row of (existingData ?? []) as {
    id: string;
    oracle_id: string;
    board: string;
    quantity: number;
  }[]) {
    existingByKey.set(`${row.board}:${row.oracle_id}`, {
      id: row.id,
      quantity: row.quantity,
    });
  }

  const skipped: string[] = [];
  let added = 0;

  for (const entry of entries) {
    const card = byName.get(normalizeName(entry.name));
    if (!card) {
      if (!skipped.includes(entry.name)) skipped.push(entry.name);
      continue;
    }

    const key = `${entry.board}:${card.oracle_id}`;
    const existing = existingByKey.get(key);

    if (existing) {
      const next = Math.min(999, existing.quantity + entry.quantity);
      await ctx.supabase
        .from("deck_cards")
        .update({ quantity: next })
        .eq("id", existing.id);
      existing.quantity = next;
    } else {
      const { data: inserted } = await ctx.supabase
        .from("deck_cards")
        .insert({
          deck_id: input.deckId,
          oracle_id: card.oracle_id,
          printing_id:
            card.metagame_printing_id ?? card.default_printing_id ?? null,
          card_name: card.name,
          quantity: Math.min(999, entry.quantity),
          board: entry.board,
        })
        .select("id,quantity")
        .single();
      if (inserted) {
        existingByKey.set(key, {
          id: (inserted as { id: string }).id,
          quantity: (inserted as { quantity: number }).quantity,
        });
      }
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

  const { data: deckData } = await ctx.supabase
    .from("decks")
    .select("id,user_id,visibility")
    .eq("id", input.deckId)
    .maybeSingle();
  const deck = deckData as Pick<Deck, "id" | "user_id" | "visibility"> | null;
  const canComment =
    deck &&
    (deck.visibility !== "private" || deck.user_id === ctx.session.id);
  if (!canComment) return { ok: false, error: "not_found" };

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

  // Authors may delete their own comments; deck owners may moderate any.
  const { data: commentData } = await ctx.supabase
    .from("deck_comments")
    .select("user_id")
    .eq("id", input.commentId)
    .maybeSingle();
  const comment = commentData as { user_id: string } | null;
  if (!comment) return { ok: false, error: "not_found" };
  const isAuthor = comment.user_id === ctx.session.id;
  const isOwner = await ownedDeck(ctx.supabase, input.deckId, ctx.session.id);
  if (!isAuthor && !isOwner) return { ok: false, error: "not_found" };

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
  if (source.visibility === "private" && source.user_id !== ctx.session.id) {
    return { ok: false, error: "deck_not_found" };
  }

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
