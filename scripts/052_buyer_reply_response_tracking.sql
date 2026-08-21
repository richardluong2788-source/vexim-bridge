-- ============================================================
-- Migration 052: Track AE follow-up replies to buyer messages
-- ============================================================
-- Lets an AE reply to a specific buyer_replies row (e.g. the buyer asked
-- a follow-up question mid-negotiation, before requirements are fully
-- captured) without leaving the "Đang xử lý" / engagement workspace.
--
-- Links the reply to the email_drafts row that was sent in response, so
-- the UI can show "Đã trả lời" instead of leaving the AE guessing whether
-- they already answered.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.buyer_replies
  ADD COLUMN IF NOT EXISTS responded_email_draft_id UUID REFERENCES public.email_drafts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_buyer_replies_responded_email_draft
  ON public.buyer_replies(responded_email_draft_id);

COMMENT ON COLUMN public.buyer_replies.responded_email_draft_id IS
  'The email_drafts row (email_type = follow_up) an AE sent in direct response to this buyer reply, if any.';
COMMENT ON COLUMN public.buyer_replies.responded_at IS
  'When the AE sent a follow-up response to this specific reply. NULL means not yet answered from within the app.';

-- ============================================================
-- DONE
-- After running: SELECT column_name FROM information_schema.columns
--                 WHERE table_name = 'buyer_replies' AND column_name LIKE 'responded%';
-- ============================================================
