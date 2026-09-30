-- Deterministic buyer-to-campaign product/category/industry matching.
-- Product text is primary; industry-only candidates are held for AE discovery review.
-- HS codes corroborate or raise a conflict flag; they never create a match alone.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS target_product_name text,
  ADD COLUMN IF NOT EXISTS target_industries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_hs_codes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.campaign_enrollments
  ADD COLUMN IF NOT EXISTS match_level text,
  ADD COLUMN IF NOT EXISTS match_confidence smallint,
  ADD COLUMN IF NOT EXISTS match_reason text,
  ADD COLUMN IF NOT EXISTS match_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS match_requires_human_review boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_enrollments_match_level_check'
      AND conrelid = 'public.campaign_enrollments'::regclass
  ) THEN
    ALTER TABLE public.campaign_enrollments
      ADD CONSTRAINT campaign_enrollments_match_level_check
      CHECK (match_level IS NULL OR match_level IN ('product', 'category', 'industry'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_enrollments_match_confidence_check'
      AND conrelid = 'public.campaign_enrollments'::regclass
  ) THEN
    ALTER TABLE public.campaign_enrollments
      ADD CONSTRAINT campaign_enrollments_match_confidence_check
      CHECK (match_confidence IS NULL OR match_confidence BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_enrollments_match_evidence_array_check'
      AND conrelid = 'public.campaign_enrollments'::regclass
  ) THEN
    ALTER TABLE public.campaign_enrollments
      ADD CONSTRAINT campaign_enrollments_match_evidence_array_check
      CHECK (jsonb_typeof(match_evidence) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_enrollments_campaign_match_level_idx
  ON public.campaign_enrollments (campaign_id, match_level);

COMMENT ON COLUMN public.campaigns.target_product_name IS
  'Optional specific product target. A product match requires LR product-text evidence; industry and HS cannot create one.';
COMMENT ON COLUMN public.campaigns.target_industries IS
  'Canonical/legacy-normalized buyer industries; supporting/discovery target only, never evidence of a specific product need.';
COMMENT ON COLUMN public.campaigns.target_hs_codes IS
  'Optional campaign HS codes; can corroborate or flag conflicts with textual product evidence, never match independently.';
COMMENT ON COLUMN public.campaign_enrollments.match_level IS
  'Rule-based match level at enrollment: product, category, or industry (industry-only candidates require AE review).';
COMMENT ON COLUMN public.campaign_enrollments.match_confidence IS
  'Rule-based strength indicator from 0 to 100; not a statistical probability.';
COMMENT ON COLUMN public.campaign_enrollments.match_reason IS
  'Human-readable rule-based reason and any conflict requiring review.';
COMMENT ON COLUMN public.campaign_enrollments.match_evidence IS
  'LR source fields and supporting HS evidence used at enrollment; snapshot for AE audit.';
COMMENT ON COLUMN public.campaign_enrollments.match_requires_human_review IS
  'Persistent classifier caution (e.g. industry-only or contradictory signals), even after AE resolves the active hold.';

-- Existing active enrollments predate the match snapshot. Hold them for one AE
-- review rather than allowing a legacy industry/Vietnam filter to imply product fit.
UPDATE public.campaign_enrollments
SET match_requires_human_review = true,
    needs_human_review = true,
    human_review_reason = COALESCE(
      human_review_reason,
      'Legacy enrollment has no product/category match snapshot; AE review required before further campaign activity.'
    ),
    next_action_at = NULL,
    next_action_type = 'human_review'
WHERE match_level IS NULL
  AND state NOT IN ('nurture', 'replied_handoff', 'stopped', 'suppressed', 'invalid_contact');

-- Pending legacy drafts were generated without match-aware copy limits; require
-- regeneration after the reviewer resolves the enrollment hold.
UPDATE public.email_drafts AS d
SET status = 'draft',
    error_message = COALESCE(
      NULLIF(d.error_message, ''),
      'Legacy enrollment lacks match metadata; AE review and draft regeneration required.'
    )
FROM public.campaign_enrollments AS e
WHERE d.campaign_enrollment_id = e.id
  AND e.match_level IS NULL
  AND d.status = 'pending_approval';
