import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCardByOracleId, getPrintingsPage } from "@/lib/cards/queries";
import { MAX_PRINTINGS_PAGE_SIZE, PRINTINGS_PAGE_SIZE } from "@/lib/cards/types";
import { isMongoConfigured } from "@/lib/env";
import { rateLimitResponse } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PRINTINGS_PAGE_SIZE)
    .optional()
    .default(PRINTINGS_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
  prefer: z.string().max(100).optional(),
});

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/cards/[oracleId]">,
) {
  const limited = rateLimitResponse(request, "api:cards:lookup", 120);
  if (limited) return limited;

  if (!isMongoConfigured()) {
    return Response.json(
      { error: "card_catalog_unavailable" },
      { status: 503 },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { oracleId } = await context.params;
  try {
    const [card, page] = await Promise.all([
      getCardByOracleId(oracleId),
      getPrintingsPage(oracleId, {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        preferScryfallId: parsed.data.prefer,
      }),
    ]);
    if (!card) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({
      card,
      printings: page.printings,
      total: page.total,
      offset: parsed.data.offset,
      limit: parsed.data.limit,
    });
  } catch (error) {
    console.error("[api/cards/:oracleId]", error);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }
}
