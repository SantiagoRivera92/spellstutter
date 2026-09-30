import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signInAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/decks";

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-title font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to brew decks, organise folders, and see metagame statistics.
      </p>
      <div className="mt-8">
        <AuthForm mode="signin" action={signInAction} next={next} />
      </div>
    </div>
  );
}
