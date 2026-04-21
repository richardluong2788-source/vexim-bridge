-- ============================================================
-- ESH — Sprint A follow-up
-- Migration 008: Enforce one-deal-per-opportunity invariant
-- ============================================================
-- The SOP assumes a single deal row per opportunity (one PO, one Swift,
-- one B/L). Migration 001 did not enforce uniqueness, so we add it here.
-- Idempotent.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_opportunity_id_unique'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_opportunity_id_unique UNIQUE (opportunity_id);
  END IF;
END$$;
