import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/staples", label: "Overview" },
  { href: "/staples/creatures", label: "Creatures" },
  { href: "/staples/spells", label: "Spells & Artifacts" },
  { href: "/staples/lands", label: "Lands" },
  { href: "/staples/sideboard", label: "Sideboard" },
];

export function StapleTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Staple categories">
      <ul className="flex flex-wrap gap-1 border-b border-border pb-3">
        {TABS.map((tab) => {
          const isActive = tab.href === active;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
