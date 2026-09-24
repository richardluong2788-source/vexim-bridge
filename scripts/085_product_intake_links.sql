-- Migration: 085_product_intake_links.sql
-- Purpose: Allow AE to generate a public link for supplier to self-fill products
-- Flow: AE creates client -> generates product intake link -> supplier opens /product-intake/[token] -> fills products with price attestation

CREATE TABLE IF NOT EXISTS public.product_intake_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_intake_links_token ON public.product_intake_links(token);
CREATE INDEX IF NOT EXISTS idx_product_intake_links_client ON public.product_intake_links(client_id);
CREATE INDEX IF NOT EXISTS idx_product_intake_links_expires ON public.product_intake_links(expires_at);

ALTER TABLE public.product_intake_links ENABLE ROW LEVEL SECURITY;

-- Only authenticated staff can manage, but public can read via token (handled via RPC / service role)
DROP POLICY IF EXISTS "Staff manage product intake links" ON public.product_intake_links;
CREATE POLICY "Staff manage product intake links"
  ON public.product_intake_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin','staff','super_admin','account_executive','supplier_researcher')
    )
  );

-- Public read for token validation is done via service role in API, so no public policy needed

COMMENT ON TABLE public.product_intake_links IS 'Magic links for suppliers to self-fill product catalog after client account creation';
COMMENT ON COLUMN public.product_intake_links.token IS 'Base64url random token, single-use or multi-use until expiry';
COMMENT ON COLUMN public.product_intake_links.client_id IS 'Which client (supplier) this link belongs to';
