"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 px-4 py-20">
      <TriangleAlert className="size-8 text-secondary" aria-hidden />
      <div className="space-y-1">
        <h1 className="font-display text-xl font-medium">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error stopped this page from loading. Try again — if it
          keeps happening, head back home.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
