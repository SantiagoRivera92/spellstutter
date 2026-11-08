import { isPatreonOAuthEnabled } from "@/lib/monetization/flags";
import {
  parsePatreonMemberWebhook,
  verifyPatreonWebhook,
} from "@/lib/monetization/patreon";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPatreonOAuthEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!process.env.PATREON_WEBHOOK_SECRET?.trim()) {
    return Response.json(
      { error: "webhook_not_configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (
    !verifyPatreonWebhook(
      rawBody,
      request.headers.get("x-patreon-signature"),
    )
  ) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  const event = request.headers.get("x-patreon-event") ?? "";
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const deleted =
    event === "members:delete" || event === "members:pledge:delete";
  const member = parsePatreonMemberWebhook(payload, deleted);
  if (!member?.patreonUserId) {
    return Response.json({ ok: true, ignored: true });
  }

  const campaignId = process.env.PATREON_CAMPAIGN_ID?.trim();
  if (campaignId && member.campaignId && member.campaignId !== campaignId) {
    return Response.json({ ok: true, ignored: true });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("patreon_supporters")
    .update({
      campaign_id: member.campaignId,
      patron_status: member.patronStatus,
      amount_cents: member.amountCents,
      tier_id: member.tierId,
      tier_title: member.tierTitle,
      checked_at: new Date().toISOString(),
    })
    .eq("patreon_user_id", member.patreonUserId);
  if (error) {
    console.error("[patreon/webhook] update failed", error.message);
    return Response.json({ error: "storage_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
