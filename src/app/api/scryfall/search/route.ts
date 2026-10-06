import type { NextRequest } from "next/server";
import { z } from "zod";
import { ScryfallError, scryfallSearch } from "@/lib/scryfall/client";
import { rateLimitResponse } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().min(1).max(300),
  page: z.coerce.number().int().min(1).max(20).optional().default(1),
});

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request, "api:scryfall:search", 30);
  if (limited) return limited;

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const data = await scryfallSearch(parsed.data.q, parsed.data.page);
    return Response.json(data);
  } catch (error) {
    if (error instanceof ScryfallError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status === 422 ? 400 : 502 },
      );
    }
    console.error("[api/scryfall/search]", error);
    return Response.json(
      { error: "scryfall_unavailable", message: "Scryfall is unreachable." },
      { status: 502 },
    );
  }
}
