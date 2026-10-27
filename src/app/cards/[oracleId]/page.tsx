import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PrintingGallery } from "@/components/cards/printing-gallery";
import { ManaCost } from "@/components/cards/mana-cost";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { getCardByOracleId, getPrintingsPage } from "@/lib/cards/queries";
import { isPauperLegal, PRINTINGS_PAGE_SIZE } from "@/lib/cards/types";
import { isMongoConfigured } from "@/lib/env";
import { getArchetypesForCard } from "@/lib/metagame/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/cards/[oracleId]">): Promise<Metadata> {
  const { oracleId } = await params;
  if (!isMongoConfigured()) return { title: "Card" };
  const card = await getCardByOracleId(oracleId).catch(() => null);
  const title = card?.name ?? "Card";
  const description = card?.type_line
    ? `${card.type_line} — Pauper card on Spellstutter.`
    : "A Pauper card on Spellstutter.";
  const image =
    card?.image_uris?.normal ??
    card?.card_faces?.[0]?.image_uris?.normal ??
    undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CardPage({
  params,
}: PageProps<"/cards/[oracleId]">) {
  const { oracleId } = await params;

  if (!isMongoConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <SetupNotice title="Connect the card catalog">
          <p>Configure MongoDB and run the Scryfall sync to view cards.</p>
        </SetupNotice>
      </div>
    );
  }

  const card = await getCardByOracleId(oracleId).catch(() => null);
  if (!card) notFound();

  const defaultPrintingId =
    card.metagame_printing_id ?? card.default_printing_id;
  const pauper = isPauperLegal(card);
  const [printingPage, usage] = await Promise.all([
    getPrintingsPage(oracleId, {
      limit: PRINTINGS_PAGE_SIZE,
      preferScryfallId: defaultPrintingId,
    }).catch(() => ({ printings: [], total: 0 })),
    pauper
      ? getArchetypesForCard(oracleId, 120).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <PrintingGallery
          key={oracleId}
          oracleId={oracleId}
          name={card.name}
          printings={printingPage.printings}
          total={printingPage.total}
          defaultPrintingId={defaultPrintingId}
        />

        <div className="min-w-0">
          <PageHeader
            title={card.name}
            actions={
              card.scryfall_uri ? (
                <a
                  href={card.scryfall_uri}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  Scryfall
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : undefined
            }
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ManaCost
              cost={
                card.card_faces?.length
                  ? card.card_faces
                      .map((face) => face.mana_cost)
                      .filter(Boolean)
                  : card.mana_cost
              }
            />
            {pauper ? (
              <Badge tone="primary">Pauper legal</Badge>
            ) : (
              <Badge tone="outline" className="text-muted-foreground">
                Not Pauper legal
              </Badge>
            )}
            <Badge tone="outline">{card.printings_count} printings</Badge>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {card.type_line || card.card_faces?.map((f) => f.type_line).join(" // ")}
          </p>

          {card.oracle_text || card.card_faces?.length ? (
            <div className="mt-4 space-y-2 rounded-lg border border-border bg-card p-4 text-sm leading-relaxed whitespace-pre-line">
              {card.card_faces?.length
                ? card.card_faces.map((face) => (
                    <p key={face.name}>
                      {face.name !== card.name ? (
                        <span className="font-medium">{face.name} — </span>
                      ) : null}
                      {face.oracle_text}
                    </p>
                  ))
                : card.oracle_text}
            </div>
          ) : null}

          {pauper ? (
            <section className="mt-8" aria-labelledby="usage-heading">
              <h2 id="usage-heading" className="mb-1 font-display text-base font-medium">
                Played in these archetypes
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Based on the last 120 days of MTGO Pauper results.
              </p>
              {usage.length ? (
                <ul className="space-y-2">
                  {usage.map((entry) => (
                    <li
                      key={entry.slug}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
                    >
                      <Link
                        href={`/metagame/archetypes/${entry.slug}`}
                        className="font-medium hover:text-primary"
                      >
                        {entry.name}
                      </Link>
                      <span className="numeric text-xs text-muted-foreground">
                        {(entry.include_rate * 100).toFixed(0)}% of lists ·{" "}
                        {entry.avg_qty.toFixed(1)} copies avg · {entry.decks}{" "}
                        deck{entry.decks === 1 ? "" : "s"}
                      </span>
                      <span className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/80"
                          style={{ width: `${entry.include_rate * 100}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No stored archetype currently runs this card.
                </p>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
