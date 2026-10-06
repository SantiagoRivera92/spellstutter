# Spellstutter

A Pauper-focused Magic: The Gathering deck builder and metagame tracker.

- **Card catalog** — every card ever printed and every printing, stored in
  MongoDB and synced from the Scryfall bulk API by a GitHub Action. Deckbuilding
  is Pauper-only, but the catalog and card pages cover all of Magic.
- **Deckbuilding** — full Scryfall syntax search (against Scryfall itself), drag
  cards in, pick any printing, and start from scratch or seed an archetype's core.
- **Decks and folders** — user accounts, a nested folder tree, and cover art,
  stored in Postgres via Supabase with row-level security.
- **Metagame** — MTGO Pauper leagues and challenges scraped by a second GitHub
  Action, split into color-aware archetypes with average deck composition and
  per-card usage.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, React 19, Turbopack) |
| Styling | Tailwind CSS v4 with a semantic token layer |
| Cards + metagame | MongoDB (Atlas in production, Docker locally) |
| Users, decks, folders | Supabase Postgres + Auth + RLS |
| Data sync | GitHub Actions (`tsx` scripts) |
| Icons / drag-drop | lucide-react, native HTML5 drag-and-drop |

## Architecture

```
Scryfall bulk API ──sync:cards──▶ Mongo: cards, printings
mtgo.com decklists ─sync:metagame─▶ Mongo: metagame_events, metagame_decks
                                          │
                    Next.js (App Router) ──┼─▶ /api/cards/*        (search, detail)
                                          └─▶ server components   (metagame, decks)

Supabase Postgres ── profiles, folders, decks, deck_cards (RLS)
```

Reads of the card catalog and metagame go through server-only Mongo helpers
(`src/lib/cards/queries.ts`, `src/lib/metagame/queries.ts`). Deck writes go
through server actions (`src/lib/decks/actions.ts`) that always re-check Pauper
legality against Mongo before inserting a card.

## Local setup

Requirements: Node 22+, pnpm 11+, Docker (for MongoDB).

```bash
pnpm install
cp .env.example .env.local
```

### 1. MongoDB

```bash
docker compose up -d mongo
# or, without the compose plugin:
# docker run -d --name spellstutter-mongo -p 27017:27017 mongo:8
```

### 2. Load the card catalog

The sync streams the gzipped Scryfall JSONL bulk file and upserts one canonical
document per oracle id (all cards) plus one document per printing. Each card
keeps its full format legality map and a `metagame_printing_id` pointing at its
earliest common printing (the default for MTGO decklists). About 118k printings
and 38k cards — roughly 200 MB in Mongo.

```bash
pnpm sync:cards                 # incremental; skips if Scryfall data is unchanged
pnpm sync:cards -- --force      # re-download and re-upsert
pnpm sync:cards -- --pauper-only
pnpm sync:cards -- --limit=2000 # quick local seed
pnpm sync:cards -- --dry-run
```

Indexes are created automatically on the first run.

### 3. Load the metagame

```bash
pnpm sync:metagame                    # current UTC month
pnpm sync:metagame -- --year=2026 --month=09
pnpm sync:metagame -- --limit=5 --dry-run
```

The script reads the `window.MTGO.decklists.data` payload embedded in each
decklist page (no fragile DOM scraping), normalizes league and challenge shapes,
and classifies each list with `src/lib/metagame/archetypes.ts`.

`mtgo.com` frequently serves an empty, JS-only shell for decklist pages, so a
scrape can miss events. Because classification is a pure function of the stored
mainboard, you can re-apply rule changes to everything already stored without
re-fetching:

```bash
pnpm sync:reclassify            # recompute archetype + colour for all decks
pnpm sync:reclassify -- --dry-run
```

### 4. Supabase (accounts, decks, folders)

1. Create a Supabase project.
2. Apply the schema — either `supabase db push` (Supabase CLI) or paste each
   file in `supabase/migrations/` into the SQL editor in order:
   - `20260928120000_init.sql` — `profiles`, `folders`, `decks`, `deck_cards`,
     their RLS policies, the folder cycle guard, and the signup trigger that
     provisions a profile.
   - `20260929120000_deck_archetype.sql` — `decks.archetype_slug` for
     archetype-seeded decks.
   - `20260930120000_comments_notifications.sql` — `deck_comments` and
     `notifications` tables, RLS, and the comment notification trigger.
   - `20260930130000_comment_insert_policy.sql` — the insert policy that lets
     signed-in users comment on decks they can read.
3. Put the project URL, anon key, and service-role key in `.env.local`.
4. In Authentication → URL configuration, add `http://localhost:3000/auth/callback`
   (and your production callback) as a redirect URL.

### 5. Run

```bash
pnpm dev
```

## Environment variables

| Name | Used by | Notes |
| --- | --- | --- |
| `MONGODB_URI` | app + both syncs | Atlas connection string or local Mongo |
| `MONGODB_DB` | app + both syncs | defaults to `spellstutter` |
| `NEXT_PUBLIC_SUPABASE_URL` | app | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | browser-safe key |
| `NEXT_PUBLIC_SITE_URL` | app | canonical origin for auth redirects (optional locally) |
| `SCRYFALL_USER_AGENT` | syncs | Scryfall asks for a descriptive UA + contact |

## GitHub Actions

Two workflows run on a daily schedule and on manual dispatch:

- `.github/workflows/sync-cards.yml` → `pnpm sync:cards`
- `.github/workflows/sync-metagame.yml` → `pnpm sync:metagame`

Configure in the repository:

- **Secret** `MONGODB_URI`
- **Variables** `MONGODB_DB`, `SCRYFALL_USER_AGENT`

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next dev server |
| `pnpm build` / `pnpm start` | production build / serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | unit tests for the archetype rules + search-syntax parser |
| `pnpm sync:cards` | Scryfall → Mongo |
| `pnpm sync:metagame` | MTGO → Mongo |
| `pnpm sync:reclassify` | Re-apply archetype rules to stored decks (no network) |

## Project structure

```
src/
  app/
    (auth)/            login, signup, forgot/reset password (server actions)
    api/cards/         Mongo card detail route handlers
    api/scryfall/      Scryfall search proxy
    cards/             card search
    cards/[oracleId]/  card page (printings, legality, archetype usage)
    decks/             library, deck view, deck editor, public decks
    events/            MTGO event list + detail
    metagame/          metagame overview + archetypes
    notifications/     comment + reply notifications
    staples/           staple leaderboards (+ per-category sub-pages)
    settings/profile/  profile + avatar
    users/[username]/  public profile
    error.tsx / loading.tsx / sitemap.ts / robots.ts
  components/          ui primitives, cards, decks, metagame, layout
  lib/
    cards/             types, mana helpers, search-syntax parser, Mongo queries
    scryfall/          API client + normalization (shared with the sync script)
    decks/             queries, actions, stats, export
    metagame/          types, archetype rules (+ tests), Mongo queries
    auth/              session, safe redirects, rate limiting
    http/              route-handler rate limiting
    supabase/          server client + proxy session helper
scripts/               sync-scryfall.ts, scrape-metagame.ts
supabase/migrations/   Postgres schema + RLS
```

## Card search

Search hits the Scryfall API through `/api/scryfall/search`
(`src/lib/scryfall/client.ts`), so the full Scryfall syntax works and every card
is searchable, Pauper-legal or not. Results carry Scryfall's Pauper legality;
the add-to-deck action independently re-checks legality against the catalog
before writing.

## Card pages

`/cards/[oracleId]` shows the card, a gallery of every printing, the full format
legality table, and — for Pauper-legal cards — the archetypes that play it with
inclusion rate and average copies.

## Metagame classification

Decks are grouped by matching mainboard card names against a rule table in
`src/lib/metagame/archetypes.ts`. Rules can also constrain **colour identity**
(`requiresColors`, `excludesColors`, `maxColors`), which is how families split
into real decks: Affinity into Esper / Grixis / Jeskai / Four-Color, Terror into
Mono-Blue / Izzet / Dimir, Madness into Monored / Izzet / Rakdos, Faeries into
Dimir / Mono-Blue. A mandatory `requires` card separates lookalikes: any
artifact shell running Cleansing Wildfire is a Wildfire deck, not Affinity.

Dimir Faeries and Dimir Control share almost their whole removal and
counterspell shell, so matching on that shell alone lumps them together. The
Faeries rule therefore requires one of its tempo creatures (Spellstutter Sprite,
Faerie Seer, Ninja of the Deep Hours, Moon-Circuit Hacker), and Dimir Control
matches on cards the control build plays but the tempo deck does not (Murmuring
Mystic, Campfire, Cut Down, Preordain, Plunder the Trollshaws, Lose Focus).

Two more rules of thumb encoded in the table:

- Classification uses the **mainboard** colours only, since sideboards often
  splash hate cards.
- `IDENTITY_EXEMPT_CARDS` lists cards that should not count toward a deck's
  colour identity because they are effectively free or never cast — Sneaky
  Snacker (discard payoff in Mono-Red Madness), Mutagenic Growth (Phyrexian
  green in Mono-Blue Faeries), and Faerie Macabre (sideboard graveyard hate).
  Without this, those decks misread as multicolour.

After changing rules, run `pnpm sync:reclassify` — no re-scrape needed.

Lists matching no rule fall into `Other`. Bump `CLASSIFICATION_VERSION` when
rules change.

The archetype page (`/metagame/archetypes/[slug]`) reports meta share plus an
average composition — per-card average copies and the share of lists running it,
with "Core" marking cards present in every list. Seeding a new deck from an
archetype uses the same data: it adds each 100%-inclusion card at the lowest copy
count any single list used (so one list with 3 Brainstorm seeds 3, not 4).

## Design notes

- Dark-first UI built from the brand palette, with a full light theme and a
  persisted toggle. Colors are consumed through semantic tokens, never raw ramps.
- Two typefaces: Bricolage Grotesque (display) and Instrument Sans (body/UI).
- Motion is capped (120 ms hovers, 240 ms entrances) and fully disabled under
  `prefers-reduced-motion`.
- Semantic HTML (`table` decklists, `dialog`, `details`, `nav`, labels wired to
  controls) and visible focus states throughout.

## Known limitations

- The metagame classifier is heuristic (v4); uncommon colour combinations still
  land in `Other` and the rule table should be tuned over time.
- Deck colour identity in the metagame view is derived from MTGO card colour
  data, which approximates identity (coloured lands and colourless pips are not
  resolved). Classification uses mainboard colours only.
- `mtgo.com` serves an empty shell to plain bot User-Agents, so the scraper
  presents a browser User-Agent and rate-limits its requests.
- MTGO sometimes names a card differently from Scryfall — the digital set
  "Through the Omenpaths" (`om1`) uses reskinned names, for example. Those
  mappings live in `src/lib/metagame/card-aliases.ts` and must be extended by
  hand when new mismatches appear.
- Local development needs a running MongoDB; without `MONGODB_URI` the card and
  metagame pages show a setup notice rather than failing.
- Avatar art and cover art are stored as Scryfall CDN URLs; there is no local
  image mirror.

Spellstutter is unofficial Fan Content permitted under the Wizards of the Coast
Fan Content Policy. Magic: The Gathering is a trademark of Wizards of the Coast
LLC. Card data from Scryfall.
