import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  SITE_NAME,
  SITE_URL,
} from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Terms of Service"
        description={`The rules for using ${SITE_NAME}.`}
      />

      <div className="mt-6 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <p>Last updated: {LEGAL_LAST_UPDATED}</p>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            1. Acceptance
          </h2>
          <p>
            By accessing or using {SITE_NAME} ({SITE_URL}), you agree to these
            Terms of Service and our{" "}
            <Link
              href="/privacy"
              className="text-primary underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            2. Eligibility and accounts
          </h2>
          <p>
            You must be at least 13 years old, or the minimum age required in
            your jurisdiction, to use the service. You are responsible for
            keeping your account credentials secure and for all activity under
            your account. Provide accurate information and do not impersonate
            another person.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            3. The service
          </h2>
          <p>
            {SITE_NAME} provides Pauper card search, deckbuilding, deck storage,
            metagame data, and related tools. The core deckbuilder, card search,
            decklists, exports, and basic metagame data are free. Certain
            premium analytics are available to active Patreon supporters.
          </p>
          <p>
            We may change, suspend, or discontinue parts of the service at any
            time. We aim to keep data available but do not guarantee
            uninterrupted or permanent access.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            4. Patreon support and premium access
          </h2>
          <p>
            Patreon support is voluntary and handled entirely by Patreon. We do
            not process or store your payment card details. By supporting us on
            Patreon, you also agree to Patreon’s terms and policies.
          </p>
          <p>
            Active supporters may receive premium analytics and a supporter
            badge. Benefits and tier details may change. You can cancel or
            change your membership through Patreon at any time. Cancellation
            takes effect according to Patreon’s billing rules. Refunds, if any,
            are handled by Patreon under its policies; contact us if you need
            help finding the right process.
          </p>
          <p>
            Do not attempt to bypass premium access controls or share access in
            a way that violates these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            5. Your content
          </h2>
          <p>
            You retain ownership of the decks, comments, and other content you
            create. You grant us a non-exclusive, worldwide, royalty-free
            license to host, store, display, and distribute that content as
            needed to operate the service, including showing public and unlisted
            decks to other users.
          </p>
          <p>
            You are responsible for your content. Do not post unlawful,
            infringing, harassing, hateful, or deceptive material. We may remove
            content or suspend accounts that violate these terms or harm the
            service or its users.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            6. Acceptable use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use the service for unlawful purposes or to violate others’ rights.</li>
            <li>Scrape, crawl, or automate access in a way that burdens the service.</li>
            <li>Attempt to gain unauthorized access to accounts, systems, or data.</li>
            <li>Interfere with the service, bypass rate limits, or introduce malware.</li>
            <li>Impersonate another person or misrepresent your affiliation.</li>
            <li>Spam, harass, or abuse other users.</li>
            <li>Circumvent premium access controls or resell access.</li>
            <li>Copy or reuse our code, design, or data in violation of applicable law.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            7. Intellectual property and fan content
          </h2>
          <p>
            The {SITE_NAME} name, design, and software are owned by us or our
            licensors. Card data and images come from Scryfall and other
            third-party sources and remain the property of their respective
            owners.
          </p>
          <p>
            {SITE_NAME} is unofficial Fan Content permitted under the Wizards of
            the Coast Fan Content Policy. Magic: The Gathering is a trademark of
            Wizards of the Coast LLC. We are not affiliated with, endorsed by, or
            sponsored by Wizards of the Coast, Hasbro, or Patreon.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            8. Third-party links and affiliate links
          </h2>
          <p>
            The service may link to third-party sites, including card sellers.
            Some links are affiliate links, meaning we may earn a commission if
            you make a purchase, at no extra cost to you. We are not responsible
            for third-party content, products, or privacy practices.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            9. Disclaimers
          </h2>
          <p>
            The service is provided “as is” and “as available”, without
            warranties of any kind, express or implied, including
            merchantability, fitness for a particular purpose, and
            non-infringement. Card data, prices, metagame statistics, and
            matchup information may be incomplete, delayed, or inaccurate. Do
            not rely on the service for financial, tournament, or purchasing
            decisions without verifying the information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            10. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, we are not liable for any
            indirect, incidental, special, consequential, or punitive damages,
            or for lost data, profits, or goodwill, arising from your use of or
            inability to use the service. Our total liability for any claim
            relating to the service will not exceed the greater of the amount
            you paid us in the twelve months before the claim or USD 50.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            11. Indemnification
          </h2>
          <p>
            You agree to indemnify and hold us harmless from claims, damages,
            losses, and expenses arising from your content, your use of the
            service, or your violation of these terms or applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            12. Termination
          </h2>
          <p>
            You may stop using the service at any time and request account
            deletion. We may suspend or terminate access if you violate these
            terms, create risk for other users, or if required by law. Sections
            that by their nature should survive termination will survive.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            13. Governing law and disputes
          </h2>
          <p>
            These terms are governed by the laws of the jurisdiction in which
            the operator is established, without regard to conflict-of-law
            rules. Disputes will be handled by the competent courts of that
            jurisdiction, unless mandatory local law provides otherwise.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            14. Changes to these terms
          </h2>
          <p>
            We may update these terms from time to time. We will post the new
            version on this page and update the date above. Continued use after
            changes means you accept the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            15. Contact
          </h2>
          <p>
            Questions about these terms? Contact{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
