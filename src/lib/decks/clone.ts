import type { MetagameDeck } from "@/lib/metagame/types";
import type { DeckBoard } from "@/lib/supabase/types";

export interface CloneRow {
  deck_id: string;
  oracle_id: string;
  printing_id: string | null;
  card_name: string;
  quantity: number;
  board: DeckBoard;
}

/**
 * Turn a metagame decklist into deck_cards rows, merging duplicate oracle ids
 * within a board and capping quantities at 999.
 */
export function buildCloneRows(
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
