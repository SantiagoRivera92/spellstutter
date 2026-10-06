-- Track which metagame archetype a deck was seeded from (null for brews).
-- Idempotent: safe on databases created before the column existed.

alter table public.decks
  add column if not exists archetype_slug text;

create index if not exists decks_archetype_slug_idx
  on public.decks (archetype_slug);
