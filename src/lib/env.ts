export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export const MONGODB_DB = process.env.MONGODB_DB ?? "spellstutter";

/**
 * Canonical site origin. Prefer an explicit env var so redirects never trust
 * a spoofable Host / x-forwarded-host header; fall back to the request origin.
 */
export function getSiteUrl(fallback: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production so redirects and crawler metadata never trust a spoofable Host header.",
    );
  }
  return fallback;
}

/**
 * Canonical base URL for crawler endpoints (sitemap, robots). Must be absolute,
 * so it has a localhost fallback in development only.
 */
export function getSiteBase(): string {
  return getSiteUrl("http://localhost:3000");
}
