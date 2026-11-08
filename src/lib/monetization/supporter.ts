import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isPatreonOAuthEnabled,
  isPremiumGatingEnabled,
  patreonMinCents,
} from "./flags";

export interface PatreonSupporter {
  active: boolean;
  tierId: string | null;
  tierTitle: string | null;
  status: string;
  amountCents: number;
  connected: boolean;
}

interface SupporterRow {
  tier_id: string | null;
  tier_title: string | null;
  patron_status: string;
  amount_cents: number;
}

/** Cached per request. Returns null when Patreon OAuth is not connected. */
export const getPatreonSupporter = cache(
  async (): Promise<PatreonSupporter | null> => {
    if (!isPatreonOAuthEnabled()) return null;

    const session = await getSession();
    if (!session) return null;

    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("patreon_supporters")
        .select("tier_id,tier_title,patron_status,amount_cents")
        .eq("user_id", session.id)
        .maybeSingle();

      if (error) {
        console.error("[patreon] supporter lookup failed", error.message);
        return null;
      }

      const row = data as SupporterRow | null;
      if (!row) return null;

      const active =
        row.patron_status === "active_patron" &&
        row.amount_cents > 0 &&
        row.amount_cents >= patreonMinCents();

      return {
        active,
        tierId: row.tier_id,
        tierTitle: row.tier_title,
        status: row.patron_status,
        amountCents: row.amount_cents,
        connected: true,
      };
    } catch (error) {
      console.error("[patreon] supporter lookup threw", error);
      return null;
    }
  },
);

/**
 * Server-side premium gate. Open when monetization/gating is off or Patreon
 * OAuth is not configured; otherwise requires an active paid membership.
 */
export const hasPremiumAccess = cache(async (): Promise<boolean> => {
  if (!isPremiumGatingEnabled()) return true;
  const supporter = await getPatreonSupporter();
  return Boolean(supporter?.active);
});
