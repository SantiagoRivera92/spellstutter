import type { DeckBoard } from "@/lib/supabase/types";

export interface ParsedDeckEntry {
  quantity: number;
  name: string;
  board: DeckBoard;
}

/** Matches "4 Card", "4x Card", and "SB: 4 Card" (sideboard prefix). */
const LINE_PATTERN = /^(?:(SB):\s*)?(\d+)x?\s+(.+)$/i;

function cleanCardName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^SB:\s*/i, "");
  name = name.replace(/\s+\*[A-Z]+\*/g, "");
  name = name.replace(/\s+#\S+/g, "");
  name = name.replace(/\s+\([A-Z0-9_]+\)\s*[A-Z0-9-]*\s*$/i, "");
  return name.trim();
}

/**
 * Parse an MTGO/Arena-style decklist. Blank lines and `//` comments are
 * ignored, `Sideboard` switches the current board, and `SB:` prefixes one line.
 */
export function parseDecklist(
  text: string,
  defaultBoard: DeckBoard = "main",
): ParsedDeckEntry[] {
  const entries: ParsedDeckEntry[] = [];
  let currentBoard: DeckBoard = defaultBoard;

  for (const line of text.split(/\r?\n/)) {
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
    const quantity = Number.parseInt(match[2], 10);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const name = cleanCardName(match[3]);
    if (name) {
      entries.push({
        quantity,
        name,
        board: match[1] ? "side" : currentBoard,
      });
    }
  }

  return entries;
}
