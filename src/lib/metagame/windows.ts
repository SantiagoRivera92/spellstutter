/** Selectable metagame time windows, in days. */
export const METAGAME_WINDOWS = [7, 14, 30, 120] as const;

export function parseMetagameWindow(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return (METAGAME_WINDOWS as readonly number[]).includes(parsed) ? parsed : 30;
}
