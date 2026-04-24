-- ============================================================
-- ESH (Export Sales Hub) - Phase 3 Schema Migration
-- Migration 003: Client Products Catalog
-- Date: 2026-04-24
-- ============================================================
-- This migration is IDEMPOTENT — safe to run multiple times.
-- It adds a complete product management system for clients.
-- ============================================================


-- ============================================================
-- 1. CLIENT_PRODUCTS: Main products catalog per client
-- Each client can manage their own product list
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Product identification
  product_name TEXT NOT NULL,                     -- "Cà phê Arabica Grade A"
  product_code TEXT,                             -- "ARB-A-001" (internal code)
  hs_code TEXT,                                  -- "0901.11.0000" (Harmonized System Code)
  
  -- Categorization
  category TEXT NOT NULL,                        -- "coffee", "cacao", "spice", etc.
  subcategory TEXT,                              -- "arabica", "robusta", etc.
  origin_country TEXT,                           -- "Vietnam", "Indonesia"
  
  -- Description & Details
  description TEXT,                              -- Full product description
  specifications JSONB DEFAULT '{}'::jsonb,     -- Flexible: moisture%, bean size, roast level, etc.
  
  -- Pricing & Units
  unit_of_measure TEXT DEFAULT 'kg',             -- "kg", "ton", "liter", "boxes", etc.
  min_unit_price DECIMAL(12, 4) DEFAULT 0,      -- Minimum price per unit (USD)
  max_unit_price DECIMAL(12, 4) DEFAULT 0,      -- Maximum price per unit (USD)
  currency_code TEXT DEFAULT 'USD',              -- Currency code
  price_notes TEXT,                              -- "Bulk discount available", "Price negotiable"
  
  -- Supply & Capacity
  monthly_capacity_units INT,                    -- 500 (in unit_of_measure)
  capacity_notes TEXT,                           -- "Seasonal availability", "Max 2 shipments/month"
  minimum_order_units INT DEFAULT 1,             -- Minimum order quantity
  lead_time_days INT,                            -- Days to deliver after order
  
  -- Compliance & Certifications
  certifications JSONB DEFAULT '[]'::jsonb,      -- ["FSSC22000", "UTZ", "Organic"]
  compliance_docs_ids UUID[] DEFAULT '{}',       -- References to compliance_docs table
  
  -- Status & Metadata
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'discontinued', 'draft')),
  
  image_url TEXT,                                -- Product image (Vercel Blob URL)
  
  -- Auditing
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(client_id, product_code),               -- Unique product code per client
  UNIQUE(client_id, product_name)                -- Unique product name per client
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_products_client_id 
  ON public.client_products(client_id);
CREATE INDEX IF NOT EXISTS idx_client_products_category 
  ON public.client_products(category);
CREATE INDEX IF NOT EXISTS idx_client_products_subcategory 
  ON public.client_products(subcategory);
CREATE INDEX IF NOT EXISTS idx_client_products_status 
  ON public.client_products(status);
CREATE INDEX IF NOT EXISTS idx_client_products_origin_country 
  ON public.client_products(origin_country);
CREATE INDEX IF NOT EXISTS idx_client_products_created_at 
  ON public.client_products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_products_hs_code 
  ON public.client_products(hs_code);

-- GIN index for flexible JSON specifications & certifications
CREATE INDEX IF NOT EXISTS idx_client_products_specs_gin
  ON public.client_products USING GIN(specifications);
CREATE INDEX IF NOT EXISTS idx_client_products_certs_gin
  ON public.client_products USING GIN(certifications);

-- Enable RLS
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy 1: Clients can view & edit their own products
CREATE POLICY "Clients can view and edit own products"
  ON public.client_products FOR ALL
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

-- Policy 2: Allow inserts for clients adding their own products
CREATE POLICY "Clients can insert own products"
  ON public.client_products FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

-- Policy 3: Allow updates for clients modifying their own products
CREATE POLICY "Clients can update own products"
  ON public.client_products FOR UPDATE
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  )
  WITH CHECK (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

-- Policy 4: Allow deletes for clients deleting their own products
CREATE POLICY "Clients can delete own products"
  ON public.client_products FOR DELETE
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );


-- ============================================================
-- 2. AUTO-UPDATE TRIGGER for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_client_products_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_products_updated ON public.client_products;
CREATE TRIGGER on_client_products_updated
  BEFORE UPDATE ON public.client_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_client_products_updated();


-- ============================================================
-- 3. OPPORTUNITIES: Add product reference column
-- Link opportunities directly to specific client products
-- ============================================================
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS client_product_id UUID 
    REFERENCES public.client_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_client_product_id 
  ON public.opportunities(client_product_id);


-- ============================================================
-- 4. AUDIT LOG: Track all product changes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_products_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_product_id UUID NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL
    CHECK (action IN ('created', 'updated', 'deleted', 'status_changed')),
  
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Store what changed (JSON diff)
  old_values JSONB,
  new_values JSONB,
  
  notes TEXT,
  
  INDEX_CREATED_AT_DESC TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_audit_log_product_id 
  ON public.client_products_audit_log(client_product_id);
CREATE INDEX IF NOT EXISTS idx_products_audit_log_changed_at 
  ON public.client_products_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_audit_log_changed_by 
  ON public.client_products_audit_log(changed_by);

ALTER TABLE public.client_products_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins view all product audit logs"
  ON public.client_products_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff', 'super_admin')
    )
  );

-- Clients can view audit logs for their own products
CREATE POLICY "Clients view own product audit logs"
  ON public.client_products_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_products cp
      WHERE cp.id = client_products_audit_log.client_product_id
      AND cp.client_id = auth.uid()
    )
  );


-- ============================================================
-- 5. MATERIALIZED VIEW: Active Products Summary (for fast search)
-- Useful for admin dashboard & buyer portal
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.active_products_view AS
SELECT
  cp.id,
  cp.client_id,
  p.company_name,
  p.industry,
  cp.product_name,
  cp.product_code,
  cp.category,
  cp.subcategory,
  cp.origin_country,
  cp.unit_of_measure,
  cp.min_unit_price,
  cp.max_unit_price,
  cp.monthly_capacity_units,
  cp.lead_time_days,
  cp.certifications,
  cp.status,
  cp.created_at,
  cp.updated_at
FROM public.client_products cp
JOIN public.profiles p ON cp.client_id = p.id
WHERE cp.status = 'active' AND p.role = 'client'
ORDER BY cp.created_at DESC;

-- Create index on materialized view for faster queries
CREATE INDEX IF NOT EXISTS idx_active_products_view_client_id 
  ON public.active_products_view(client_id);
CREATE INDEX IF NOT EXISTS idx_active_products_view_category 
  ON public.active_products_view(category);


-- ============================================================
-- 6. FUNCTION: Search products by criteria
-- Used by admin & buyer portals for product discovery
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_client_products(
  p_category TEXT DEFAULT NULL,
  p_subcategory TEXT DEFAULT NULL,
  p_origin_country TEXT DEFAULT NULL,
  p_min_capacity INT DEFAULT NULL,
  p_max_price DECIMAL DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  product_id UUID,
  client_id UUID,
  company_name TEXT,
  product_name TEXT,
  product_code TEXT,
  category TEXT,
  subcategory TEXT,
  origin_country TEXT,
  unit_of_measure TEXT,
  min_unit_price DECIMAL,
  max_unit_price DECIMAL,
  monthly_capacity_units INT,
  lead_time_days INT,
  match_score FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    cp.id,
    cp.client_id,
    p.company_name,
    cp.product_name,
    cp.product_code,
    cp.category,
    cp.subcategory,
    cp.origin_country,
    cp.unit_of_measure,
    cp.min_unit_price,
    cp.max_unit_price,
    cp.monthly_capacity_units,
    cp.lead_time_days,
    -- Relevance scoring (for ranking results)
    CASE
      WHEN p_search_text IS NOT NULL AND cp.product_name ILIKE '%' || p_search_text || '%'
        THEN 2.0
      WHEN p_search_text IS NOT NULL AND cp.description ILIKE '%' || p_search_text || '%'
        THEN 1.0
      ELSE 0.5
    END::float AS match_score
  FROM public.client_products cp
  JOIN public.profiles p ON cp.client_id = p.id
  WHERE
    cp.status = 'active'
    AND p.role = 'client'
    -- Category filter
    AND (p_category IS NULL OR cp.category = p_category)
    -- Subcategory filter
    AND (p_subcategory IS NULL OR cp.subcategory = p_subcategory)
    -- Origin filter
    AND (p_origin_country IS NULL OR cp.origin_country = p_origin_country)
    -- Capacity filter
    AND (p_min_capacity IS NULL OR cp.monthly_capacity_units >= p_min_capacity)
    -- Price filter
    AND (p_max_price IS NULL OR cp.min_unit_price <= p_max_price)
    -- Text search
    AND (p_search_text IS NULL 
      OR cp.product_name ILIKE '%' || p_search_text || '%'
      OR cp.product_code = p_search_text
      OR cp.description ILIKE '%' || p_search_text || '%'
    )
  ORDER BY match_score DESC, cp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;


-- ============================================================
-- VERIFICATION & DONE
-- ============================================================
-- After running this migration, verify:
--   1. Table exists: SELECT COUNT(*) FROM information_schema.tables 
--                   WHERE table_name = 'client_products';
--   2. RLS enabled: SELECT COUNT(*) FROM pg_policies 
--                   WHERE tablename = 'client_products';
--   3. Test search function:
--      SELECT * FROM search_client_products(p_category => 'coffee', p_limit => 10);
-- ============================================================
