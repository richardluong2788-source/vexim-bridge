-- Migration: 047_fix_ae_client_products_view.sql
-- Purpose: Fix two gaps in the AE matching engine (lib/matching/scorer.ts)
--   1. calculateCountryMatch() reads `client.client_country`, but the
--      `ae_client_products` view never selected the client's country —
--      so country match was always neutral (40/50) for every AE.
--   2. calculateHSCodeMatch() mines HS-code-shaped digit sequences out of
--      free-text `category` strings via regex. client_products already has
--      a real `hs_code` column that was never aggregated into this view,
--      so real HS data was silently ignored in favor of a regex guess.
-- Date: 2026-08-18
-- Depends on: 002_phase2_schema.sql (profiles.country — see 007), 023_client_products_schema.sql (hs_code), 035_ai_matching_schema.sql (view)

CREATE OR REPLACE VIEW public.ae_client_products AS
SELECT
  p.account_manager_id,
  p.id AS client_id,
  p.company_name AS client_name,
  p.industry AS client_industry,
  p.industries AS client_industries,
  p.country AS client_country,
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
  ) AS product_subcategories,
  COALESCE(
    ARRAY_AGG(DISTINCT cp.hs_code) FILTER (WHERE cp.hs_code IS NOT NULL AND cp.hs_code <> ''),
    ARRAY[]::TEXT[]
  ) AS product_hs_codes
FROM public.profiles p
LEFT JOIN public.client_products cp ON p.id = cp.client_id
WHERE p.role = 'client'
  AND p.account_manager_id IS NOT NULL
GROUP BY p.id, p.account_manager_id, p.company_name, p.industry, p.industries, p.country, p.fda_expires_at;

-- ============================================================
-- DONE
-- ============================================================
-- After running this migration:
--   1. Verify the new columns exist:
--      SELECT client_country, product_hs_codes FROM public.ae_client_products LIMIT 5;
--   2. lib/supabase/types.ts AEClientProducts and lib/matching/scorer.ts
--      (calculateHSCodeMatch) were updated in the same change to consume
--      product_hs_codes instead of regex-mining product_categories.
-- ============================================================
