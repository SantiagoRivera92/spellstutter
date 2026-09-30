"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSession, type Session } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

type ProfileContext =
  | { ok: false; error: string }
  | { ok: true; session: Session; supabase: SupabaseClient };

async function context(): Promise<ProfileContext> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  const supabase = await createSupabaseServerClient();
  return { ok: true, session, supabase };
}

export async function updateProfile(input: {
  displayName: string;
  bio: string;
  isPublic: boolean;
}): Promise<ProfileActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = z
    .object({
      displayName: z.string().trim().min(1).max(80),
      bio: z.string().trim().max(400),
      isPublic: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_profile" };

  try {
    const { error } = await ctx.supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        bio: parsed.data.bio || null,
        is_public: parsed.data.isPublic,
      })
      .eq("id", ctx.session.id);

    if (error) return { ok: false, error: error.message };
  } catch (error) {
    console.error("[profile] updateProfile failed", error);
    return { ok: false, error: "network" };
  }

  revalidatePath("/settings/profile");
  if (ctx.session.profile) revalidatePath(`/users/${ctx.session.profile.username}`);
  return { ok: true };
}

export async function setProfileAvatar(input: {
  oracleId: string | null;
  cardName: string | null;
  artUrl: string | null;
}): Promise<ProfileActionResult> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      avatar_card_oracle_id: input.oracleId,
      avatar_card_name: input.cardName,
      avatar_art_url: input.artUrl,
    })
    .eq("id", ctx.session.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/profile");
  if (ctx.session.profile) revalidatePath(`/users/${ctx.session.profile.username}`);
  return { ok: true };
}
