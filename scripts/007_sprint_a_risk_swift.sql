-- ============================================================
-- ESH (Export Sales Hub) — Sprint A
-- Migration 007: Country risk + Swift/PO verification workflow
-- ============================================================
-- IDEMPOTENT — safe to run multiple times.
-- Goals (per SOP Phase 3 "Closing & Compliance"):
--   1. Capture buyer country on leads so the risk engine can flag
--      high-risk jurisdictions (Pakistan, Nigeria, Iran, ...).
--   2. Store scanned PO, Swift copy, and Bill of Lading in deals
--      (URLs point to Vercel Blob — private access).
--   3. Require admin verification of the Swift wire copy before
--      the opportunity may cross from price_agreed → production.
-- ============================================================


-- ============================================================
-- 1. LEADS: Add country (ISO-like free text, e.g. "US", "PK", "NG")
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS country TEXT;
  -- Free text to avoid coupling to an enum. The risk engine in
  -- lib/risk/country-risk.ts normalises and classifies.

CREATE INDEX IF NOT EXISTS idx_leads_country ON public.leads(country);


-- ============================================================
-- 2. DEALS: Add PO/Swift/BL docs + verification state
-- ============================================================

-- Scanned Purchase Order (Vercel Blob URL — private)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS po_doc_url TEXT;

-- Swift wire transfer copy (Vercel Blob URL — private)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS swift_doc_url TEXT;

-- Buyer's bank transaction reference
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT;

-- Admin-verified that the Swift wire actually hit our bank
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS swift_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS swift_verified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS swift_verified_by UUID REFERENCES public.profiles(id);

-- Bill of Lading (filled in after shipment — Sprint C will use this)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS bl_doc_url TEXT;

-- Risk snapshot at time of deal creation. Admin can override.
-- Values: 'low' | 'medium' | 'high'. NULL until first assessment.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS risk_level TEXT;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_risk_level_check;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_risk_level_check
  CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high'));

CREATE INDEX IF NOT EXISTS idx_deals_swift_verified
  ON public.deals(swift_verified);


-- ============================================================
-- 3. HELPER: ensure there is a deal row for a given opportunity.
-- Called from the server actions when the admin first uploads a
-- PO scan. Keeps the "one deal per opportunity" invariant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_deal_for_opportunity(
  p_opportunity_id UUID,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_id UUID;
BEGIN
  SELECT id INTO v_deal_id
  FROM public.deals
  WHERE opportunity_id = p_opportunity_id;

  IF v_deal_id IS NOT NULL THEN
    RETURN v_deal_id;
  END IF;

  INSERT INTO public.deals (opportunity_id, created_by)
  VALUES (p_opportunity_id, p_created_by)
  RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$$;


-- ============================================================
-- 4. RLS refresh — existing policies already cover the new columns
-- since they apply to the whole row. No policy changes needed.
-- ============================================================
-- (intentionally empty — left for clarity)


-- ============================================================
-- DONE
-- ============================================================
-- Verify with:
--   \d public.deals   -- expect po_doc_url, swift_doc_url,
--                        transaction_reference, swift_verified,
--                        swift_verified_at, swift_verified_by,
--                        bl_doc_url, risk_level
--   \d public.leads   -- expect country column
-- ============================================================
