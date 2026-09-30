"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const usernameSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{1,22})[a-zA-Z0-9]$/,
    "Use 3–24 letters, numbers, dashes, or underscores.",
  );

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/decks";
}

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this environment." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "That email and password combination did not work." };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this environment." };
  }

  const parsed = credentialsSchema
    .extend({
      username: usernameSchema,
      display_name: z.string().max(80).optional(),
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      username: formData.get("username"),
      display_name: formData.get("display_name") || undefined,
    });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        username: parsed.data.username,
        display_name: parsed.data.display_name ?? parsed.data.username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      message:
        "Check your inbox to confirm your email, then sign in. The email links back to this site.",
    };
  }

  redirect(safeNext(formData.get("next")));
}
