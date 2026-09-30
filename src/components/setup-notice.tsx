import { Database, KeyRound } from "lucide-react";
import type { ReactNode } from "react";

export function SetupNotice({
  title,
  children,
  icon = "database",
}: {
  title: string;
  children: ReactNode;
  icon?: "database" | "key";
}) {
  const Icon = icon === "key" ? KeyRound : Database;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
        <div className="space-y-2">
          <h2 className="font-display text-base font-medium">{title}</h2>
          <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
