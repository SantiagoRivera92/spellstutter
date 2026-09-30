"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Settings, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  MenuItem,
  MenuLink,
  MenuSeparator,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { Sigil } from "./sigil";

export interface HeaderSession {
  username: string;
  displayName: string;
  avatarArtUrl: string | null;
}

const NAV = [
  { href: "/events", label: "Events", prefix: true },
  { href: "/metagame", label: "Metagame", prefix: true },
  { href: "/staples", label: "Staples", prefix: false },
  { href: "/decks/public", label: "User decks", prefix: false },
  { href: "/decks", label: "My decks", prefix: false },
];

export function HeaderNav({
  session,
  unread = 0,
}: {
  session: HeaderSession | null;
  unread?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground"
          aria-label="Spellstutter home"
        >
          <Sigil className="size-6 text-primary" />
          <span className="font-display text-lg font-bold tracking-tight">
            Spellstutter
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.prefix && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {session ? (
            <Link
              href="/notifications"
              aria-label={
                unread ? `Notifications, ${unread} unread` : "Notifications"
              }
              className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-4" aria-hidden />
              {unread > 0 ? (
                <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          <ThemeToggle />
          {session ? (
            <DropdownMenu
              label="Account menu"
              trigger={
                <span className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors duration-150 hover:bg-muted">
                  <Avatar
                    src={session.avatarArtUrl}
                    name={session.displayName}
                    size={26}
                  />
                  <span className="hidden text-sm font-medium sm:inline">
                    {session.displayName}
                  </span>
                </span>
              }
            >
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium">{session.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  @{session.username}
                </p>
              </div>
              <MenuSeparator />
              <MenuLink href={`/users/${session.username}`}>
                <User className="size-4" aria-hidden />
                Public profile
              </MenuLink>
              <MenuLink href="/settings/profile">
                <Settings className="size-4" aria-hidden />
                Settings
              </MenuLink>
              <MenuSeparator />
              <SignOutItem />
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Create account
              </Link>
            </div>
          )}

          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-border md:hidden"
        >
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {!session ? (
              <li className="flex gap-2 px-1 py-2">
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className={buttonVariants({ variant: "primary", size: "sm", className: "flex-1" })}
                >
                  Create account
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function SignOutItem() {
  const [pending, startTransition] = React.useTransition();

  return (
    <MenuItem
      destructive
      disabled={pending}
      onClick={() => startTransition(() => void signOutAction())}
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </MenuItem>
  );
}
