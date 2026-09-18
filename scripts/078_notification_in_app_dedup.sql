-- ============================================================
-- Migration 078: In-app notification dedup
-- ============================================================
-- Email and Telegram already unique on (user_id, dedup_key). The in-app
-- `notifications` table did not, so a retried server action / cron wrote
-- duplicate bell rows for the same event. Mirror the ledger key onto the
-- feed itself.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedup_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_user_dedup
  ON public.notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

COMMENT ON COLUMN public.notifications.dedup_key IS
  'Optional idempotency key matching notification_email_log.dedup_key. Unique per user when set.';

-- ============================================================
-- DONE
-- ============================================================
