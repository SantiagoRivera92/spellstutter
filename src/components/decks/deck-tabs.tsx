"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DeckTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function DeckTabs({
  tabs,
  defaultTab,
}: {
  tabs: DeckTab[];
  defaultTab?: string;
}) {
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Deck sections"
        className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto overflow-y-hidden px-4">
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-150",
                  selected
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          className={tab.id === active ? "block" : "hidden"}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
