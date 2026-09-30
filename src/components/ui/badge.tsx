import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "primary"
  | "secondary"
  | "outline"
  | "success"
  | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-foreground",
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-muted-foreground",
  success: "border border-primary/40 text-primary",
  warning: "border border-secondary/50 text-secondary",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
