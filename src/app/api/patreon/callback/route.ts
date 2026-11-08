import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPatreonOAuthEnabled } from "@/lib/monetization/flags";
import {
  exchangePatreonCode,
  fetchPatreonSupport,
  patreonRedirectUri,
} from "@/lib/monetization/patreon";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function settingsRedirect(request: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(`/settings/profile?patreon=${status}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  if (!isPatreonOAuthEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent("/settings/profile")}`,
        request.url,
      ),
    );
  }

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return settingsRedirect(request, "denied");

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("patreon_oauth_state")?.value;
  if (!code || !state || state !== expectedState) {
    return settingsRedirect(request, "state_error");
  }

  try {
    const redirectUri = patreonRedirectUri(new URL(request.url).origin);
    const accessToken = await exchangePatreonCode(code, redirectUri);
    const support = await fetchPatreonSupport(accessToken);
    if (!support) return settingsRedirect(request, "error");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("patreon_supporters").upsert(
      {
        user_id: session.id,
        patreon_user_id: support.patreonUserId,
        campaign_id: support.campaignId,
        tier_id: support.tierId,
        tier_title: support.tierTitle,
        patron_status: support.patronStatus,
        amount_cents: support.amountCents,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("[patreon] save supporter failed", error.message);
      return settingsRedirect(request, "error");
    }

    const response = settingsRedirect(request, "connected");
    response.cookies.delete("patreon_oauth_state");
    return response;
  } catch (error) {
    console.error("[patreon] callback failed", error);
    return settingsRedirect(request, "error");
  }
}
