-- Signed-in users may comment on any deck they can read (their own, or a
-- public/unlisted deck). The notification fan-out is handled by the
-- `on_deck_comment_created` trigger.

drop policy if exists deck_comments_insert on public.deck_comments;
create policy deck_comments_insert on public.deck_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.decks d
      where d.id = deck_comments.deck_id
        and (d.user_id = auth.uid() or d.visibility in ('public', 'unlisted'))
    )
  );
