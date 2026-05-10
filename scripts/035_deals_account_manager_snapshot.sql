-- ============================================================================
-- 035_deals_account_manager_snapshot.sql
--
-- Sprint: client-management-for-AE
--
-- Purpose
--   Snapshot the "account manager who owned the client at the moment the deal
--   was won" onto the `deals` row. Commission / payout reports MUST read this
--   snapshot column instead of joining `profiles.account_manager_id` live, so
--   that a later reassignment never rewrites historical commission credit.
--
-- What this migration does
--   1. Adds `deals.account_manager_at_won UUID` (nullable, FK to profiles.id).
--   2. Creates an index for filtering reports by AE.
--   3. Backfills the column for every existing won deal using the current
--      `profiles.account_manager_id` of the deal's client. This is a one-time
--      best-effort backfill — going forward, the value is set by the
--      `updateOpportunityStage` server action when the stage flips to 'won'.
--   4. Adds a NOT NULL trigger guard so the column cannot be cleared once set.
--      (We intentionally do NOT add `NOT NULL` to the column itself, because
--      historical rows where the client had no manager would otherwise fail.)
--
-- Idempotent: every step is guarded with IF NOT EXISTS / ON CONFLICT.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Column + FK
-- ----------------------------------------------------------------------------
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS account_manager_at_won UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deals.account_manager_at_won IS
  'AE who owned the client when this deal was won. Snapshot taken by '
  'updateOpportunityStage(). Reports MUST filter on this column, NOT on '
  'profiles.account_manager_id, so commission credit survives reassignment.';

-- ----------------------------------------------------------------------------
-- 2. Index for AE-scoped commission reports
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deals_account_manager_at_won
  ON public.deals(account_manager_at_won)
  WHERE account_manager_at_won IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. One-time backfill for existing won deals
--
-- We resolve the AE through the opportunity → client_id → profiles chain.
-- Only update rows where the snapshot is still NULL (idempotent re-run safe).
-- ----------------------------------------------------------------------------
UPDATE public.deals d
SET    account_manager_at_won = p.account_manager_id
FROM   public.opportunities o
JOIN   public.profiles p ON p.id = o.client_id
WHERE  d.opportunity_id = o.id
  AND  o.stage = 'won'
  AND  d.account_manager_at_won IS NULL
  AND  p.account_manager_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Immutability trigger
--
-- Once `account_manager_at_won` is set to a non-NULL value, it must never
-- change. Re-flipping a deal lost→won could otherwise rewrite history.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_deals_lock_won_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.account_manager_at_won IS NOT NULL
     AND NEW.account_manager_at_won IS DISTINCT FROM OLD.account_manager_at_won
  THEN
    RAISE EXCEPTION
      'deals.account_manager_at_won is immutable once set (deal %)',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_lock_won_manager ON public.deals;
CREATE TRIGGER deals_lock_won_manager
  BEFORE UPDATE OF account_manager_at_won ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_deals_lock_won_manager();

COMMIT;
