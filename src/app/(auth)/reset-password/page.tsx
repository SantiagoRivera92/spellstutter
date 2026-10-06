import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-title font-bold">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick a new password for your account.
      </p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
