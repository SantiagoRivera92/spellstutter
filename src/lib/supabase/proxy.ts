import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: must be called to refresh expired auth tokens.
  //
  // This is an optimistic check, so a Supabase outage must not take the whole
  // site down: if the call fails we treat the visitor as signed out and let the
  // request through, rather than throwing and failing every navigation and
  // server action (which the browser surfaces as a NetworkError).
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("[proxy] Supabase auth check failed", error);
  }

  const path = request.nextUrl.pathname;
  // A deck view (/decks/<id>) is public shareable: RLS decides whether the
  // visitor may read it, so it must not be gated here. Only the library and
  // the editor require a session.
  const requiresAuth =
    path === "/decks" ||
    /^\/decks\/[^/]+\/edit$/.test(path) ||
    path.startsWith("/settings") ||
    path.startsWith("/brew");

  if (requiresAuth && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
