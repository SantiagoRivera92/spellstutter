# Spellstutter

**English** | [Español](README-ES.md)

**A Pauper-focused deck builder and metagame tracker for Magic: The Gathering.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

Spellstutter combines a full card catalog, a drag-and-drop deck editor, and
daily-refreshed Pauper metagame data in one app. Build and organize decks,
inspect every printing of every card, and see which archetypes and cards are
actually winning.

> Unofficial Fan Content permitted under the Wizards of the Coast Fan Content
> Policy. Magic: The Gathering is a trademark of Wizards of the Coast LLC. Card
> data from Scryfall.

## Features

- **Full card catalog** — every card and printing, synced from the Scryfall
  bulk API. Search with full Scryfall syntax and browse legality for every
  format, while deckbuilding stays Pauper-only.
- **Deck editor** — drag cards in, choose any printing, import text decklists,
  export as plain text or an MTGO `.dek` file, and seed a deck from an
  archetype's core.
- **Library and folders** — a nested folder tree, cover art, public decks, and
  per-deck comments.
- **Metagame tracker** — daily MTGO league and challenge results split into
  color-aware archetypes, with meta share, average composition, matchup
  records, and staple leaderboards.
- **Second archetype source** — endstep.cc sample lists and per-card inclusion
  stats for deckbuilding.
- **Accounts and notifications** — Supabase Auth, profiles, comment/reply
  notifications, and row-level security.

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 App Router, React 19, Turbopack |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 with semantic design tokens |
| Card catalog + metagame | MongoDB (Atlas in production, Docker locally) |
| Accounts, decks, folders | Supabase Postgres + Auth + RLS |
| Data sync | Scheduled GitHub Actions running `tsx` scripts |
| Icons / drag-and-drop | lucide-react, native HTML5 drag-and-drop |

## Architecture

```
Scryfall bulk API ───sync:cards────▶ MongoDB: cards, printings
mtgo.com decklists ──sync:metagame─▶ MongoDB: metagame_events, metagame_decks
endstep.cc API ──────sync:endstep──▶ MongoDB: endstep_archetypes, endstep_matchups
                                           │
                      Next.js (App Router) ─┼─▶ /api/cards/*, /api/scryfall/*
                                           └─▶ server components
Supabase Postgres ── profiles, folders, decks, deck_cards, comments, notifications (RLS)
```

Card and metagame reads go through server-only Mongo helpers
(`src/lib/cards/queries.ts`, `src/lib/metagame/queries.ts`). Deck writes go
through server actions (`src/lib/decks/actions.ts`) that re-check Pauper
legality against Mongo before inserting a card.

## Getting started

**Prerequisites:** Node 22+, pnpm 11+, and Docker (or another MongoDB instance).
Supabase is required for accounts, decks, and folders.

```bash
git clone <repository-url> spellstutter
cd spellstutter
pnpm install
cp .env.example .env.local
```

### 1. Start MongoDB

```bash
docker compose up -d mongo
# without the compose plugin:
# docker run -d --name spellstutter-mongo -p 27017:27017 mongo:8
```

### 2. Configure environment

Fill in `.env.local`. At minimum, set `MONGODB_URI`; add the Supabase values for
auth and deck storage.

### 3. Apply the Supabase schema

Create a Supabase project, then run the migrations in order with the Supabase
CLI or paste them into the SQL editor:

```bash
supabase db push
```

<details>
<summary>Migration files and auth setup</summary>

- `20260928120000_init.sql` — `profiles`, `folders`, `decks`, `deck_cards`,
  RLS policies, the folder cycle guard, and the signup trigger that provisions a
  profile.
- `20260929120000_deck_archetype.sql` — `decks.archetype_slug` for
  archetype-seeded decks.
- `20260930120000_comments_notifications.sql` — `deck_comments` and
  `notifications`, RLS, and the comment notification trigger.
- `20260930130000_comment_insert_policy.sql` — lets signed-in users comment on
  decks they can read.

In Supabase → Authentication → URL configuration, add
`http://localhost:3000/auth/callback` and your production callback URL.
</details>

### 4. Load data

```bash
# Card catalog (about 118k printings / 38k cards, ~200 MB in Mongo)
pnpm sync:cards -- --limit=2000   # quick local seed; drop --limit for everything

# Metagame (current UTC month)
pnpm sync:metagame

# endstep archetypes (optional, used for seeding)
pnpm sync:endstep
```

Sync indexes are created automatically on the first run.

### 5. Run

```bash
pnpm dev
```

Open <http://localhost:3000>. Without `MONGODB_URI` the card and metagame pages
show a setup notice instead of failing.

## Data pipeline

| Command | Source | Writes | Schedule |
| --- | --- | --- | --- |
| `pnpm sync:cards` | Scryfall bulk API | `cards`, `printings` | Daily, 04:17 UTC |
| `pnpm sync:metagame` | mtgo.com decklists | `metagame_events`, `metagame_decks` | Daily, 05:23 UTC |
| `pnpm sync:endstep` | endstep.cc metagame API | `endstep_archetypes`, `endstep_matchups` | Daily, 06:37 UTC |
| `pnpm sync:reclassify` | stored decks only | Recomputes archetype + color | Manual |

`sync:cards` streams the gzipped Scryfall JSONL bulk file and upserts one
canonical document per oracle id plus one per printing. `sync:metagame` reads the
`window.MTGO.decklists.data` payload embedded in each decklist page (no DOM
scraping) and classifies each list with `src/lib/metagame/archetypes.ts`.

## GitHub Actions

Three workflows run daily and can be triggered manually from the Actions tab:

| Workflow | Command | Schedule |
| --- | --- | --- |
| `.github/workflows/sync-cards.yml` | `pnpm sync:cards` | 04:17 UTC |
| `.github/workflows/sync-metagame.yml` | `pnpm sync:metagame` | 05:23 UTC |
| `.github/workflows/sync-endstep.yml` | `pnpm sync:endstep` | 06:37 UTC |

Configure these in the repository:

- **Secret:** `MONGODB_URI`
- **Variables:** `MONGODB_DB`, `SCRYFALL_USER_AGENT`

Manual runs of the metagame and endstep workflows accept optional inputs such as
year/month, format, window, and limits.

## Environment variables

| Name | Used by | Notes |
| --- | --- | --- |
| `MONGODB_URI` | App + all syncs | Atlas connection string or local Mongo |
| `MONGODB_DB` | App + all syncs | Defaults to `spellstutter` |
| `NEXT_PUBLIC_SUPABASE_URL` | App | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App | Browser-safe anon key |
| `NEXT_PUBLIC_SITE_URL` | App | Canonical origin for auth redirects; required in production |
| `SCRYFALL_USER_AGENT` | Card sync | Descriptive User-Agent with contact info |

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests (archetype rules, card types, search syntax, auth redirects, rate limiting, matchup stats) |
| `pnpm sync:cards` | Scryfall → Mongo |
| `pnpm sync:metagame` | MTGO → Mongo |
| `pnpm sync:reclassify` | Re-apply archetype rules to stored decks (no network) |
| `pnpm sync:endstep` | endstep.cc archetypes → Mongo (sample lists + card stats) |

## Project structure

```
src/
  app/
    (auth)/            login, signup, forgot/reset password
    api/cards/         Mongo card detail route handlers
    api/scryfall/      Scryfall search proxy
    cards/             card search and card detail pages
    decks/             library, editor, public decks
    events/            MTGO event list and detail
    metagame/          overview, archetypes, matchups
    notifications/     comment and reply notifications
    staples/           staple leaderboards by category
    settings/profile/  profile and avatar
    users/[username]/  public profiles
  components/          UI primitives and feature components
  lib/
    cards/             types, mana helpers, search parser, Mongo queries
    scryfall/          API client and normalization (shared with sync)
    decks/             queries, actions, stats, import/export
    metagame/          archetype rules, endstep helpers, queries
    auth/              session, safe redirects, rate limiting
    supabase/          server client and session proxy
scripts/               sync-scryfall, scrape-metagame, sync-endstep, reclassify
supabase/migrations/   Postgres schema and RLS
```

## How it works

### Card search and legality

Search hits Scryfall through `/api/scryfall/search`
(`src/lib/scryfall/client.ts`), so the full Scryfall syntax works and every card
is searchable, Pauper-legal or not. Results carry Scryfall's Pauper legality;
the add-to-deck action independently re-checks legality against the catalog
before writing.

Card pages (`/cards/[oracleId]`) show the card, every printing, the full format
legality table, and — for Pauper-legal cards — the archetypes that play it with
inclusion rate and average copies.

### Metagame classification

Decks are grouped by matching mainboard card names against a rule table in
`src/lib/metagame/archetypes.ts`. Rules can also constrain color identity
(`requiresColors`, `excludesColors`, `maxColors`) to split families into real
decks: Affinity into Esper / Grixis / Jeskai / Four-Color, Terror into Mono-Blue
/ Izzet / Dimir, Madness into Monored / Izzet / Rakdos, and Faeries into Dimir /
Mono-Blue.

<details>
<summary>Classification rules and tuning notes</summary>

- A mandatory `requires` card separates lookalikes: any artifact shell running
  Cleansing Wildfire is a Wildfire deck, not Affinity.
- Dimir Faeries and Dimir Control share most of their removal and counterspell
  shell, so the Faeries rule requires a tempo creature (Spellstutter Sprite,
  Faerie Seer, Ninja of the Deep Hours, Moon-Circuit Hacker). Dimir Control
  matches on cards the control build plays but the tempo deck does not.
- Classification uses mainboard colors only, since sideboards often splash hate
  cards.
- `IDENTITY_EXEMPT_CARDS` excludes cards that are effectively free or never
  cast — Sneaky Snacker, Mutagenic Growth, Faerie Macabre — so those decks are
  not misread as multicolor.
- Lists matching no rule fall into `Other`. After changing rules, bump
  `CLASSIFICATION_VERSION` and run `pnpm sync:reclassify` — no re-scrape needed.

Archetype pages report meta share plus average composition: per-card average
copies and the share of lists running it, with "Core" marking cards present in
every list. Seeding a deck adds each 100%-inclusion card at the lowest copy count
any single list used.
</details>

### endstep.cc archetypes

`pnpm sync:endstep` ingests the public endstep.cc metagame API
(`endstep.cc/api/metagame/v1`) into `endstep_archetypes`. It is a second,
independent source used for **deckbuilding**, not match results: each archetype
carries a canonical sample decklist (`sample_list.main` / `sample_list.side`),
per-card inclusion statistics (`cards_main` / `cards_side`), key cards, colors,
and aggregate share/players.

<details>
<summary>endstep notes</summary>

```bash
pnpm sync:endstep                  # Pauper, 30d window, rated population
pnpm sync:endstep -- --window=90d
pnpm sync:endstep -- --limit=20 --dry-run
pnpm sync:endstep -- --no-cards    # skip per-card statistics
```

endstep withholds sample lists and card tables below a minimum sample size, so
some documents have empty `sample_list` / `cards_*`. Sample card names are
resolved to oracle ids at sync time (including DFC front faces), so seeding needs
no runtime name lookup. Read helpers live in `src/lib/metagame/endstep.ts`.

The New Deck dialog's "Seed an archetype" picker lists both sources: MTGO
archetypes (slug as-is) and endstep archetypes (slug prefixed `endstep:`).
</details>

### Design notes

<details>
<summary>UI and accessibility choices</summary>

- Dark-first UI with a full light theme and a persisted toggle. Colors are
  consumed through semantic tokens, never raw ramps.
- Two typefaces: Bricolage Grotesque (display) and Instrument Sans (body/UI).
- Motion is capped (120 ms hovers, 240 ms entrances) and disabled under
  `prefers-reduced-motion`.
- Semantic HTML (`table` decklists, `dialog`, `details`, `nav`, labelled
  controls) and visible focus states throughout.
</details>

### Known limitations

<details>
<summary>Current caveats</summary>

- The metagame classifier is heuristic (v4); uncommon color combinations still
  land in `Other` and the rule table needs tuning over time.
- Metagame color identity comes from MTGO card color data, which approximates
  identity (colored lands and colorless pips are not resolved).
- `mtgo.com` serves an empty shell to plain bot User-Agents, so the scraper uses
  a browser User-Agent and rate-limits requests.
- MTGO sometimes names cards differently from Scryfall (e.g. the digital set
  "Through the Omenpaths", `om1`). Mappings live in
  `src/lib/metagame/card-aliases.ts` and must be extended by hand.
- Avatar and cover art use Scryfall CDN URLs; there is no local image mirror.
</details>

## Deployment

Spellstutter is a standard Next.js app and can be deployed to any Node host that
supports Next.js 16 (for example Vercel or a container platform).

1. Set the environment variables above in the host.
2. Set `NEXT_PUBLIC_SITE_URL` to the production origin — required in production.
3. Add the production `/auth/callback` URL to Supabase redirect URLs.
4. Point the app at a production MongoDB (Atlas) and Supabase project.
5. Let the scheduled workflows keep the catalog and metagame fresh, or run the
   sync commands from your own scheduler.

## Contributing

Issues and pull requests are welcome.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Before opening a PR:

- Run lint, typecheck, and tests.
- If you change archetype rules, bump `CLASSIFICATION_VERSION` and run
  `pnpm sync:reclassify` (or explain why a reclassification is not needed).
- Keep card legality checks server-side; never trust client-provided legality.

## Data sources and attribution

- Card data from [Scryfall](https://scryfall.com).
- MTGO Pauper league and challenge results from [mtgo.com](https://www.mtgo.com).
- Archetype sample lists and statistics from [endstep.cc](https://endstep.cc).

Spellstutter is unofficial Fan Content permitted under the Wizards of the Coast
Fan Content Policy. Magic: The Gathering is a trademark of Wizards of the Coast
LLC.

## License

No license file is currently included in this repository.
