-- ============================================================================
-- Migration 052: buyer_replies ambiguous-match confirmation
-- ============================================================================
-- Context: since the shortlist model allows up to MAX_CLIENTS_PER_BUYER (3)
-- competing clients/AEs to hold an open opportunity for the SAME buyer at
-- once, the webhook's sender-email fallback match (used when a buyer's
-- reply loses its In-Reply-To thread header) can no longer safely assume
-- ".order(last_updated desc).limit(1)" picks the right opportunity — there
-- may be 2-3 equally plausible candidates, each owned by a different AE.
--
-- Instead of silently guessing (and risking a reply being misrouted to the
-- wrong AE while the right AE never finds out), we:
--   1. Still attach the reply to ONE opportunity_id (kept NOT NULL) so the
--      row is never orphaned and something always shows up somewhere.
--   2. Record EVERY candidate opportunity that could plausibly own it.
--   3. Flag needs_ae_confirmation = true so all candidate AEs are notified
--      and asked to confirm/claim it, rather than only the guessed owner.
-- Idempotent. Safe to run multiple times.
-- ============================================================================

ALTER TABLE public.buyer_replies
  ADD COLUMN IF NOT EXISTS needs_ae_confirmation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS candidate_opportunity_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.buyer_replies.needs_ae_confirmation IS
  'True when the sender-email fallback match found 2+ equally plausible open opportunities for this buyer (multiple competing clients). The reply is provisionally attached to opportunity_id (most recently updated candidate) but every candidate AE must be notified — none should assume ownership until one of them confirms.';
COMMENT ON COLUMN public.buyer_replies.candidate_opportunity_ids IS
  'All open opportunity ids that were plausible matches at the time this reply arrived (includes opportunity_id itself). Only meaningful when needs_ae_confirmation is/was true.';
COMMENT ON COLUMN public.buyer_replies.confirmed_by IS
  'profiles.id of the AE/admin who confirmed this reply belongs to opportunity_id (clearing needs_ae_confirmation). NULL if never ambiguous or not yet confirmed.';
COMMENT ON COLUMN public.buyer_replies.confirmed_at IS
  'When confirmed_by claimed this reply. NULL if never ambiguous or not yet confirmed.';

-- Fast lookup: "which replies still need someone to confirm ownership".
CREATE INDEX IF NOT EXISTS idx_buyer_replies_needs_confirmation
  ON public.buyer_replies (needs_ae_confirmation)
  WHERE needs_ae_confirmation = true;

-- ============================================================================
-- DONE
-- After this migration:
--   - app/api/webhooks/resend/route.ts must set needs_ae_confirmation +
--     candidate_opportunity_ids when the sender-email fallback finds 2+
--     open opportunities, and notify ALL candidate owners (not just one).
--   - A confirm action (e.g. confirmBuyerReplyOwnerAction) must let an AE
--     claim the reply for their own opportunity, setting confirmed_by/at
--     and needs_ae_confirmation = false. If the AE's opportunity differs
--     from the provisional opportunity_id, it must be reassigned to theirs.
-- ============================================================================
