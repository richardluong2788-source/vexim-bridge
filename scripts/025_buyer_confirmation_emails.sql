-- ============================================================
-- 025 — Buyer confirmation emails (Phase 1)
-- ============================================================
-- Goal: when a lead is created, the buyer receives an acknowledgement
-- email from Vexim Bridge. This migration adds the building blocks:
--
--   1. Per-lead unsubscribe token + opt-out flag on public.leads
--   2. Trigger to auto-generate the token on insert
--   3. buyer_email_log table to record every buyer-facing email
--   4. RLS that mirrors the rest of the admin-only ops surface
--
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ---- 1. Extend leads ------------------------------------------------
alter table public.leads
  add column if not exists unsubscribe_token text,
  add column if not exists email_unsubscribed boolean not null default false,
  add column if not exists email_unsubscribed_at timestamptz;

-- Uniqueness on the token (nullable columns with a unique index still
-- allow multiple NULLs, which is what we want for backfill).
create unique index if not exists leads_unsubscribe_token_key
  on public.leads (unsubscribe_token)
  where unsubscribe_token is not null;

-- Backfill existing rows so the unsubscribe link works for them too.
update public.leads
set unsubscribe_token = encode(gen_random_bytes(24), 'hex')
where unsubscribe_token is null;

-- ---- 2. Auto-token trigger -----------------------------------------
create or replace function public.leads_generate_unsubscribe_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unsubscribe_token is null then
    new.unsubscribe_token := encode(gen_random_bytes(24), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_generate_unsubscribe_token on public.leads;
create trigger trg_leads_generate_unsubscribe_token
  before insert on public.leads
  for each row execute function public.leads_generate_unsubscribe_token();

-- ---- 3. Buyer email log --------------------------------------------
create table if not exists public.buyer_email_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  email_type text not null,              -- 'inquiry_received' | 'sample_sent' | 'quote_ready' | ...
  recipient_email text not null,
  subject text,
  status text not null default 'sent',   -- 'sent' | 'failed' | 'skipped_unsubscribed' | 'skipped_duplicate' | 'skipped_no_email'
  provider_message_id text,
  error_message text,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id) on delete set null
);

create index if not exists buyer_email_log_lead_id_idx
  on public.buyer_email_log (lead_id);

create index if not exists buyer_email_log_lead_type_sent_idx
  on public.buyer_email_log (lead_id, email_type, sent_at desc);

create index if not exists buyer_email_log_sent_at_idx
  on public.buyer_email_log (sent_at desc);

-- ---- 4. RLS ---------------------------------------------------------
alter table public.buyer_email_log enable row level security;

drop policy if exists "buyer_email_log_admin_select" on public.buyer_email_log;
create policy "buyer_email_log_admin_select"
  on public.buyer_email_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('super_admin', 'admin', 'staff', 'account_executive', 'lead_researcher')
    )
  );

drop policy if exists "buyer_email_log_admin_insert" on public.buyer_email_log;
create policy "buyer_email_log_admin_insert"
  on public.buyer_email_log
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('super_admin', 'admin', 'staff', 'account_executive')
    )
  );

-- Service role (admin client) is unaffected by these policies and can write freely,
-- which is what the cron / server actions use.
