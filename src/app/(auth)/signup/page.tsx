import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signUpAction } from "../actions";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/decks";

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-title font-bold">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Free, and it unlocks metagame statistics. Browsing the metagame itself
        never needs an account.
      </p>
      <div className="mt-8">
        <AuthForm mode="signup" action={signUpAction} next={next} />
      </div>
    </div>
  );
}
