-- Migration: 024_integrate_client_products_to_opportunities.sql
-- Purpose: Link client_products with opportunities for product-specific tracking
-- Date: 2026-04-24
-- Depends on: 023_client_products_schema.sql and existing opportunities table

-- Add client_product_id column to opportunities
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS client_product_id UUID REFERENCES client_products(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_client_product_id 
  ON opportunities(client_product_id);

-- Also add it to deals for tracking what product was sold
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES client_products(id) ON DELETE SET NULL;

-- Create index for deals product lookup
CREATE INDEX IF NOT EXISTS idx_deals_product_id 
  ON deals(product_id);

-- Activity types for product-related actions
-- These will be used in server actions to log product modifications
-- action_type values: 'client_product_added', 'client_product_updated', 'client_product_deleted'
-- action_type values: 'opportunity_linked_to_product'

-- Add view for client opportunities with product details
CREATE OR REPLACE VIEW client_opportunities_with_products AS
SELECT 
  o.id,
  o.client_id,
  o.lead_id,
  o.client_product_id,
  o.stage,
  o.potential_value,
  o.target_close_date,
  o.created_at,
  o.updated_at,
  cp.product_name,
  cp.category,
  cp.subcategory,
  cp.monthly_capacity_units,
  cp.min_unit_price,
  cp.max_unit_price,
  p.company_name,
  p.email,
  p.fda_registration_number
FROM opportunities o
LEFT JOIN client_products cp ON o.client_product_id = cp.id
LEFT JOIN profiles p ON o.client_id = p.id
WHERE o.client_id IS NOT NULL;

-- Grant permissions
GRANT SELECT ON client_opportunities_with_products TO authenticated;

-- Comment for documentation
COMMENT ON COLUMN opportunities.client_product_id IS 'Reference to specific product for this opportunity (enables product-specific lead matching)';
COMMENT ON COLUMN deals.product_id IS 'Reference to specific product that was sold in this deal (for commission tracking and reporting)';
