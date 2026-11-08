import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPatreonOAuthEnabled } from "@/lib/monetization/flags";
import {
  patreonAuthorizeUrl,
  patreonRedirectUri,
} from "@/lib/monetization/patreon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isPatreonOAuthEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent("/settings/profile");
    return NextResponse.redirect(
      new URL(`/login?next=${next}`, request.url),
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = patreonRedirectUri(new URL(request.url).origin);
  const response = NextResponse.redirect(
    patreonAuthorizeUrl(state, redirectUri),
  );
  response.cookies.set("patreon_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
