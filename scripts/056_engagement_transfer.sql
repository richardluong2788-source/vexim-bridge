-- Buyer Engagement Transfer
--
-- Business case: a buyer gets assigned to an AE based on industry match at
-- the LR triage step, but once the AE actually asks for requirements the
-- buyer turns out to want a product/category that AE's clients don't cover
-- (e.g. same "Agriculture" industry but a completely different HS code).
-- This adds a lightweight audit trail so the AE can hand the buyer to a
-- better-fit AE instead of dropping a real lead or muddling through a
-- mismatched deal.
--
-- Reassignment itself just updates buyer_engagements.account_manager_id
-- (see transferEngagement in app/admin/ae-inbox/engagement-actions.ts) —
-- these columns only remember where it came from and why, for the audit
-- trail and so the new AE has context.

ALTER TABLE public.buyer_engagements
  ADD COLUMN IF NOT EXISTS transferred_from_ae_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_reason TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

COMMENT ON COLUMN public.buyer_engagements.transferred_from_ae_id IS
  'Previous account_manager_id, set the moment an AE hands this buyer off to another AE (e.g. product mismatch discovered after claiming).';
COMMENT ON COLUMN public.buyer_engagements.transfer_reason IS
  'Free-text reason the transferring AE gave (e.g. "Buyer hỏi sản phẩm khác ngành với client của tôi").';
COMMENT ON COLUMN public.buyer_engagements.transferred_at IS
  'Timestamp of the most recent transfer. Null if this engagement has never been transferred.';
