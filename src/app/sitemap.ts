import type { MetadataRoute } from "next";
import { getSiteBase, isMongoConfigured } from "@/lib/env";
import { listArchetypes, listEvents } from "@/lib/metagame/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteBase();

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/metagame",
    "/events",
    "/staples",
    "/decks/public",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  if (!isMongoConfigured()) return staticRoutes;

  const [archetypes, events] = await Promise.all([
    listArchetypes().catch(() => []),
    // Bounded so a crawl never loads an unbounded event history; the sitemap
    // protocol allows far more URLs than the metagame currently has events.
    listEvents(2000).catch(() => []),
  ]);

  return [
    ...staticRoutes,
    ...archetypes.map((archetype) => ({
      url: `${base}/metagame/archetypes/${archetype.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...events.map((event) => ({
      url: `${base}/events/${event.slug}`,
      lastModified: event.date ? new Date(event.date) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
