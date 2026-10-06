/**
 * Only allow same-origin, absolute-path redirect targets.
 *
 * Rejects protocol-relative (`//host`) and backslash (`/\host`, `\host`)
 * variants, since browsers normalize `\` to `/` when resolving URLs — so
 * `/\evil.com` would otherwise navigate off-site. Percent-encoded and
 * control-character forms are rejected too.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/decks";

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/decks";
  }

  if (!decoded.startsWith("/")) return "/decks";
  if (decoded.startsWith("//")) return "/decks";
  if (decoded.includes("\\")) return "/decks";
  if (/[\u0000-\u001f]/.test(decoded)) return "/decks";

  return value;
}
