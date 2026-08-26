-- Migration 066 — Auto-archive opportunities stuck in "lost" (Thất bại)
--
-- Purpose
-- -------
-- Cards that land in the "Thất bại" (lost) Kanban column and stay there
-- clutter the Pipeline view forever. We want them to disappear from the
-- board automatically 7 days after they entered "lost", WITHOUT deleting
-- any data — history, analytics (win/loss counts, stage_transitions,
-- deals, activities, buyer_replies, etc.) must all remain intact and
-- queryable.
--
-- This migration only adds a soft-delete style marker column. The actual
-- "archive after 7 days" sweep is done by a daily cron route
-- (/api/cron/archive-lost-opportunities), NOT by a DB trigger, so it's
-- easy to observe/monitor and safe to re-run.
--
-- Idempotent: safe to re-run.

alter table public.opportunities
  add column if not exists archived_at timestamptz;

comment on column public.opportunities.archived_at is
  'Set automatically ~7 days after the opportunity enters the "lost" '
  '(Thất bại) stage. Archived opportunities are hidden from the Pipeline '
  'Kanban board but are NOT deleted — all history/analytics remain intact. '
  'Cleared automatically if the opportunity is ever moved out of "lost".';

create index if not exists opportunities_archived_at_idx
  on public.opportunities (archived_at)
  where archived_at is not null;

-- Fast lookup for the cron sweep: "opportunities currently in stage
-- 'lost' that are not yet archived".
create index if not exists opportunities_lost_unarchived_idx
  on public.opportunities (stage)
  where stage = 'lost' and archived_at is null;
