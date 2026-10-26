import "server-only";
import { COLOR_ORDER } from "@/lib/cards/mana";
import { getCardsByOracleIds, getPrintingsByIds } from "@/lib/cards/queries";
import type { CardColor } from "@/lib/cards/types";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/env";
import { frontFace } from "@/lib/metagame/card-type";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommentAuthor,
  Deck,
  DeckCard,
  DeckComment,
  DeckCommentView,
  Folder,
  FolderNode,
  Profile,
} from "@/lib/supabase/types";
import type { DeckCardView, DeckSummary, DeckView } from "./types";
import { computeDeckStats, deriveCategory } from "./utils";

function orderIdentity(colors: CardColor[]): CardColor[] {
  return COLOR_ORDER.filter((color) => colors.includes(color));
}

export function buildTree(
  folders: Folder[],
  deckCounts: Map<string, number>,
): FolderNode[] {
  const nodes = new Map<string, FolderNode>();
  for (const folder of folders) {
    nodes.set(folder.id, {
      ...folder,
      children: [],
      deck_count: deckCounts.get(folder.id) ?? 0,
    });
  }
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (list: FolderNode[]) => {
    list.sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

/** Batch-fetch the color identity for a set of oracle ids from the catalog. */
async function buildIdentityMap(
  oracleIds: string[],
): Promise<Map<string, CardColor[]>> {
  const ids = [...new Set(oracleIds.filter(Boolean))];
  if (!isMongoConfigured() || !ids.length) return new Map();
  const cards = await getCardsByOracleIds(ids).catch(() => []);
  return new Map(cards.map((card) => [card.oracle_id, card.color_identity]));
}

function summarize(
  deck: Deck,
  cards: Pick<DeckCard, "oracle_id" | "quantity" | "board" | "card_name">[],
  identityByOracle: Map<string, CardColor[]>,
): DeckSummary {
  let cardCount = 0;
  const identity = new Set<CardColor>();
  for (const card of cards) {
    if (card.board === "main") cardCount += card.quantity;
    for (const color of identityByOracle.get(card.oracle_id) ?? []) {
      identity.add(color);
    }
  }
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    visibility: deck.visibility,
    folder_id: deck.folder_id,
    cover_art_url: deck.cover_art_url,
    updated_at: deck.updated_at,
    card_count: cardCount,
    color_identity: orderIdentity([...identity]),
  };
}

export interface Library {
  folders: FolderNode[];
  decks: DeckSummary[];
  profile: Profile | null;
}

export async function getLibrary(): Promise<Library | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createSupabaseServerClient();
  const [foldersResult, decksResult] = await Promise.all([
    supabase.from("folders").select("*").order("position").order("name"),
    supabase.from("decks").select("*").order("updated_at", { ascending: false }),
  ]);

  const folders = (foldersResult.data ?? []) as Folder[];
  const decks = (decksResult.data ?? []) as Deck[];

  let cards: Pick<DeckCard, "deck_id" | "oracle_id" | "quantity" | "board" | "card_name">[] =
    [];
  if (decks.length) {
    const { data } = await supabase
      .from("deck_cards")
      .select("deck_id,oracle_id,quantity,board,card_name")
      .in(
        "deck_id",
        decks.map((deck) => deck.id),
      );
    cards = (data ?? []) as typeof cards;
  }

  const identityByOracle = await buildIdentityMap(
    cards.map((card) => card.oracle_id),
  );

  const byDeck = new Map<string, typeof cards>();
  const deckCounts = new Map<string, number>();
  for (const card of cards) {
    const list = byDeck.get(card.deck_id) ?? [];
    list.push(card);
    byDeck.set(card.deck_id, list);
  }

  const summaries = decks.map((deck) => {
    const summary = summarize(deck, byDeck.get(deck.id) ?? [], identityByOracle);
    if (deck.folder_id) {
      deckCounts.set(deck.folder_id, (deckCounts.get(deck.folder_id) ?? 0) + 1);
    }
    return summary;
  });

  return {
    folders: buildTree(folders, deckCounts),
    decks: summaries,
    profile: session.profile,
  };
}

export async function getDeckView(deckId: string): Promise<DeckView | null> {
  const supabase = await createSupabaseServerClient();

  const { data: deckData } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .maybeSingle();

  const deck = deckData as Deck | null;
  if (!deck) return null;

  const { data: cardData } = await supabase
    .from("deck_cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("position")
    .order("card_name");

  const deckCards = (cardData ?? []) as DeckCard[];
  const oracleIds = [...new Set(deckCards.map((card) => card.oracle_id))];
  const printingIds = [
    ...new Set(deckCards.map((card) => card.printing_id).filter(Boolean)),
  ] as string[];
  const [mongoCards, printingDocs] = await Promise.all([
    isMongoConfigured() && oracleIds.length
      ? getCardsByOracleIds(oracleIds).catch(() => [])
      : Promise.resolve([]),
    isMongoConfigured() && printingIds.length
      ? getPrintingsByIds(printingIds).catch(() => [])
      : Promise.resolve([]),
  ]);
  const byOracle = new Map(mongoCards.map((card) => [card.oracle_id, card]));
  const byPrinting = new Map(
    printingDocs.map((printing) => [printing.scryfall_id, printing]),
  );

  const cards: DeckCardView[] = deckCards.map((card) => {
    const details = byOracle.get(card.oracle_id);
    // Prefer the exact printing the user chose in the editor.
    const printing = card.printing_id
      ? byPrinting.get(card.printing_id)
      : undefined;
    const typeLine = details?.type_line ?? "";
    const faceCosts = (details?.card_faces ?? [])
      .map((face) => face.mana_cost)
      .filter(Boolean);
    const manaCost = details?.mana_cost ?? faceCosts[0] ?? "";
    return {
      ...card,
      card_name: details?.name ?? card.card_name,
      mana_cost: manaCost,
      mana_costs: faceCosts.length ? faceCosts : manaCost ? [manaCost] : [],
      mana_value: details?.cmc ?? 0,
      type_line: frontFace(typeLine),
      oracle_text: details?.oracle_text ?? "",
      rarity: printing?.rarity ?? details?.rarity ?? "common",
      mtgo_id: printing?.mtgo_id ?? details?.mtgo_id ?? null,
      colors: details?.colors ?? [],
      color_identity: details?.color_identity ?? [],
      art_crop:
        printing?.image_uris.art_crop ??
        printing?.card_faces?.[0]?.image_uris.art_crop ??
        details?.image_uris.art_crop ??
        null,
      image_normal:
        printing?.image_uris.normal ??
        printing?.card_faces?.[0]?.image_uris.normal ??
        details?.image_uris.normal ??
        null,
      price_usd: printing?.prices.usd ?? details?.prices.usd ?? null,
      category_group: typeLine ? deriveCategory(typeLine) : "Other",
    };
  });

  return { deck, cards, stats: computeDeckStats(cards) };
}

export async function getPublicProfile(username: string): Promise<{
  profile: Profile;
  decks: DeckSummary[];
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  const profile = profileData as Profile | null;
  if (!profile) return null;

  const { data: deckData } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", profile.id)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false });

  const decks = (deckData ?? []) as Deck[];

  let cards: Pick<DeckCard, "deck_id" | "oracle_id" | "quantity" | "board" | "card_name">[] =
    [];
  if (decks.length) {
    const { data } = await supabase
      .from("deck_cards")
      .select("deck_id,oracle_id,quantity,board,card_name")
      .in(
        "deck_id",
        decks.map((deck) => deck.id),
      );
    cards = (data ?? []) as typeof cards;
  }

  const identityByOracle = await buildIdentityMap(
    cards.map((card) => card.oracle_id),
  );

  const byDeck = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = byDeck.get(card.deck_id) ?? [];
    list.push(card);
    byDeck.set(card.deck_id, list);
  }

  return {
    profile,
    decks: decks.map((deck) =>
      summarize(deck, byDeck.get(deck.id) ?? [], identityByOracle),
    ),
  };
}

export async function getProfileByUserId(
  userId: string,
): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export interface PublicDeckSummary {
  id: string;
  name: string;
  cover_art_url: string | null;
  updated_at: string;
  card_count: number;
  color_identity: CardColor[];
  owner: CommentAuthor | null;
}

function toAuthor(profile: Profile | undefined): CommentAuthor | null {
  if (!profile) return null;
  return {
    username: profile.username,
    display_name: profile.display_name,
    avatar_art_url: profile.avatar_art_url,
  };
}

/** Public decks from every user, newest first. */
export async function getPublicDecks(limit = 60): Promise<PublicDeckSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data: deckData } = await supabase
    .from("decks")
    .select("*")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(limit);

  const decks = (deckData ?? []) as Deck[];
  if (!decks.length) return [];

  const deckIds = decks.map((deck) => deck.id);
  const ownerIds = [...new Set(decks.map((deck) => deck.user_id))];
  const [cardsResult, profilesResult] = await Promise.all([
    supabase
      .from("deck_cards")
      .select("deck_id,oracle_id,quantity,board,card_name")
      .in("deck_id", deckIds),
    supabase
      .from("profiles")
      .select("id,username,display_name,avatar_art_url")
      .in("id", ownerIds),
  ]);

  const cards = (cardsResult.data ?? []) as Pick<
    DeckCard,
    "deck_id" | "oracle_id" | "quantity" | "board" | "card_name"
  >[];
  const profiles = new Map(
    ((profilesResult.data ?? []) as Profile[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const identityByOracle = await buildIdentityMap(
    cards.map((card) => card.oracle_id),
  );

  const byDeck = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = byDeck.get(card.deck_id) ?? [];
    list.push(card);
    byDeck.set(card.deck_id, list);
  }

  return decks.map((deck) => {
    const list = byDeck.get(deck.id) ?? [];
    let cardCount = 0;
    const identity = new Set<CardColor>();
    for (const card of list) {
      if (card.board === "main") cardCount += card.quantity;
      for (const color of identityByOracle.get(card.oracle_id) ?? []) {
        identity.add(color);
      }
    }
    return {
      id: deck.id,
      name: deck.name,
      cover_art_url: deck.cover_art_url,
      updated_at: deck.updated_at,
      card_count: cardCount,
      color_identity: orderIdentity([...identity]),
      owner: toAuthor(profiles.get(deck.user_id)),
    };
  });
}

/** Threaded comments for a deck (top-level with replies). */
export async function getDeckComments(
  deckId: string,
): Promise<DeckCommentView[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("deck_comments")
    .select("*")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: true });

  const comments = (data ?? []) as DeckComment[];
  if (!comments.length) return [];

  const authorIds = [...new Set(comments.map((comment) => comment.user_id))];
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_art_url")
    .in("id", authorIds);
  const profiles = new Map(
    ((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]),
  );

  const views = new Map<string, DeckCommentView>();
  for (const comment of comments) {
    views.set(comment.id, {
      ...comment,
      author: toAuthor(profiles.get(comment.user_id)),
      replies: [],
    });
  }

  const roots: DeckCommentView[] = [];
  for (const comment of comments) {
    const view = views.get(comment.id)!;
    if (comment.parent_id && views.has(comment.parent_id)) {
      views.get(comment.parent_id)!.replies.push(view);
    } else {
      roots.push(view);
    }
  }
  return roots;
}

/** The signed-in user's folders, flat and alphabetical. */
export async function getFolders(): Promise<Folder[]> {
  const session = await getSession();
  if (!session) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("folders").select("*").order("name");
  return (data ?? []) as Folder[];
}
