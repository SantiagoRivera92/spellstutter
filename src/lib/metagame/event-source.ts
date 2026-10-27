import type { MetagameEvent } from "./types";

type EventSourceFields = Pick<MetagameEvent, "slug" | "url">;

export function isMeleeEvent(event: EventSourceFields): boolean {
  return event.slug.startsWith("melee-") || event.url.includes("melee.gg");
}

export function isCardsrealmEvent(event: EventSourceFields): boolean {
  return (
    event.slug.startsWith("cardsrealm-") ||
    event.url.includes("cardsrealm.com")
  );
}

export function isMtgtop8Event(event: EventSourceFields): boolean {
  return (
    event.slug.startsWith("mtgtop8-") || event.url.includes("mtgtop8.com")
  );
}

export function eventSourceName(
  event: EventSourceFields,
): "melee.gg" | "Cardsrealm" | "MTGTop8" | "MTGO" {
  if (isMeleeEvent(event)) return "melee.gg";
  if (isCardsrealmEvent(event)) return "Cardsrealm";
  if (isMtgtop8Event(event)) return "MTGTop8";
  return "MTGO";
}
