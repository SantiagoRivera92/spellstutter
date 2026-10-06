import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// The header renders the signed-in user via cookies, so every route is
// request-time rather than statically prerendered.
export const dynamic = "force-dynamic";

const siteDescription =
  "Build Pauper decks with a drag-and-drop editor, organize them in folders, and track the metagame.";

// Use the configured origin when present; otherwise omit metadataBase so Next
// infers it from the request instead of hard-coding localhost in production.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "Spellstutter — Pauper deckbuilding and metagame",
    template: "%s · Spellstutter",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: "Spellstutter",
    title: "Spellstutter — Pauper deckbuilding and metagame",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Spellstutter — Pauper deckbuilding and metagame",
    description: siteDescription,
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem("spellstutter-theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} h-full`}
    >
      <head>
        <Script
          id="theme-init"
          nonce={nonce}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
        <SiteFooter />
        <MobileTabBar />
      </body>
    </html>
  );
}
