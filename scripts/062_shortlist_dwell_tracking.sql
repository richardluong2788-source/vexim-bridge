-- ============================================================
-- Migration 062: Buyer Dwell-Time Tracking on Shortlist Page
-- ============================================================
-- Adds per-supplier "how long did the buyer actually look at this
-- option" tracking to the public /shortlist/[token] page, on top of
-- the link-level view_count/last_viewed_at that already exists on
-- shortlist_share_links (052).
--
-- Why not just view_count?
--   view_count/last_viewed_at only tell the AE the buyer opened the
--   LINK. They say nothing about which of the 2-5 supplier options
--   (Option A/B/C...) the buyer actually spent time reading. This
--   migration adds that per-option signal so the AE can follow up on
--   "which supplier is winning the buyer's attention" instead of
--   guessing from buyer_action alone (many buyers never click a
--   button at all).
--
-- Design:
--   - buyer_engagement_shortlist_items gets three new MUTABLE columns
--     (total_dwell_ms, first_viewed_at, last_dwell_at). These are an
--     explicit exception to the "frozen snapshot" rule documented on
--     this table (052) — same class of exception as the existing
--     buyer_action/buyer_interested/buyer_responded_at columns, which
--     are also buyer-driven telemetry, not scoring data.
--   - A SECURITY DEFINER RPC (increment_shortlist_item_dwell) is the
--     only write path. It re-validates the item belongs to the given
--     version (same defense-in-depth pattern as markShortlistInterest
--     in app/shortlist/[token]/actions.ts) and clamps the delta so a
--     tampered client payload can't inflate numbers arbitrarily.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New columns on buyer_engagement_shortlist_items
-- ------------------------------------------------------------
ALTER TABLE public.buyer_engagement_shortlist_items
  ADD COLUMN IF NOT EXISTS total_dwell_ms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dwell_at TIMESTAMPTZ;

COMMENT ON COLUMN public.buyer_engagement_shortlist_items.total_dwell_ms IS
  'Cumulative milliseconds this supplier card was >=60% visible in the buyer''s viewport on the public shortlist page. Buyer-driven telemetry (like buyer_action) — mutable even after the parent version is sent, unlike the frozen scoring/snapshot columns on this table.';
COMMENT ON COLUMN public.buyer_engagement_shortlist_items.first_viewed_at IS
  'First time this specific supplier card became visible to the buyer.';
COMMENT ON COLUMN public.buyer_engagement_shortlist_items.last_dwell_at IS
  'Most recent time a dwell-time beacon was recorded for this supplier card. Use this (not the link-level last_viewed_at) to know when the buyer was last actually looking at THIS option.';

CREATE INDEX IF NOT EXISTS idx_shortlist_items_last_dwell
  ON public.buyer_engagement_shortlist_items(last_dwell_at)
  WHERE last_dwell_at IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Atomic increment RPC — the only write path for dwell data.
--    SECURITY DEFINER so the public (anon) beacon endpoint's admin
--    client can call it; it re-checks version_id itself instead of
--    trusting the caller, mirroring markShortlistInterest's
--    defense-in-depth check.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_shortlist_item_dwell(
  p_item_id UUID,
  p_version_id UUID,
  p_delta_ms INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clamped INTEGER;
BEGIN
  -- Clamp: ignore non-positive values, cap a single beacon at 2 minutes
  -- of dwell so a tampered/replayed client payload can't inflate a
  -- supplier's numbers arbitrarily.
  v_clamped := LEAST(GREATEST(p_delta_ms, 0), 120000);
  IF v_clamped = 0 THEN
    RETURN;
  END IF;

  UPDATE public.buyer_engagement_shortlist_items
  SET
    total_dwell_ms = total_dwell_ms + v_clamped,
    first_viewed_at = COALESCE(first_viewed_at, NOW()),
    last_dwell_at = NOW()
  WHERE id = p_item_id
    AND version_id = p_version_id;
END;
$$;

COMMENT ON FUNCTION public.increment_shortlist_item_dwell IS
  'Atomically adds clamped dwell milliseconds to a shortlist item, only if it belongs to the given version. Called from the public /shortlist/[token]/track beacon endpoint via the service-role client.';

-- ------------------------------------------------------------
-- DONE
-- ------------------------------------------------------------
-- After running this migration:
--   1. Verify columns:
--        SELECT column_name FROM information_schema.columns
--        WHERE table_name = 'buyer_engagement_shortlist_items'
--          AND column_name IN ('total_dwell_ms', 'first_viewed_at', 'last_dwell_at');
--   2. Verify function:
--        SELECT proname FROM pg_proc WHERE proname = 'increment_shortlist_item_dwell';
-- ============================================================
