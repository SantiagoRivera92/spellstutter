import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
        >
          <Link href="/events" className="hover:text-foreground">
            Events
          </Link>
          <Link href="/metagame" className="hover:text-foreground">
            Metagame
          </Link>
          <Link href="/decks" className="hover:text-foreground">
            My decks
          </Link>
        </nav>
        <p className="mt-6 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Spellstutter is unofficial Fan Content permitted under the Wizards of
          the Coast Fan Content Policy. Magic: The Gathering is a trademark of
          Wizards of the Coast LLC. Card data from Scryfall.
        </p>
      </div>
    </footer>
  );
}
