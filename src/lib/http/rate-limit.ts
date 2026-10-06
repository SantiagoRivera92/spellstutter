import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/auth/rate-limit";

/**
 * Per-IP throttle for route handlers. Returns a 429 response when the caller
 * exceeds `max` requests per `windowMs`, otherwise null.
 */
export function rateLimitResponse(
  request: NextRequest,
  bucket: string,
  max = 60,
  windowMs = 60_000,
): Response | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(`${bucket}:${ip}`, max, windowMs)) return null;

  return Response.json(
    { error: "rate_limited", message: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
