import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-title font-bold">Reset your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email you signed up with and we&apos;ll send you a reset link.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
