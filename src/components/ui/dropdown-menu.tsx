"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  label: string;
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  label,
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const closeAndRestoreFocus = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled])',
        ) ?? [],
      );

    items()[0]?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      const list = items();
      if (!list.length) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          list[(index + 1) % list.length].focus();
          break;
        case "ArrowUp":
          event.preventDefault();
          list[(index - 1 + list.length) % list.length].focus();
          break;
        case "Home":
          event.preventDefault();
          list[0].focus();
          break;
        case "End":
          event.preventDefault();
          list[list.length - 1].focus();
          break;
        case "Tab":
          // Let focus leave the menu naturally.
          setOpen(false);
          break;
        case "Escape":
          event.preventDefault();
          closeAndRestoreFocus();
          break;
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeAndRestoreFocus]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onClick={(event) => {
            if (
              (event.target as HTMLElement).closest('[role="menuitem"]')
            ) {
              setOpen(false);
            }
          }}
          className={cn(
            "absolute z-40 mt-1 min-w-52 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(menuItemClass, destructive && "text-destructive", className)}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

export function MenuLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} role="menuitem" className={cn(menuItemClass, className)}>
      {children}
    </Link>
  );
}
