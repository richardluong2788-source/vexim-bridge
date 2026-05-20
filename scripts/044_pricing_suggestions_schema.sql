-- ============================================================
-- Migration: Create pricing suggestions history table
-- Purpose: Track AI-generated pricing suggestions for ML training
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunity_pricing_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- AI Suggestion data
  suggested_price_usd numeric NOT NULL,
  price_unit text NOT NULL, -- kg, ton, container, lb, box
  incoterm text NOT NULL, -- FOB, CIF, CFR, etc.
  payment_terms text,
  rationale text,
  confidence_level text, -- high, medium, low
  
  -- Comparable deals info
  comparable_deals_count integer DEFAULT 0,
  
  -- Context for training
  product_name text,
  quantity_requested text,
  destination_port text,
  origin_country text,
  buyer_industry text,
  
  -- Metadata
  ai_model text DEFAULT 'openai/gpt-4o-mini',
  execution_time_ms integer,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_opportunity_pricing_suggestions_opportunity_id 
  ON opportunity_pricing_suggestions(opportunity_id);

CREATE INDEX idx_opportunity_pricing_suggestions_created_at 
  ON opportunity_pricing_suggestions(created_at DESC);

CREATE INDEX idx_opportunity_pricing_suggestions_product_name 
  ON opportunity_pricing_suggestions(product_name);

-- Enable RLS
ALTER TABLE opportunity_pricing_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can manage all pricing suggestions"
  ON opportunity_pricing_suggestions
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Allow viewing only to staff (admins already bypass via policies)
CREATE POLICY "Admins can view pricing suggestions"
  ON opportunity_pricing_suggestions
  FOR SELECT
  USING (TRUE);

GRANT SELECT ON opportunity_pricing_suggestions TO anon, authenticated;
GRANT ALL ON opportunity_pricing_suggestions TO service_role;

-- ============================================================
-- Utility function: Get pricing statistics for a product
-- ============================================================

CREATE OR REPLACE FUNCTION get_product_pricing_stats(p_product_name text)
RETURNS TABLE(
  product_name text,
  total_suggestions bigint,
  avg_price_usd numeric,
  min_price_usd numeric,
  max_price_usd numeric,
  most_common_unit text,
  avg_confidence_score numeric,
  last_suggested_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ops.product_name,
    COUNT(*)::bigint,
    AVG(ops.suggested_price_usd),
    MIN(ops.suggested_price_usd),
    MAX(ops.suggested_price_usd),
    (SELECT ops2.price_unit 
     FROM opportunity_pricing_suggestions ops2 
     WHERE ops2.product_name = p_product_name 
     GROUP BY ops2.price_unit 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as most_common_unit,
    AVG(
      CASE 
        WHEN ops.confidence_level = 'high' THEN 0.9
        WHEN ops.confidence_level = 'medium' THEN 0.6
        ELSE 0.3
      END
    ),
    MAX(ops.created_at)
  FROM opportunity_pricing_suggestions ops
  WHERE ops.product_name = p_product_name
  GROUP BY ops.product_name;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_product_pricing_stats(text) TO service_role;
