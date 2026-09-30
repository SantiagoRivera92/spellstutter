import { getCardByOracleId, getPrintings } from "@/lib/cards/queries";
import { isMongoConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/cards/[oracleId]">,
) {
  if (!isMongoConfigured()) {
    return Response.json(
      { error: "card_catalog_unavailable" },
      { status: 503 },
    );
  }

  const { oracleId } = await context.params;
  try {
    const [card, printings] = await Promise.all([
      getCardByOracleId(oracleId),
      getPrintings(oracleId),
    ]);
    if (!card) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({ card, printings });
  } catch (error) {
    console.error("[api/cards/:oracleId]", error);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }
}
