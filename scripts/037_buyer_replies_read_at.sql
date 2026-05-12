-- ============================================================
-- Migration 037: Add read_at to buyer_replies
-- Enables per-opportunity unread badge on the Kanban board.
-- ============================================================
-- Idempotent. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.buyer_replies
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN public.buyer_replies.read_at IS
  'Set when an admin first opens/reads this reply. NULL means unread.';

-- Partial index — only indexes unread rows, keeping it tiny.
CREATE INDEX IF NOT EXISTS idx_buyer_replies_unread
  ON public.buyer_replies (opportunity_id)
  WHERE read_at IS NULL;
