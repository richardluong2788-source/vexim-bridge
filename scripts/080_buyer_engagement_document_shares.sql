-- ============================================================================
-- Migration 080: link compliance-document shares to a buyer engagement
--
-- The buyer engagement pipeline can now send a supplier dossier / factory video
-- without leaving the buyer workspace. Keep the existing tokenized link model,
-- but record which engagement and buyer email initiated the share so the action
-- is auditable and can be shown alongside the engagement later.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

ALTER TABLE public.tokenized_share_links
  ADD COLUMN IF NOT EXISTS engagement_id UUID
    REFERENCES public.buyer_engagements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_email TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_tokenized_share_links_engagement
  ON public.tokenized_share_links(engagement_id)
  WHERE engagement_id IS NOT NULL;

COMMENT ON COLUMN public.tokenized_share_links.engagement_id IS
  'Pre-opportunity buyer engagement that requested this compliance-document share. NULL for shares created from the supplier workspace.';
COMMENT ON COLUMN public.tokenized_share_links.buyer_email IS
  'Buyer recipient captured when the share email was sent from the engagement pipeline.';
COMMENT ON COLUMN public.tokenized_share_links.sent_at IS
  'When the share email was sent. NULL for links created without sending an email.';
COMMENT ON COLUMN public.tokenized_share_links.sent_by IS
  'AE/admin who sent the share email.';

-- The existing admin/client policies continue to protect this table. The
-- service-role client used by the server actions bypasses RLS after the
-- application capability + ownership checks.
-- ============================================================================
