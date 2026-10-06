import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export interface Session {
  id: string;
  email: string;
  profile: Profile | null;
}

/**
 * Cached per request so the root layout, the page, and `generateMetadata` share
 * one `auth.getUser()` + `profiles.select` round-trip instead of repeating it.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    return { id: user.id, email: user.email ?? "", profile };
  } catch (error) {
    console.error("[auth] failed to resolve session", error);
    return null;
  }
});


