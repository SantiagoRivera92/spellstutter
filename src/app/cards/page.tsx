import type { Metadata } from "next";
import { CardSearch } from "@/components/cards/card-search";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Search cards" };
export const dynamic = "force-dynamic";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Search cards"
        description="Search every card on Scryfall by name or full syntax. Open a card to see its printings and Pauper legality."
      />
      <div className="mt-6">
        <CardSearch
          autoFocus
          initialQuery={q}
          emptyHint="Try a card name, or syntax like t:instant c:u cmc<=2. Every card is searchable; Pauper legality is verified when you add it to a deck."
        />
      </div>
    </div>
  );
}
