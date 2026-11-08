-- Optional Patreon supporter linking for cosmetic supporter status.
-- Patreon is a donation channel; this table does not gate any feature.

create table if not exists public.patreon_supporters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  patreon_user_id text,
  campaign_id text,
  tier_id text,
  tier_title text,
  patron_status text not null default 'unknown',
  amount_cents integer not null default 0,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger patreon_supporters_set_updated_at
  before update on public.patreon_supporters
  for each row execute function public.set_updated_at();

alter table public.patreon_supporters enable row level security;

drop policy if exists patreon_supporters_select on public.patreon_supporters;
create policy patreon_supporters_select on public.patreon_supporters
  for select using (user_id = auth.uid());

drop policy if exists patreon_supporters_insert on public.patreon_supporters;
create policy patreon_supporters_insert on public.patreon_supporters
  for insert with check (user_id = auth.uid());

drop policy if exists patreon_supporters_update on public.patreon_supporters;
create policy patreon_supporters_update on public.patreon_supporters
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists patreon_supporters_delete on public.patreon_supporters;
create policy patreon_supporters_delete on public.patreon_supporters
  for delete using (user_id = auth.uid());
