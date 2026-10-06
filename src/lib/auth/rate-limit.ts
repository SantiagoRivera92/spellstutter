/**
 * Best-effort, per-instance sliding-window rate limiter for auth endpoints.
 *
 * This is intentionally dependency-free: it is a cheap first line of defence
 * on top of Supabase's own per-project limits, not a replacement for a shared
 * store (Redis / Postgres) in a multi-instance deployment.
 */
const WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, number[]>();

export function rateLimit(
  key: string,
  max: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);

  if (recent.length >= max) {
    attempts.set(key, recent);
    return false;
  }

  recent.push(now);
  attempts.set(key, recent);

  if (attempts.size > 5000) {
    for (const [entryKey, times] of attempts) {
      if (!times.some((time) => now - time < windowMs)) attempts.delete(entryKey);
    }
  }

  return true;
}
