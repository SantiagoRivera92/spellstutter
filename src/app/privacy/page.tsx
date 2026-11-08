import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  SITE_NAME,
  SITE_URL,
} from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Privacy Policy"
        description={`How ${SITE_NAME} collects, uses, and protects your information.`}
      />

      <div className="mt-6 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <p>Last updated: {LEGAL_LAST_UPDATED}</p>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            1. Who we are
          </h2>
          <p>
            {SITE_NAME} ({SITE_URL}) is an independent, unofficial Pauper
            deckbuilding and metagame tracker. References to “we”, “us”, and
            “our” mean the operator of {SITE_NAME}. You can contact us about
            privacy at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            2. Information we collect
          </h2>
          <p>We collect the following categories of information:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Account information:</strong>{" "}
              email address, username, display name, bio, and chosen avatar.
            </li>
            <li>
              <strong className="text-foreground">Your content:</strong> decks,
              folders, card lists, comments, replies, notifications, and
              favourite printings.
            </li>
            <li>
              <strong className="text-foreground">Patreon information:</strong>{" "}
              if you choose to link your Patreon account, we receive your
              Patreon user ID, campaign ID, membership status, tier, and pledge
              amount. We do not store your Patreon access or refresh tokens.
              Patreon processes your payment and billing information directly.
            </li>
            <li>
              <strong className="text-foreground">Technical information:</strong>{" "}
              IP address, browser and device information, request logs, and
              security signals processed by our hosting and infrastructure
              providers.
            </li>
            <li>
              <strong className="text-foreground">Cookies and local storage:</strong>{" "}
              authentication cookies, a short-lived Patreon OAuth state cookie,
              and a local-storage preference for light or dark theme.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            3. How we use information
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Create and secure your account.</li>
            <li>Store, display, and share your decks and comments.</li>
            <li>Provide notifications about comments and replies.</li>
            <li>
              Verify Patreon support status and unlock premium analytics for
              active supporters.
            </li>
            <li>Operate, maintain, and improve the service.</li>
            <li>Detect abuse, prevent fraud, and protect the service.</li>
            <li>Comply with legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            4. Legal bases
          </h2>
          <p>
            Where data protection law requires a legal basis, we rely on: the
            performance of our contract with you (providing the service),
            legitimate interests (security, operation, and improvement), your
            consent (linking Patreon, optional communications), and compliance
            with legal obligations. You may withdraw consent at any time by
            disconnecting Patreon or contacting us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            5. Sharing and service providers
          </h2>
          <p>
            We do not sell your personal information. We share data with
            providers that help us run the service:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Supabase, for authentication and our Postgres database.</li>
            <li>MongoDB Atlas, for card and metagame data.</li>
            <li>Cloudflare, for hosting, security, and request logs.</li>
            <li>Patreon, if you link your account or support the project.</li>
            <li>Scryfall, for card data and images.</li>
            <li>
              TCGplayer, ManaPool, and other linked card sellers when you click
              a purchase link. Their privacy policies apply to those visits.
            </li>
          </ul>
          <p>
            We may also disclose information if required by law or to protect
            our rights, users, or the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            6. Cookies and similar technologies
          </h2>
          <p>
            Authentication cookies keep you signed in. The Patreon OAuth state
            cookie protects the linking flow and expires after a short time. The
            theme preference is stored in your browser’s local storage. We do
            not use advertising cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            7. Retention
          </h2>
          <p>
            We keep account and content data while your account is active. You
            can delete decks, comments, and your Patreon link from the app.
            Account deletion requests can be sent to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            . We may retain limited records where required by law or for
            security and backup purposes, and server logs for a short period.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            8. Your rights
          </h2>
          <p>
            Depending on where you live, you may have the right to access,
            correct, delete, export, or restrict processing of your personal
            data, object to processing, and lodge a complaint with your local
            data protection authority. To exercise these rights, contact{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            9. International transfers
          </h2>
          <p>
            Our providers may process data in countries other than yours. Where
            required, we rely on appropriate safeguards such as standard
            contractual clauses provided by those providers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            10. Children
          </h2>
          <p>
            The service is not directed to children under 13, or under the age
            required by your local law. We do not knowingly collect personal
            information from children. Contact us if you believe a child has
            provided information and we will remove it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            11. Security
          </h2>
          <p>
            We use industry-standard safeguards, including encryption in
            transit, access controls, and row-level security. No service can
            guarantee absolute security. Please use a strong, unique password
            and keep your account credentials private.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            12. Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. We will post the new
            version on this page and update the date above. Material changes
            will be communicated where appropriate.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-foreground">
            13. Third-party links and fan content
          </h2>
          <p>
            The service links to third-party sites, including card sellers and
            Patreon. Their privacy practices are governed by their own policies.{" "}
            {SITE_NAME} is unofficial Fan Content permitted under the Wizards of
            the Coast Fan Content Policy. Magic: The Gathering is a trademark
            of Wizards of the Coast LLC. Card data from Scryfall.
          </p>
        </section>

        <p>
          See also our{" "}
          <Link href="/terms" className="text-primary underline underline-offset-4">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
