import "server-only";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The signed-in user's favourite printing for a card, if any. */
export async function getFavoritePrintingId(
  oracleId: string,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("favorite_printings")
    .select("printing_id")
    .eq("user_id", session.id)
    .eq("oracle_id", oracleId)
    .maybeSingle();
  return (data as { printing_id: string } | null)?.printing_id ?? null;
}
