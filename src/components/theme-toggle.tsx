"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "spellstutter-theme";
const CHANGE_EVENT = "spellstutter-theme-change";

type Theme = "dark" | "light";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the in-memory toggle still works.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  // Both icons render on the server and are toggled purely with CSS off the
  // pre-paint `data-theme` attribute, so there is no hydration flash.
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      aria-label="Toggle color theme"
    >
      <Sun
        className="hidden size-4 [html[data-theme=light]_&]:block"
        aria-hidden
      />
      <Moon
        className="block size-4 [html[data-theme=light]_&]:hidden"
        aria-hidden
      />
    </button>
  );
}
