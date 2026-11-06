-- Per-user favourite printing for each card.

create table if not exists public.favorite_printings (
  user_id uuid not null references auth.users (id) on delete cascade,
  oracle_id text not null,
  printing_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, oracle_id)
);

create index if not exists favorite_printings_user_idx
  on public.favorite_printings (user_id);

create trigger favorite_printings_set_updated_at
  before update on public.favorite_printings
  for each row execute function public.set_updated_at();

alter table public.favorite_printings enable row level security;

drop policy if exists favorite_printings_select on public.favorite_printings;
create policy favorite_printings_select on public.favorite_printings
  for select using (user_id = auth.uid());

drop policy if exists favorite_printings_insert on public.favorite_printings;
create policy favorite_printings_insert on public.favorite_printings
  for insert with check (user_id = auth.uid());

drop policy if exists favorite_printings_update on public.favorite_printings;
create policy favorite_printings_update on public.favorite_printings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists favorite_printings_delete on public.favorite_printings;
create policy favorite_printings_delete on public.favorite_printings
  for delete using (user_id = auth.uid());
