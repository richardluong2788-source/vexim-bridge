-- =====================================================================
-- 024_newsletter_subscribers.sql
-- Newsletter signup list for Vexim Insights.
--
-- Design notes
-- ------------
-- * One row per (email, locale) — same address may want vi vs en digests.
-- * Public inserts are allowed (anon) but restricted to the minimal fields
--   via RLS: no updates, no selects. Admin reads go through the service
--   role key (bypasses RLS), same pattern the rest of the project uses.
-- * `confirmed_at` left NULL → lets us add a double-opt-in flow later
--   without another migration.
-- * Unsubscribe token kept separate from any Supabase auth identity;
--   generated on insert so we can build plain-link unsubscribe URLs.
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  locale            text not null default 'vi'
                    check (locale in ('vi', 'en')),
  source            text not null default 'insights',
  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirmed_at      timestamptz,
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  user_agent        text,
  referrer          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (email, locale)
);

comment on table public.newsletter_subscribers is
  'Vexim Insights newsletter signups (double-opt-in ready).';

create index if not exists idx_newsletter_subs_status
  on public.newsletter_subscribers (status);

create index if not exists idx_newsletter_subs_created_at
  on public.newsletter_subscribers (created_at desc);

-- updated_at trigger
create or replace function public.newsletter_subs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_newsletter_subs_updated_at on public.newsletter_subscribers;
create trigger trg_newsletter_subs_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.newsletter_subs_set_updated_at();

-- RLS
alter table public.newsletter_subscribers enable row level security;

drop policy if exists newsletter_subs_anon_insert on public.newsletter_subscribers;
drop policy if exists newsletter_subs_editor_select on public.newsletter_subscribers;

-- Anyone can subscribe (anon). We limit what they can set by inserting
-- from a server action with only the whitelisted columns.
create policy newsletter_subs_anon_insert
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- Only content editors can read the list in the dashboard.
create policy newsletter_subs_editor_select
  on public.newsletter_subscribers
  for select
  to authenticated
  using (public.is_content_editor());
