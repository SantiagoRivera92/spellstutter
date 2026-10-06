import type { NextRequest } from "next/server";
import { z } from "zod";
import { searchCards } from "@/lib/cards/queries";
import { isMongoConfigured } from "@/lib/env";
import { rateLimitResponse } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(200).optional().default(""),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(50),
  sort: z.enum(["name", "cmc", "price", "rarity"]).optional().default("name"),
  dir: z.enum(["asc", "desc"]).optional().default("asc"),
});

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request, "api:cards:search", 60);
  if (limited) return limited;

  if (!isMongoConfigured()) {
    return Response.json(
      {
        error: "card_catalog_unavailable",
        message:
          "The card catalog is not configured. Set MONGODB_URI and run the Scryfall sync.",
      },
      { status: 503 },
    );
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const data = await searchCards({
      q: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.page_size,
      sort: parsed.data.sort,
      dir: parsed.data.dir,
    });
    return Response.json(data);
  } catch (error) {
    console.error("[api/cards/search]", error);
    return Response.json(
      { error: "search_failed", message: "Card search failed." },
      { status: 500 },
    );
  }
}
