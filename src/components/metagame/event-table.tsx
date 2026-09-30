import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { MetagameEvent } from "@/lib/metagame/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function EventTable({ events }: { events: MetagameEvent[] }) {
  if (!events.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No events stored yet. Run the metagame sync to populate leagues and
        challenges.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Recent Pauper events on MTGO</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              Event
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Date
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Decks
            </th>
            <th scope="col" className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.slug}
              className="border-b border-border/60 last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/events/${event.slug}`}
                  className="font-medium hover:text-primary"
                >
                  {event.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Badge tone="outline">{event.event_type}</Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {event.date ? formatDate(event.date) : "—"}
              </td>
              <td className="px-3 py-2 text-right numeric text-muted-foreground">
                {event.deck_count}
              </td>
              <td className="px-3 py-2 text-right">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  MTGO
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
