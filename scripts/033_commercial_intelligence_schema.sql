-- ============================================================
-- Migration 033: Commercial Intelligence for Opportunities
-- ============================================================
-- Adds a dedicated table to store verified commercial intelligence
-- data for each opportunity. This is filled in by Lead Researcher
-- and Account Executive to prove that the buyer meets the
-- "Có lịch sử nhập khẩu hoặc phân phối sản phẩm liên quan" criterion.
--
-- Key fields:
-- - Main HS Code: The primary Harmonized Tariff code
-- - Import History Summary: Text summary of buyer's import patterns
-- - Main Competitors: Key suppliers/competitors the buyer uses
--
-- Idempotent: safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commercial_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities(id) ON DELETE CASCADE,

  -- Main HS Code / Tariff code (e.g. "1905.30")
  main_hs_code TEXT,

  -- Free-text summary of buyer's import history
  -- E.g. "Imports 50+ containers/year of instant noodles from Vietnam, Thailand"
  import_history_summary TEXT,

  -- Comma-separated or JSONB list of main competitors/suppliers
  -- E.g. "Maruchan (Japan), Acecook (Vietnam), Samyang (Korea)"
  main_competitors TEXT,

  -- Audit trail: who created and when
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit trail: last update
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ci_opportunity_id
  ON public.commercial_intelligence(opportunity_id);

-- Enable RLS
ALTER TABLE public.commercial_intelligence ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- RLS Policies
-- Pattern matches existing tables (buyer_replies, compliance_docs):
--   * Role lookup goes through public.profiles
--   * Use DROP POLICY IF EXISTS + CREATE POLICY (Postgres does NOT
--     support CREATE POLICY IF NOT EXISTS)
-- ------------------------------------------------------------

-- Staff (admin / super_admin / lead_researcher / account_executive) manage CI
DROP POLICY IF EXISTS "Staff manage commercial_intelligence" ON public.commercial_intelligence;
CREATE POLICY "Staff manage commercial_intelligence"
  ON public.commercial_intelligence FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'admin', 'staff', 'super_admin',
          'account_executive', 'lead_researcher'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'admin', 'staff', 'super_admin',
          'account_executive', 'lead_researcher'
        )
    )
  );

-- Clients can VIEW CI data for their own opportunities (read-only).
-- This lets us prove "we did the homework" to the client.
DROP POLICY IF EXISTS "Clients view own commercial_intelligence" ON public.commercial_intelligence;
CREATE POLICY "Clients view own commercial_intelligence"
  ON public.commercial_intelligence FOR SELECT
  USING (
    opportunity_id IN (
      SELECT id FROM public.opportunities
      WHERE client_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Auto-update updated_at timestamp
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_commercial_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ci_updated_at ON public.commercial_intelligence;
CREATE TRIGGER trg_ci_updated_at
  BEFORE UPDATE ON public.commercial_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_commercial_intelligence_updated_at();

COMMENT ON TABLE public.commercial_intelligence IS
  'Ngăn Tình báo Thương mại — verified buyer intelligence (HS code, import history, competitors) attached to each Qualified Opportunity. Proves the buyer meets the import-history criterion in the SOP.';
