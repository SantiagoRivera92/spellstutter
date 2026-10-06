-- Spellstutter — accounts, folders, decks, deck cards, comments, notifications.
-- Targets Supabase (Postgres 15+). Apply in filename order.

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  display_name text,
  bio text,
  avatar_card_oracle_id text,
  avatar_card_name text,
  avatar_art_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- folders
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_user_idx on public.folders (user_id);
create index if not exists folders_parent_idx on public.folders (parent_id);

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

-- Guard against a folder being its own ancestor.
create or replace function public.check_folder_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid;
  depth integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A folder cannot be its own parent.';
  end if;
  cursor_id := new.parent_id;
  while cursor_id is not null and depth < 100 loop
    if cursor_id = new.id then
      raise exception 'Folder cycle detected.';
    end if;
    select parent_id into cursor_id from public.folders where id = cursor_id;
    depth := depth + 1;
  end loop;
  return new;
end;
$$;

create trigger folders_no_cycle
  before insert or update of parent_id on public.folders
  for each row execute function public.check_folder_cycle();

-- ---------------------------------------------------------------------------
-- decks
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  description text,
  format text not null default 'pauper' check (format in ('pauper')),
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  archetype_slug text,
  cover_oracle_id text,
  cover_printing_id text,
  cover_art_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_user_idx on public.decks (user_id);
create index if not exists decks_folder_idx on public.decks (folder_id);
create index if not exists decks_visibility_idx on public.decks (visibility);

create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- deck_cards
-- ---------------------------------------------------------------------------
create table if not exists public.deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  oracle_id text not null,
  printing_id text,
  card_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  board text not null default 'main'
    check (board in ('main', 'side', 'commander', 'maybe')),
  category text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deck_cards_deck_idx on public.deck_cards (deck_id);
create index if not exists deck_cards_oracle_idx on public.deck_cards (oracle_id);

create trigger deck_cards_set_updated_at
  before update on public.deck_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provision a profile on signup (username passed in user metadata).
-- `security definer` is deliberate: the trigger runs as the table owner so it
-- can insert without an authenticated `auth.uid()` (which is still null while
-- the auth.users row is being created).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix integer := 0;
begin
  base := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, 'user'), '@', 1),
    'user'
  );
  base := regexp_replace(base, '[^a-zA-Z0-9_-]', '', 'g');
  if length(base) < 3 then
    base := 'user' || substr(new.id::text, 1, 8);
  end if;
  base := left(base, 24);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(base, 20) || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), candidate)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;

-- profiles are readable by everyone; only the owner may write.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- folders: owner only.
drop policy if exists folders_select on public.folders;
create policy folders_select on public.folders
  for select using (user_id = auth.uid());

drop policy if exists folders_insert on public.folders;
create policy folders_insert on public.folders
  for insert with check (user_id = auth.uid());

drop policy if exists folders_update on public.folders;
create policy folders_update on public.folders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists folders_delete on public.folders;
create policy folders_delete on public.folders
  for delete using (user_id = auth.uid());

-- decks: readable when owned or shared; writable by owner only.
drop policy if exists decks_select on public.decks;
create policy decks_select on public.decks
  for select using (
    user_id = auth.uid() or visibility in ('public', 'unlisted')
  );

drop policy if exists decks_insert on public.decks;
create policy decks_insert on public.decks
  for insert with check (user_id = auth.uid());

drop policy if exists decks_update on public.decks;
create policy decks_update on public.decks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists decks_delete on public.decks;
create policy decks_delete on public.decks
  for delete using (user_id = auth.uid());

-- deck_cards follow their parent deck's visibility.
drop policy if exists deck_cards_select on public.deck_cards;
create policy deck_cards_select on public.deck_cards
  for select using (
    exists (
      select 1 from public.decks d
      where d.id = deck_cards.deck_id
        and (d.user_id = auth.uid() or d.visibility in ('public', 'unlisted'))
    )
  );

drop policy if exists deck_cards_insert on public.deck_cards;
create policy deck_cards_insert on public.deck_cards
  for insert with check (
    exists (
      select 1 from public.decks d
      where d.id = deck_cards.deck_id and d.user_id = auth.uid()
    )
  );

drop policy if exists deck_cards_update on public.deck_cards;
create policy deck_cards_update on public.deck_cards
  for update using (
    exists (
      select 1 from public.decks d
      where d.id = deck_cards.deck_id and d.user_id = auth.uid()
    )
  );

drop policy if exists deck_cards_delete on public.deck_cards;
create policy deck_cards_delete on public.deck_cards
  for delete using (
    exists (
      select 1 from public.decks d
      where d.id = deck_cards.deck_id and d.user_id = auth.uid()
    )
  );
