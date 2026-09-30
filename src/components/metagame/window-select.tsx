"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";
import { METAGAME_WINDOWS } from "@/lib/metagame/windows";

export function MetagameWindowSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Last
      <Select
        aria-label="Metagame time window"
        value={String(value)}
        className="h-9 w-auto"
        onChange={(event) =>
          router.push(`${pathname}?window=${event.target.value}`)
        }
      >
        {METAGAME_WINDOWS.map((days) => (
          <option key={days} value={days}>
            {days} days
          </option>
        ))}
      </Select>
    </label>
  );
}
