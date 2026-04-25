-- Migration 029 — Analytics & Reporting foundation
--
-- Purpose
-- -------
-- Until now Vexim Bridge could only show "snapshots" — current stage counts,
-- total deals — but not history. We could not answer:
--   * How many deals did each client close last quarter?
--   * Which stage is each client's pipeline currently stuck in?
--   * What is the median time a deal spends in 'negotiation'?
--   * Which client has the worst win-rate trend over the last 6 months?
--
-- This migration adds:
--   1) `stage_transitions` — append-only ledger of every stage change,
--      auto-populated by trigger and back-filled from `activities`.
--   2) Indexes for fast aggregation by client / period / stage.
--   3) View `opportunity_metrics_v` — joins each opportunity with its
--      time-in-current-stage and total lifetime, used by the Bottleneck tab.
--   4) View `client_pipeline_metrics_v` — per-client win/lost/in-progress
--      counts ready for the Analytics dashboard.
--   5) `profiles.account_manager_id` — staff member responsible for a
--      client, used by the Analytics RLS scope (AE/Researcher see only
--      their own clients; Admin/Super-Admin see all).
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. account_manager_id — used to scope analytics for AE / Lead Researcher
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_manager_id uuid
  references public.profiles(id) on delete set null;

create index if not exists profiles_account_manager_idx
  on public.profiles (account_manager_id);

comment on column public.profiles.account_manager_id is
  'Staff (admin/AE/researcher) responsible for this client. Powers the '
  '"AE/Researcher only see their own clients" rule on /admin/analytics.';

-- ---------------------------------------------------------------------------
-- 2. stage_transitions — append-only history of every stage change
-- ---------------------------------------------------------------------------
create table if not exists public.stage_transitions (
  id                              uuid primary key default gen_random_uuid(),
  opportunity_id                  uuid not null
    references public.opportunities(id) on delete cascade,
  from_stage                      text,            -- null = initial creation
  to_stage                        text not null,
  transitioned_by                 uuid
    references public.profiles(id) on delete set null,
  transitioned_at                 timestamptz not null default now(),
  -- How long the deal sat in `from_stage` before this transition.
  -- Null for the initial creation row. Populated by trigger going forward
  -- and back-filled below using window functions.
  time_in_previous_stage_seconds  bigint
);

create index if not exists stage_transitions_opp_time_idx
  on public.stage_transitions (opportunity_id, transitioned_at desc);

create index if not exists stage_transitions_to_stage_time_idx
  on public.stage_transitions (to_stage, transitioned_at desc);

create index if not exists stage_transitions_from_stage_time_idx
  on public.stage_transitions (from_stage, transitioned_at desc);

-- ---------------------------------------------------------------------------
-- 3. Triggers — auto-log every stage change going forward
-- ---------------------------------------------------------------------------
-- 3a. INSERT — record the initial stage as `null -> <stage>` so every
-- opportunity has at least one transition row, simplifying queries.
create or replace function public.log_initial_stage_transition()
returns trigger language plpgsql as $$
begin
  insert into public.stage_transitions
    (opportunity_id, from_stage, to_stage, transitioned_by, transitioned_at)
  values
    (new.id, null, new.stage, null, new.created_at);
  return new;
end;
$$;

drop trigger if exists trg_log_initial_stage_transition on public.opportunities;
create trigger trg_log_initial_stage_transition
  after insert on public.opportunities
  for each row execute function public.log_initial_stage_transition();

-- 3b. UPDATE — record any stage change. Time-in-previous-stage is the
-- delta between now() and the previous transition (or opportunity.created_at
-- if this is the very first change).
create or replace function public.log_stage_transition()
returns trigger language plpgsql as $$
declare
  prev_at  timestamptz;
  prev_secs bigint;
begin
  if new.stage is distinct from old.stage then
    select transitioned_at into prev_at
      from public.stage_transitions
      where opportunity_id = new.id
      order by transitioned_at desc
      limit 1;

    if prev_at is null then
      prev_at := old.created_at;
    end if;

    prev_secs := greatest(0, extract(epoch from (now() - prev_at)))::bigint;

    insert into public.stage_transitions
      (opportunity_id, from_stage, to_stage, transitioned_by,
       transitioned_at, time_in_previous_stage_seconds)
    values
      (new.id, old.stage, new.stage, null, now(), prev_secs);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_stage_transition on public.opportunities;
create trigger trg_log_stage_transition
  after update of stage on public.opportunities
  for each row execute function public.log_stage_transition();

-- ---------------------------------------------------------------------------
-- 4. Backfill — only on first run; subsequent runs are idempotent.
-- ---------------------------------------------------------------------------
-- 4a. Initial-stage row for every existing opportunity that has no history.
insert into public.stage_transitions
  (opportunity_id, from_stage, to_stage, transitioned_by, transitioned_at)
select o.id, null, 'new', null, o.created_at
from public.opportunities o
where not exists (
  select 1 from public.stage_transitions st
  where st.opportunity_id = o.id
);

-- 4b. From `activities` log (action_type='stage_changed', description like 'a → b')
-- The `→` arrow (U+2192) is what app/admin/opportunities/actions.ts writes.
-- Only insert rows whose parsed stages are valid pipeline stages.
insert into public.stage_transitions
  (opportunity_id, from_stage, to_stage, transitioned_by, transitioned_at)
select
  a.opportunity_id,
  trim(split_part(a.description, '→', 1)) as from_stage,
  trim(split_part(a.description, '→', 2)) as to_stage,
  a.performed_by,
  a.created_at
from public.activities a
where a.action_type = 'stage_changed'
  and a.opportunity_id is not null
  and a.description is not null
  and a.description like '%→%'
  and trim(split_part(a.description, '→', 1)) in (
    'new','contacted','sample_requested','sample_sent','negotiation',
    'price_agreed','production','shipped','won','lost'
  )
  and trim(split_part(a.description, '→', 2)) in (
    'new','contacted','sample_requested','sample_sent','negotiation',
    'price_agreed','production','shipped','won','lost'
  )
  -- Avoid inserting duplicates if migration re-runs.
  and not exists (
    select 1 from public.stage_transitions st
    where st.opportunity_id = a.opportunity_id
      and st.transitioned_at = a.created_at
      and coalesce(st.from_stage, '') = trim(split_part(a.description, '→', 1))
      and st.to_stage = trim(split_part(a.description, '→', 2))
  );

-- 4c. Compute time_in_previous_stage_seconds for the back-filled rows.
with ranked as (
  select
    id,
    opportunity_id,
    transitioned_at,
    lag(transitioned_at) over (
      partition by opportunity_id order by transitioned_at
    ) as prev_at
  from public.stage_transitions
)
update public.stage_transitions st
   set time_in_previous_stage_seconds =
       case
         when r.prev_at is null then null
         else greatest(0, extract(epoch from (st.transitioned_at - r.prev_at)))::bigint
       end
  from ranked r
 where r.id = st.id
   and st.time_in_previous_stage_seconds is distinct from
       case
         when r.prev_at is null then null
         else greatest(0, extract(epoch from (st.transitioned_at - r.prev_at)))::bigint
       end;

-- ---------------------------------------------------------------------------
-- 5. View — opportunity_metrics_v
-- One row per opportunity with its time-in-current-stage and lifetime.
-- ---------------------------------------------------------------------------
create or replace view public.opportunity_metrics_v as
with latest as (
  select distinct on (opportunity_id)
    opportunity_id,
    transitioned_at as stage_entered_at
  from public.stage_transitions
  order by opportunity_id, transitioned_at desc
)
select
  o.id                                 as opportunity_id,
  o.client_id,
  o.lead_id,
  o.stage,
  o.potential_value,
  o.created_at,
  o.last_updated,
  coalesce(l.stage_entered_at, o.created_at) as stage_entered_at,
  greatest(0, floor(
    extract(epoch from (now() - coalesce(l.stage_entered_at, o.created_at))) / 86400
  ))::int                              as days_in_current_stage,
  greatest(0, floor(
    extract(epoch from (now() - o.created_at)) / 86400
  ))::int                              as days_total_lifetime
from public.opportunities o
left join latest l on l.opportunity_id = o.id;

comment on view public.opportunity_metrics_v is
  'Per-opportunity time metrics. days_in_current_stage drives the '
  'Bottleneck tab on /admin/analytics.';

-- ---------------------------------------------------------------------------
-- 6. View — client_pipeline_metrics_v
-- All-time aggregates per client (period filtering happens in queries).
-- ---------------------------------------------------------------------------
create or replace view public.client_pipeline_metrics_v as
select
  p.id                            as client_id,
  p.company_name,
  p.full_name,
  p.account_manager_id,
  count(o.id)                     as total_opportunities,
  count(o.id) filter (where o.stage = 'won')  as won_count,
  count(o.id) filter (where o.stage = 'lost') as lost_count,
  count(o.id) filter (where o.stage not in ('won','lost'))
                                  as in_progress_count,
  coalesce(sum(o.potential_value)
    filter (where o.stage = 'won'), 0)         as won_value,
  coalesce(sum(o.potential_value)
    filter (where o.stage not in ('won','lost')), 0)
                                  as in_progress_value
from public.profiles p
left join public.opportunities o on o.client_id = p.id
where p.role = 'client'
group by p.id, p.company_name, p.full_name, p.account_manager_id;

comment on view public.client_pipeline_metrics_v is
  'Per-client roll-up across the entire history. The /admin/analytics '
  '"By Client" tab combines this with period-filtered transitions.';

-- ---------------------------------------------------------------------------
-- 7. RLS — stage_transitions
-- Same policy as activities: any signed-in admin-shell user can SELECT,
-- only true admins (admin/super_admin/staff) can INSERT/UPDATE.
-- The triggers above run with the table owner so they bypass RLS.
-- ---------------------------------------------------------------------------
alter table public.stage_transitions enable row level security;

drop policy if exists "Staff read stage_transitions" on public.stage_transitions;
create policy "Staff read stage_transitions"
  on public.stage_transitions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in (
          'admin','super_admin','staff',
          'account_executive','lead_researcher','finance'
        )
    )
  );

drop policy if exists "Admins write stage_transitions" on public.stage_transitions;
create policy "Admins write stage_transitions"
  on public.stage_transitions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','super_admin','staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','super_admin','staff')
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Make the views runnable from the admin client
-- (Service-role bypasses RLS; this just ensures grants are clean.)
-- ---------------------------------------------------------------------------
grant select on public.stage_transitions       to authenticated;
grant select on public.opportunity_metrics_v   to authenticated;
grant select on public.client_pipeline_metrics_v to authenticated;
