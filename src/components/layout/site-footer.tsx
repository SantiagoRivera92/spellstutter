import Link from "next/link";
import { donationUrl } from "@/lib/monetization/flags";
import { affiliateDisclosure } from "@/lib/monetization/affiliate";

export function SiteFooter() {
  const supportUrl = donationUrl();
  const affiliateNote = affiliateDisclosure();

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
          {supportUrl ? (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Support
            </a>
          ) : null}
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
        {affiliateNote ? (
          <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
            {affiliateNote}
          </p>
        ) : null}
        <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Spellstutter is unofficial Fan Content permitted under the Wizards of
          the Coast Fan Content Policy. Magic: The Gathering is a trademark of
          Wizards of the Coast LLC. Card data from Scryfall.
        </p>
      </div>
    </footer>
  );
}
