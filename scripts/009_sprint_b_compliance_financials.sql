-- ============================================================
-- ESH Sprint B — Compliance Docs + Financials + Tokenized Links
-- Migration 009 (idempotent)
--
-- Adds:
--   1. compliance_docs:   centralized storage for client-scoped files
--                         (FDA cert scan, COA, price floor sheet, factory
--                         video). Drives the Client Onboarding SOP.
--   2. tokenized_share_links: expiring UUID links that let a buyer view
--                         the factory video without needing an account.
--   3. deals financial fields: cost_price_supplier, suggested_selling_price,
--                         quantity_units + a GENERATED profit_margin_usd.
-- ============================================================


-- ------------------------------------------------------------
-- 1. COMPLIANCE DOCS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Which kind of SOP doc this is.
  kind TEXT NOT NULL CHECK (kind IN (
    'fda_certificate',       -- scan of FDA facility registration cert
    'coa',                   -- Certificate of Analysis (product lab test)
    'price_floor',           -- client's minimum acceptable price sheet
    'factory_video',         -- 3D/tour video of the production facility
    'factory_photo',         -- still photos of the facility
    'other'
  )),
  title TEXT,
  url TEXT NOT NULL,                 -- Vercel Blob URL
  mime_type TEXT,
  size_bytes BIGINT,
  issued_at DATE,
  expires_at DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_docs_owner
  ON public.compliance_docs(owner_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_kind
  ON public.compliance_docs(owner_id, kind);

ALTER TABLE public.compliance_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage compliance_docs" ON public.compliance_docs;
CREATE POLICY "Admins manage compliance_docs"
  ON public.compliance_docs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

DROP POLICY IF EXISTS "Clients view own compliance_docs" ON public.compliance_docs;
CREATE POLICY "Clients view own compliance_docs"
  ON public.compliance_docs FOR SELECT
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_compliance_docs_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_compliance_docs_updated ON public.compliance_docs;
CREATE TRIGGER on_compliance_docs_updated
  BEFORE UPDATE ON public.compliance_docs
  FOR EACH ROW EXECUTE FUNCTION public.handle_compliance_docs_updated();


-- ------------------------------------------------------------
-- 2. TOKENIZED SHARE LINKS
-- Used to share factory videos with buyers for a limited window
-- (default 30 days). The token is the primary key so the server
-- can look it up in O(1) on the public /share/[token] route.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tokenized_share_links (
  token UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES public.compliance_docs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokenized_links_doc
  ON public.tokenized_share_links(doc_id);
CREATE INDEX IF NOT EXISTS idx_tokenized_links_owner
  ON public.tokenized_share_links(owner_id);

ALTER TABLE public.tokenized_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tokenized_links" ON public.tokenized_share_links;
CREATE POLICY "Admins manage tokenized_links"
  ON public.tokenized_share_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

DROP POLICY IF EXISTS "Clients view own tokenized_links" ON public.tokenized_share_links;
CREATE POLICY "Clients view own tokenized_links"
  ON public.tokenized_share_links FOR SELECT
  USING (owner_id = auth.uid());


-- ------------------------------------------------------------
-- 3. DEAL FINANCIAL FIELDS
-- Adds cost/selling/quantity so margin becomes explicit instead
-- of buried in commission math.
--   profit_margin_usd =
--     (suggested_selling_price - cost_price_supplier) * COALESCE(quantity_units, 1)
-- ------------------------------------------------------------
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS cost_price_supplier DECIMAL(15, 2);
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS suggested_selling_price DECIMAL(15, 2);
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS quantity_units DECIMAL(15, 3);
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS unit_label TEXT;
  -- e.g. "kg", "MT", "container". Free text; mirrors opportunities.price_unit.

-- profit_margin_usd — drop/re-create defensively in case the formula
-- ever needs to change during Sprint B iterations.
ALTER TABLE public.deals DROP COLUMN IF EXISTS profit_margin_usd;
ALTER TABLE public.deals
  ADD COLUMN profit_margin_usd DECIMAL(15, 2)
  GENERATED ALWAYS AS (
    CASE
      WHEN cost_price_supplier IS NOT NULL
        AND suggested_selling_price IS NOT NULL
      THEN (suggested_selling_price - cost_price_supplier)
           * COALESCE(quantity_units, 1)
      ELSE NULL
    END
  ) STORED;


-- ============================================================
-- DONE. Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='deals';
--   SELECT COUNT(*) FROM public.compliance_docs;
-- ============================================================
