-- ============================================================
-- Sprint: L/C & Bank Verification (Anti-fraud Letter of Credit)
-- Purpose:
--   1) Cache global SWIFT BIC directory with risk tier (1-4) +
--      OFAC/EU/UN sanctions flag + correspondent-with-VN flag.
--   2) Per-opportunity verification record: issuing bank, the
--      6-point manual checklist, document URL, and final status.
-- Pattern: matches buyer_replies / compliance_docs (RLS via
--   public.profiles role lookup; no auth.jwt() reliance).
-- ============================================================

-- -----------------------------------------------------------
-- 1. Bank Directory
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_directory (
  bic TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT,
  tier SMALLINT NOT NULL DEFAULT 3 CHECK (tier BETWEEN 1 AND 4),
  is_sanctioned BOOLEAN NOT NULL DEFAULT false,
  has_correspondent_vn BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_directory_country ON public.bank_directory(country_code);
CREATE INDEX IF NOT EXISTS idx_bank_directory_tier ON public.bank_directory(tier);

ALTER TABLE public.bank_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated can read bank_directory" ON public.bank_directory;
CREATE POLICY "All authenticated can read bank_directory"
  ON public.bank_directory FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage bank_directory" ON public.bank_directory;
CREATE POLICY "Admins manage bank_directory"
  ON public.bank_directory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE public.bank_directory IS
  'Cache cua BIC/SWIFT codes voi tier danh gia rui ro va sanction flag.';

-- -----------------------------------------------------------
-- 2. L/C Verifications (per opportunity)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities(id) ON DELETE CASCADE,

  -- Issuing bank snapshot (Layer 1+2+3)
  bank_bic TEXT,
  bank_name_snapshot TEXT,
  bank_country_snapshot TEXT,
  detected_tier SMALLINT CHECK (detected_tier BETWEEN 1 AND 4),
  detected_sanctioned BOOLEAN,
  recommendation TEXT,

  -- Layer 4: 6-point manual checklist
  received_via_swift BOOLEAN NOT NULL DEFAULT false,
  bic_matches BOOLEAN NOT NULL DEFAULT false,
  amount_matches_po BOOLEAN NOT NULL DEFAULT false,
  description_matches_po BOOLEAN NOT NULL DEFAULT false,
  shipment_date_reasonable BOOLEAN NOT NULL DEFAULT false,
  no_soft_clauses BOOLEAN NOT NULL DEFAULT false,

  -- Document
  lc_document_url TEXT,

  -- Status
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,

  -- Audit
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lc_verifications_opportunity ON public.lc_verifications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_lc_verifications_status ON public.lc_verifications(verification_status);

ALTER TABLE public.lc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage lc_verifications" ON public.lc_verifications;
CREATE POLICY "Staff manage lc_verifications"
  ON public.lc_verifications FOR ALL
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

DROP POLICY IF EXISTS "Clients view own lc_verifications" ON public.lc_verifications;
CREATE POLICY "Clients view own lc_verifications"
  ON public.lc_verifications FOR SELECT
  USING (
    opportunity_id IN (
      SELECT id FROM public.opportunities
      WHERE client_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_lc_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lc_verifications_updated_at ON public.lc_verifications;
CREATE TRIGGER trg_lc_verifications_updated_at
  BEFORE UPDATE ON public.lc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lc_verifications_updated_at();

COMMENT ON TABLE public.lc_verifications IS
  'Ngan Tham dinh Ngan hang & L/C - bank verification + 6-point checklist for each opportunity.';

-- -----------------------------------------------------------
-- 3. Seed bank_directory with 50 well-known banks
--    (Tier 1 globals + Tier 2/3 examples + Tier 4 OFAC/UN)
--    Idempotent via ON CONFLICT.
-- -----------------------------------------------------------
INSERT INTO public.bank_directory (bic, bank_name, country_code, country_name, tier, is_sanctioned, has_correspondent_vn, source) VALUES
  ('CHASUS33', 'JPMorgan Chase Bank N.A.', 'US', 'United States', 1, false, true, 'seed'),
  ('BOFAUS3N', 'Bank of America N.A.', 'US', 'United States', 1, false, true, 'seed'),
  ('CITIUS33', 'Citibank N.A.', 'US', 'United States', 1, false, true, 'seed'),
  ('WFBIUS6S', 'Wells Fargo Bank N.A.', 'US', 'United States', 1, false, true, 'seed'),
  ('MRMDUS33', 'Bank of New York Mellon', 'US', 'United States', 1, false, true, 'seed'),
  ('HSBCGB2L', 'HSBC Bank plc', 'GB', 'United Kingdom', 1, false, true, 'seed'),
  ('BARCGB22', 'Barclays Bank plc', 'GB', 'United Kingdom', 1, false, true, 'seed'),
  ('SCBLGB2L', 'Standard Chartered Bank', 'GB', 'United Kingdom', 1, false, true, 'seed'),
  ('NWBKGB2L', 'NatWest Bank plc', 'GB', 'United Kingdom', 1, false, false, 'seed'),
  ('BNPAFRPP', 'BNP Paribas', 'FR', 'France', 1, false, true, 'seed'),
  ('SOGEFRPP', 'Societe Generale', 'FR', 'France', 1, false, true, 'seed'),
  ('CRLYFRPP', 'Credit Agricole CIB', 'FR', 'France', 1, false, false, 'seed'),
  ('DEUTDEFF', 'Deutsche Bank AG', 'DE', 'Germany', 1, false, true, 'seed'),
  ('COBADEFF', 'Commerzbank AG', 'DE', 'Germany', 1, false, true, 'seed'),
  ('UBSWCHZH80A', 'UBS AG', 'CH', 'Switzerland', 1, false, true, 'seed'),
  ('CRESCHZZ80A', 'Credit Suisse AG', 'CH', 'Switzerland', 1, false, false, 'seed'),
  ('INGBNL2A', 'ING Bank N.V.', 'NL', 'Netherlands', 1, false, true, 'seed'),
  ('RABONL2U', 'Rabobank Nederland', 'NL', 'Netherlands', 1, false, true, 'seed'),
  ('BKCHCNBJ', 'Bank of China', 'CN', 'China', 1, false, true, 'seed'),
  ('ICBKCNBJ', 'Industrial and Commercial Bank of China', 'CN', 'China', 1, false, true, 'seed'),
  ('ABOCCNBJ', 'Agricultural Bank of China', 'CN', 'China', 1, false, true, 'seed'),
  ('PCBCCNBJ', 'China Construction Bank', 'CN', 'China', 1, false, true, 'seed'),
  ('COMMCNSH', 'Bank of Communications', 'CN', 'China', 1, false, true, 'seed'),
  ('BOTKJPJT', 'MUFG Bank Ltd.', 'JP', 'Japan', 1, false, true, 'seed'),
  ('SMBCJPJT', 'Sumitomo Mitsui Banking Corporation', 'JP', 'Japan', 1, false, true, 'seed'),
  ('MHCBJPJT', 'Mizuho Bank Ltd.', 'JP', 'Japan', 1, false, true, 'seed'),
  ('KOEXKRSE', 'KEB Hana Bank', 'KR', 'South Korea', 1, false, true, 'seed'),
  ('CZNBKRSE', 'Shinhan Bank', 'KR', 'South Korea', 1, false, true, 'seed'),
  ('IBKOKRSE', 'Industrial Bank of Korea', 'KR', 'South Korea', 1, false, true, 'seed'),
  ('DBSSSGSG', 'DBS Bank Ltd.', 'SG', 'Singapore', 1, false, true, 'seed'),
  ('UOVBSGSG', 'United Overseas Bank', 'SG', 'Singapore', 1, false, true, 'seed'),
  ('OCBCSGSG', 'Oversea-Chinese Banking Corporation', 'SG', 'Singapore', 1, false, true, 'seed'),
  ('HSBCAU2S', 'HSBC Bank Australia', 'AU', 'Australia', 1, false, true, 'seed'),
  ('ANZBAU3M', 'Australia and New Zealand Banking Group', 'AU', 'Australia', 1, false, true, 'seed'),
  ('CTBAAU2S', 'Commonwealth Bank of Australia', 'AU', 'Australia', 1, false, true, 'seed'),
  ('NATAAU33', 'National Australia Bank', 'AU', 'Australia', 1, false, true, 'seed'),
  ('ROYCCAT2', 'Royal Bank of Canada', 'CA', 'Canada', 1, false, true, 'seed'),
  ('BOFMCAM2', 'Bank of Montreal', 'CA', 'Canada', 1, false, false, 'seed'),
  ('TDOMCATTTOR', 'Toronto-Dominion Bank', 'CA', 'Canada', 1, false, false, 'seed'),
  ('EMCRAEAD', 'Emirates NBD Bank PJSC', 'AE', 'United Arab Emirates', 2, false, true, 'seed'),
  ('NBADAEAA', 'First Abu Dhabi Bank', 'AE', 'United Arab Emirates', 2, false, true, 'seed'),
  ('HBLPPKKA', 'Habib Bank Limited', 'PK', 'Pakistan', 3, false, false, 'seed'),
  ('NBPAPKKA', 'National Bank of Pakistan', 'PK', 'Pakistan', 3, false, false, 'seed'),
  ('SABRRUMM', 'Sberbank', 'RU', 'Russia', 4, true, false, 'seed-ofac'),
  ('VTBRRUMM', 'VTB Bank', 'RU', 'Russia', 4, true, false, 'seed-ofac'),
  ('GAZPRUMM', 'Gazprombank', 'RU', 'Russia', 4, true, false, 'seed-ofac'),
  ('BMRKIRTH', 'Bank Markazi (Central Bank of Iran)', 'IR', 'Iran', 4, true, false, 'seed-ofac'),
  ('MELIIRTH', 'Bank Melli Iran', 'IR', 'Iran', 4, true, false, 'seed-ofac'),
  ('CBSYSYDA', 'Commercial Bank of Syria', 'SY', 'Syria', 4, true, false, 'seed-ofac'),
  ('FTPBKPPY', 'Foreign Trade Bank of DPRK', 'KP', 'North Korea', 4, true, false, 'seed-un')
ON CONFLICT (bic) DO NOTHING;
