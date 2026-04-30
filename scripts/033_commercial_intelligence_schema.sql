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
-- Idempotent: IF NOT EXISTS on table creation.
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Audit trail: last update
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ci_opportunity_id ON public.commercial_intelligence(opportunity_id);

-- Enable RLS
ALTER TABLE public.commercial_intelligence ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admin can do anything
CREATE POLICY IF NOT EXISTS ci_super_admin_all
  ON public.commercial_intelligence
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'super_admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Policy: Admin staff can SELECT/INSERT/UPDATE their own records
-- (Those tied to opportunities they manage)
CREATE POLICY IF NOT EXISTS ci_admin_manage
  ON public.commercial_intelligence
  FOR ALL
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'lead_researcher', 'account_executive')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'lead_researcher', 'account_executive')
  );

-- Policy: Clients can VIEW their own opportunities' CI
CREATE POLICY IF NOT EXISTS ci_client_view
  ON public.commercial_intelligence
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'client'
    AND opportunity_id IN (
      SELECT id FROM public.opportunities
      WHERE client_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_commercial_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF NOT EXISTS trg_ci_updated_at ON public.commercial_intelligence;
CREATE TRIGGER trg_ci_updated_at
  BEFORE UPDATE ON public.commercial_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_commercial_intelligence_updated_at();
