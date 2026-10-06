"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimit } from "@/lib/auth/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function authRateLimit(prefix: string): Promise<boolean> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return rateLimit(`${prefix}:${ip}`);
}

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
  return safeNextPath(typeof value === "string" ? value : null);
}

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  return getSiteUrl(`${proto}://${host}`);
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this environment." };
  }
  if (!(await authRateLimit("signin"))) {
    return { error: "Too many attempts. Please try again in a few minutes." };
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

export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this environment." };
  }
  if (!(await authRateLimit("forgot"))) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  const parsed = z
    .object({ email: z.string().email("Enter a valid email address.") })
    .safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Invalid email." } };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  // Report success regardless, to avoid revealing which emails are registered.
  await supabase.auth
    .resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    })
    .catch(() => undefined);

  return {
    message:
      "If that email is registered, a password reset link is on its way.",
  };
}

export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this environment." };
  }
  if (!(await authRateLimit("update-password"))) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  const parsed = z
    .object({
      password: z.string().min(8, "Use at least 8 characters."),
      confirm: z.string().min(8, "Use at least 8 characters."),
    })
    .refine((value) => value.password === value.confirm, {
      path: ["confirm"],
      message: "Passwords do not match.",
    })
    .safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  redirect("/decks?password=updated");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this environment." };
  }
  if (!(await authRateLimit("signup"))) {
    return { error: "Too many attempts. Please try again in a few minutes." };
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
