"use client";

import * as React from "react";
import { useActionState } from "react";
import { updatePasswordAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Field
        label="New password"
        htmlFor="password"
        description="At least 8 characters."
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirm"
        error={state.fieldErrors?.confirm}
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={Boolean(state.fieldErrors?.confirm)}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
