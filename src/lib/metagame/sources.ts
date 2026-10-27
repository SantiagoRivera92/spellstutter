import type { MetagameEvent } from "./types";

export type MetagameSource =
  | "mtgo"
  | "melee"
  | "cardsrealm"
  | "mtgtop8"
  | "endstep";

const ENV_BY_SOURCE: Record<MetagameSource, string> = {
  mtgo: "METAGAME_MTGO_ENABLED",
  melee: "METAGAME_MELEE_ENABLED",
  cardsrealm: "METAGAME_CARDSREALM_ENABLED",
  mtgtop8: "METAGAME_MTGTOP8_ENABLED",
  endstep: "METAGAME_ENDSTEP_ENABLED",
};

const DEFAULT_ENABLED: Record<MetagameSource, boolean> = {
  mtgo: true,
  melee: true,
  cardsrealm: true,
  mtgtop8: true,
  // endstep's metagame endpoint is currently stale; keep its data out of the UI.
  endstep: false,
};

const FALSE_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

export function isSourceEnabled(source: MetagameSource): boolean {
  const value = process.env[ENV_BY_SOURCE[source]]?.trim().toLowerCase();
  if (!value) return DEFAULT_ENABLED[source];
  return !FALSE_VALUES.has(value);
}

export function enabledSources(): MetagameSource[] {
  return (Object.keys(DEFAULT_ENABLED) as MetagameSource[]).filter(
    isSourceEnabled,
  );
}

export function eventSource(event: Pick<MetagameEvent, "slug" | "url">): Exclude<MetagameSource, "endstep"> {
  if (event.slug.startsWith("melee-") || event.url.includes("melee.gg")) {
    return "melee";
  }
  if (
    event.slug.startsWith("cardsrealm-") ||
    event.url.includes("cardsrealm.com")
  ) {
    return "cardsrealm";
  }
  if (
    event.slug.startsWith("mtgtop8-") ||
    event.url.includes("mtgtop8.com")
  ) {
    return "mtgtop8";
  }
  return "mtgo";
}

const EVENT_SOURCE_MATCHERS: Record<
  Exclude<MetagameSource, "endstep">,
  Record<string, unknown>
> = {
  melee: {
    $or: [{ slug: /^melee-/ }, { url: /melee\.gg/ }],
  },
  cardsrealm: {
    $or: [{ slug: /^cardsrealm-/ }, { url: /cardsrealm\.com/ }],
  },
  mtgtop8: {
    $or: [{ slug: /^mtgtop8-/ }, { url: /mtgtop8\.com/ }],
  },
  mtgo: {
    $nor: [
      { slug: /^melee-/ },
      { slug: /^cardsrealm-/ },
      { slug: /^mtgtop8-/ },
      { url: /melee\.gg/ },
      { url: /cardsrealm\.com/ },
      { url: /mtgtop8\.com/ },
    ],
  },
};

/** Mongo filter for events whose source is enabled. */
export function eventSourceFilter(): Record<string, unknown> {
  const enabled = (
    ["mtgo", "melee", "cardsrealm", "mtgtop8"] as const
  ).filter(isSourceEnabled);
  if (!enabled.length) return { slug: { $in: [] } };
  if (enabled.length === 4) return {};
  return { $or: enabled.map((source) => EVENT_SOURCE_MATCHERS[source]) };
}

/**
 * Mongo filter for decks belonging to an enabled event source.
 *
 * Decks do not store a source field; the event slug prefix is the source of
 * truth used by every sync.
 */
export function deckSourceFilter(): Record<string, unknown> {
  const enabled = (
    ["mtgo", "melee", "cardsrealm", "mtgtop8"] as const
  ).filter(isSourceEnabled);
  if (!enabled.length) return { event_slug: { $in: [] } };
  if (enabled.length === 4) return {};

  const alternatives: Record<string, unknown>[] = [];
  if (enabled.includes("melee")) {
    alternatives.push({ event_slug: /^melee-/ });
  }
  if (enabled.includes("cardsrealm")) {
    alternatives.push({ event_slug: /^cardsrealm-/ });
  }
  if (enabled.includes("mtgtop8")) {
    alternatives.push({ event_slug: /^mtgtop8-/ });
  }
  if (enabled.includes("mtgo")) {
    alternatives.push({
      $nor: [
        { event_slug: /^melee-/ },
        { event_slug: /^cardsrealm-/ },
        { event_slug: /^mtgtop8-/ },
      ],
    });
  }
  return alternatives.length === 1 ? alternatives[0] : { $or: alternatives };
}

/** Combine a query filter with the enabled-source filter. */
export function withDeckSources<T extends Record<string, unknown>>(filter: T) {
  const source = deckSourceFilter();
  if (!Object.keys(source).length) return filter;
  return { $and: [filter, source] };
}

export function withEventSources<T extends Record<string, unknown>>(filter: T) {
  const source = eventSourceFilter();
  if (!Object.keys(source).length) return filter;
  return { $and: [filter, source] };
}
