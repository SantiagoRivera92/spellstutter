-- Remove the abandoned subscription billing schema.
-- Patreon support uses public.patreon_supporters instead.

drop table if exists public.billing_events;
drop table if exists public.subscriptions;
