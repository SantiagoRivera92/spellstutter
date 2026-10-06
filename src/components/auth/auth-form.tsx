"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { AuthState } from "@/app/(auth)/actions";

interface AuthFormProps {
  mode: "signin" | "signup";
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
}

export function AuthForm({ mode, action, next }: AuthFormProps) {
  const [state, formAction, pending] = React.useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/decks"} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          {state.message}
        </p>
      ) : null}

      {mode === "signup" ? (
        <Field
          label="Username"
          htmlFor="username"
          description="Shown on public decks. Letters, numbers, dashes, underscores."
          error={state.fieldErrors?.username}
        >
          <Input
            id="username"
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
            invalid={Boolean(state.fieldErrors?.username)}
          />
        </Field>
      ) : null}

      <Field
        label="Email"
        htmlFor="email"
        helper={
          mode === "signin" ? (
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          ) : undefined
        }
        error={state.fieldErrors?.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        description={mode === "signup" ? "At least 8 characters." : undefined}
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending
          ? mode === "signin"
            ? "Signing in…"
            : "Creating account…"
          : mode === "signin"
            ? "Sign in"
            : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
