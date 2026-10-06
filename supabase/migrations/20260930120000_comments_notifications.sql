-- Deck comments (threaded) and notifications.

-- ---------------------------------------------------------------------------
-- deck_comments
-- ---------------------------------------------------------------------------
create table if not exists public.deck_comments (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.deck_comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deck_comments_deck_idx on public.deck_comments (deck_id);
create index if not exists deck_comments_parent_idx on public.deck_comments (parent_id);
create index if not exists deck_comments_user_idx on public.deck_comments (user_id);

create trigger deck_comments_set_updated_at
  before update on public.deck_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('deck_comment', 'comment_reply')),
  deck_id uuid references public.decks (id) on delete cascade,
  comment_id uuid references public.deck_comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read_at);
create index if not exists notifications_created_idx
  on public.notifications (created_at desc);

-- Fan out notifications when a comment is posted.
-- `security definer` is deliberate: `notifications` has no INSERT policy, so
-- the trigger is the only writer of notification rows and must bypass RLS.
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deck_owner uuid;
  parent_author uuid;
begin
  if new.parent_id is null then
    select user_id into deck_owner from public.decks where id = new.deck_id;
    if deck_owner is not null and deck_owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, deck_id, comment_id)
      values (deck_owner, new.user_id, 'deck_comment', new.deck_id, new.id);
    end if;
  else
    select user_id into parent_author
      from public.deck_comments
      where id = new.parent_id;
    if parent_author is not null and parent_author <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, deck_id, comment_id)
      values (parent_author, new.user_id, 'comment_reply', new.deck_id, new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_deck_comment_created on public.deck_comments;
create trigger on_deck_comment_created
  after insert on public.deck_comments
  for each row execute function public.notify_on_comment();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.deck_comments enable row level security;
alter table public.notifications enable row level security;

-- Comments are readable wherever the parent deck is readable.
drop policy if exists deck_comments_select on public.deck_comments;
create policy deck_comments_select on public.deck_comments
  for select using (
    exists (
      select 1 from public.decks d
      where d.id = deck_comments.deck_id
        and (d.user_id = auth.uid() or d.visibility in ('public', 'unlisted'))
    )
  );

-- Authors may edit their own comments.
drop policy if exists deck_comments_update on public.deck_comments;
create policy deck_comments_update on public.deck_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Authors may delete their own comments; deck owners may moderate.
drop policy if exists deck_comments_delete on public.deck_comments;
create policy deck_comments_delete on public.deck_comments
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.decks d
      where d.id = deck_comments.deck_id and d.user_id = auth.uid()
    )
  );

-- Notifications belong to the recipient only.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());
