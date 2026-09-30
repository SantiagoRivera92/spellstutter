"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.id)
    .is("read_at", null);
  revalidatePath("/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.id);
  revalidatePath("/notifications");
}
