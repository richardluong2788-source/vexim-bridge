-- ============================================================
-- Migration 055: Buyer Engagement Stale-Reply Reminder
-- ============================================================
-- Adds the tracking column used by the new daily cron
-- (/api/cron/engagement-stale-check) that watches buyers sitting in
-- 'requirement_email_sent' or 'shortlist_sent' — i.e. the AE is waiting
-- on the buyer to reply — for too long with zero response.
--
-- Business decision: after 14 days of silence, ONLY warn the assigned
-- AE (in-app + email notification). The buyer is NOT auto-returned to
-- the shared inbox and NOT auto-reassigned to another AE — the AE stays
-- owner and decides whether to follow up again or drop the buyer via
-- the existing "Hủy buyer" action.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.buyer_engagements
  ADD COLUMN IF NOT EXISTS stale_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.buyer_engagements.stale_reminder_sent_at IS
  'When the daily stale-reply cron last warned the assigned AE that this buyer has been silent for 14+ days since entering requirement_email_sent/shortlist_sent. Reset to NULL whenever the engagement (re-)enters one of those two waiting stages, so a later stall in a later stage warns again.';

-- Cheap scan target for the cron: only rows currently in a "waiting on
-- buyer" stage that haven't been warned yet.
CREATE INDEX IF NOT EXISTS idx_buyer_engagements_stale_check
  ON public.buyer_engagements(stage, updated_at)
  WHERE stage IN ('requirement_email_sent', 'shortlist_sent')
    AND stale_reminder_sent_at IS NULL;

-- ============================================================
-- DONE
-- ============================================================
