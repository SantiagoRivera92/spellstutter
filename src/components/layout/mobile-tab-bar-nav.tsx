"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutGrid, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/metagame",
    label: "Browse",
    icon: Compass,
    match: ["/metagame", "/events", "/staples"],
  },
  {
    href: "/decks",
    label: "Decks",
    icon: LayoutGrid,
    match: ["/decks"],
  },
  {
    href: "/cards",
    label: "Search",
    icon: Search,
    match: ["/cards"],
  },
] as const;

export function MobileTabBarNav({ profileHref }: { profileHref: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.match.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
          );
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors duration-150",
                  active
                    ? "text-nav-active"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href={profileHref}
            aria-current={pathname.startsWith("/users/") ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors duration-150",
              pathname.startsWith("/users/")
                ? "text-nav-active"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <User className="size-5" aria-hidden />
            Profile
          </Link>
        </li>
      </ul>
    </nav>
  );
}
