-- ============================================================
-- Migration 035: AI Matching Schema
-- ============================================================
-- This migration adds tables and views for the AI-powered AE matching
-- system. When Lead Researcher adds a buyer to the pool, AI scores
-- all AEs based on product match, industry match, FDA compliance,
-- workload, win-rate, and country/region match.
--
-- Hybrid assignment: top-1 score >= threshold auto-assigns,
-- otherwise placed in inbox for manual review.
-- ============================================================

-- ============================================================
-- 1. AE_MATCH_SCORES: Store calculated match scores per buyer-AE pair
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ae_match_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_score DECIMAL(5, 2) NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  -- Factor breakdown (0-100 each, stored for audit/debug)
  product_match_score DECIMAL(5, 2) DEFAULT 0,
  industry_match_score DECIMAL(5, 2) DEFAULT 0,
  fda_compliance_score DECIMAL(5, 2) DEFAULT 0,
  workload_score DECIMAL(5, 2) DEFAULT 0,
  win_rate_score DECIMAL(5, 2) DEFAULT 0,
  country_match_score DECIMAL(5, 2) DEFAULT 0,
  -- Full breakdown as JSONB for extensibility
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- How assignment was made
  assignment_source TEXT CHECK (assignment_source IN ('auto', 'manual', 'llm_augmented')) DEFAULT NULL,
  -- When the match was assigned (null = still in pool/inbox)
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  assigned_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Each AE can only have one score per lead
  UNIQUE(lead_id, account_manager_id)
);

CREATE INDEX IF NOT EXISTS idx_ae_match_scores_lead_id ON public.ae_match_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_ae_match_scores_account_manager_id ON public.ae_match_scores(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_ae_match_scores_total_score ON public.ae_match_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_ae_match_scores_assignment_source ON public.ae_match_scores(assignment_source);

ALTER TABLE public.ae_match_scores ENABLE ROW LEVEL SECURITY;

-- Admins/staff can manage all match scores
DROP POLICY IF EXISTS "Staff can manage match scores" ON public.ae_match_scores;
CREATE POLICY "Staff can manage match scores"
  ON public.ae_match_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'lead_researcher', 'account_executive')
    )
  );


-- ============================================================
-- 2. AE_MATCH_INBOX: Pending assignments for AE review
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ae_match_inbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_score_id UUID REFERENCES public.ae_match_scores(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
  -- Priority based on score tier
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  -- Rejection reason if declined
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(lead_id, account_manager_id)
);

CREATE INDEX IF NOT EXISTS idx_ae_match_inbox_ae_id ON public.ae_match_inbox(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_ae_match_inbox_status ON public.ae_match_inbox(status);
CREATE INDEX IF NOT EXISTS idx_ae_match_inbox_priority ON public.ae_match_inbox(priority);

ALTER TABLE public.ae_match_inbox ENABLE ROW LEVEL SECURITY;

-- AEs can see their own inbox items
DROP POLICY IF EXISTS "AEs can view own inbox" ON public.ae_match_inbox;
CREATE POLICY "AEs can view own inbox"
  ON public.ae_match_inbox FOR SELECT
  USING (
    account_manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'lead_researcher')
    )
  );

-- AEs can update their own inbox items (accept/reject)
DROP POLICY IF EXISTS "AEs can update own inbox" ON public.ae_match_inbox;
CREATE POLICY "AEs can update own inbox"
  ON public.ae_match_inbox FOR UPDATE
  USING (
    account_manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin')
    )
  );

-- Staff can insert inbox items
DROP POLICY IF EXISTS "Staff can insert inbox items" ON public.ae_match_inbox;
CREATE POLICY "Staff can insert inbox items"
  ON public.ae_match_inbox FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'lead_researcher')
    )
  );


-- ============================================================
-- 3. MATCHING_CONFIG: Configuration for the matching algorithm
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matching_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.matching_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage config
DROP POLICY IF EXISTS "Admins can manage matching config" ON public.matching_config;
CREATE POLICY "Admins can manage matching config"
  ON public.matching_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- Insert default configuration
INSERT INTO public.matching_config (config_key, config_value, description)
VALUES 
  ('scoring_weights', '{
    "product_match": 25,
    "industry_match": 20,
    "workload": 20,
    "win_rate": 20,
    "fda_compliance": 10,
    "country_match": 5
  }'::jsonb, 'Weight distribution for scoring factors (must sum to 100)'),
  ('thresholds', '{
    "auto_assign": 75,
    "inbox_min": 50,
    "inbox_max": 75
  }'::jsonb, 'Score thresholds for auto-assignment vs inbox'),
  ('inbox_expiry_days', '7'::jsonb, 'Days until inbox item expires')
ON CONFLICT (config_key) DO NOTHING;


-- ============================================================
-- 4. VIEWS: Helper views for scoring calculations
-- ============================================================

-- View: AE workload summary (count of in-progress opportunities)
CREATE OR REPLACE VIEW public.ae_workload_summary AS
SELECT 
  p.id AS account_manager_id,
  p.full_name,
  p.email,
  COUNT(o.id) AS in_progress_count,
  COUNT(o.id) FILTER (WHERE o.stage = 'new') AS new_count,
  COUNT(o.id) FILTER (WHERE o.stage = 'contacted') AS contacted_count,
  COUNT(o.id) FILTER (WHERE o.stage IN ('sample_requested', 'sample_sent', 'negotiation', 'price_agreed', 'production', 'shipped')) AS active_count
FROM public.profiles p
LEFT JOIN public.opportunities o ON p.id = o.account_manager_id
  AND o.stage NOT IN ('won', 'lost')
WHERE p.role = 'account_executive'
GROUP BY p.id, p.full_name, p.email;

-- View: AE win rate by industry
CREATE OR REPLACE VIEW public.ae_win_rate_by_industry AS
SELECT 
  o.account_manager_id,
  l.industry,
  COUNT(*) FILTER (WHERE o.stage = 'won') AS wins,
  COUNT(*) FILTER (WHERE o.stage = 'lost') AS losses,
  COUNT(*) AS total_closed,
  CASE 
    WHEN COUNT(*) FILTER (WHERE o.stage IN ('won', 'lost')) > 0 
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE o.stage = 'won') / 
         COUNT(*) FILTER (WHERE o.stage IN ('won', 'lost')), 2)
    ELSE 0
  END AS win_rate
FROM public.opportunities o
JOIN public.leads l ON o.lead_id = l.id
WHERE o.account_manager_id IS NOT NULL
  AND o.stage IN ('won', 'lost')
GROUP BY o.account_manager_id, l.industry;

-- View: Client products summary (for product matching)
CREATE OR REPLACE VIEW public.ae_client_products AS
SELECT 
  p.account_manager_id,
  p.id AS client_id,
  p.company_name AS client_name,
  p.industry AS client_industry,
  p.industries AS client_industries,
  p.fda_expires_at,
  CASE 
    WHEN p.fda_expires_at IS NULL THEN false
    WHEN p.fda_expires_at > NOW() THEN true
    ELSE false
  END AS fda_valid,
  COALESCE(
    ARRAY_AGG(DISTINCT cp.category) FILTER (WHERE cp.category IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS product_categories,
  COALESCE(
    ARRAY_AGG(DISTINCT cp.subcategory) FILTER (WHERE cp.subcategory IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS product_subcategories
FROM public.profiles p
LEFT JOIN public.client_products cp ON p.id = cp.client_id
WHERE p.role = 'client'
  AND p.account_manager_id IS NOT NULL
GROUP BY p.id, p.account_manager_id, p.company_name, p.industry, p.industries, p.fda_expires_at;

-- View: Buyer pool (leads not yet assigned to any client via opportunity)
CREATE OR REPLACE VIEW public.buyer_pool AS
SELECT 
  l.*,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.lead_id = l.id)
    THEN true
    ELSE false
  END AS has_opportunity,
  (
    SELECT COUNT(*) FROM public.ae_match_scores ms 
    WHERE ms.lead_id = l.id AND ms.assigned_at IS NOT NULL
  ) AS assigned_count,
  (
    SELECT MAX(ms.total_score) FROM public.ae_match_scores ms 
    WHERE ms.lead_id = l.id
  ) AS top_match_score
FROM public.leads l;


-- ============================================================
-- 5. TRIGGERS: Auto-update timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_ae_match_score_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ae_match_score_updated ON public.ae_match_scores;
CREATE TRIGGER on_ae_match_score_updated
  BEFORE UPDATE ON public.ae_match_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_ae_match_score_updated();


-- ============================================================
-- 6. FUNCTIONS: Utility functions for matching
-- ============================================================

-- Function: Calculate product overlap score between buyer and client
CREATE OR REPLACE FUNCTION public.calculate_product_overlap(
  buyer_hs_codes TEXT[],
  buyer_keywords TEXT[],
  client_categories TEXT[],
  client_subcategories TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count INTEGER := 0;
  keyword TEXT;
BEGIN
  -- Count HS code prefix matches (first 4 digits)
  IF buyer_hs_codes IS NOT NULL AND array_length(buyer_hs_codes, 1) > 0 THEN
    SELECT COUNT(*) INTO overlap_count
    FROM unnest(buyer_hs_codes) bhs
    WHERE EXISTS (
      SELECT 1 FROM unnest(client_categories) cc
      WHERE LOWER(cc) LIKE '%' || LOWER(LEFT(bhs, 4)) || '%'
    );
  END IF;
  
  -- Count keyword matches
  IF buyer_keywords IS NOT NULL AND array_length(buyer_keywords, 1) > 0 THEN
    FOREACH keyword IN ARRAY buyer_keywords LOOP
      IF EXISTS (
        SELECT 1 FROM unnest(client_categories || client_subcategories) cat
        WHERE LOWER(cat) LIKE '%' || LOWER(keyword) || '%'
           OR LOWER(keyword) LIKE '%' || LOWER(cat) || '%'
      ) THEN
        overlap_count := overlap_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Normalize to 0-100 scale (max 10 matches = 100)
  RETURN LEAST(overlap_count * 10, 100);
END;
$$;


-- ============================================================
-- DONE
-- ============================================================
-- After running this migration:
--   1. Verify tables: \dt public.ae_*
--   2. Check views: \dv public.ae_* public.buyer_pool
--   3. Verify config: SELECT * FROM matching_config;
-- ============================================================
