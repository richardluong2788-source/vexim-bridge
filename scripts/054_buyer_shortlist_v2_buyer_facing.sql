-- ============================================================
-- Migration 054: Buyer Shortlist v2 — buyer-facing hardening
-- ============================================================
-- Supports the "Buyer Shortlist v2" scope approved for the buyer-facing
-- /shortlist/[token] page:
--
--   - Adds 'requested_order_discussion' as a distinct buyer_action value.
--     This is what the buyer-facing "I would like to discuss an order"
--     button now writes. It is intentionally NOT the same as 'sent_po':
--     'sent_po' remains an AE/Operations-only classification recorded
--     internally once a real purchase order has actually been exchanged
--     through the proper commercial process — it is never triggered by a
--     buyer click on the shortlist page anymore.
--
-- No other schema changes. Does not touch scoring, versioning, RLS, or
-- the buyer_engagements stage machine — those are explicitly out of
-- scope for this change.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.buyer_engagement_shortlist_items
  DROP CONSTRAINT IF EXISTS buyer_engagement_shortlist_items_buyer_action_check;

ALTER TABLE public.buyer_engagement_shortlist_items
  ADD CONSTRAINT buyer_engagement_shortlist_items_buyer_action_check
  CHECK (buyer_action IS NULL OR buyer_action IN (
    'viewed_only',
    'interested_no_details',
    'requested_info',
    'requested_sample',
    'requested_meeting',
    'requested_order_discussion',
    'selected_primary',
    'sent_price_volume',
    'sent_po'
  ));

COMMENT ON COLUMN public.buyer_engagement_shortlist_items.buyer_action IS
  'Buyer-facing actions ("requested_info", "requested_sample", "requested_meeting", "interested_no_details", "requested_order_discussion") are the only values a buyer can set from the public /shortlist/[token] page. "selected_primary", "sent_price_volume" and "sent_po" are internal/AE-only classifications and must never be exposed as a one-click buyer action.';

-- After running this migration:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'buyer_engagement_shortlist_items_buyer_action_check';
-- ============================================================
