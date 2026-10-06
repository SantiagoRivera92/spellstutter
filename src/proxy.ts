import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSrc = [
    "'self'",
    supabase,
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cards.scryfall.io https://svgs.scryfall.io",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Next reads the nonce from the request's CSP header and applies it to its
  // own scripts; the layout reads `x-nonce` for the inline theme script.
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request except Next.js internals and static assets so
     * Supabase can refresh the session cookie.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
