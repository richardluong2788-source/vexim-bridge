-- Migration: 029_product_images_compliance.sql
-- Purpose: Add image_urls array and compliance_badges array to client_products
-- Date: 2026-05-17

ALTER TABLE client_products
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_badges TEXT[] DEFAULT '{}';

COMMENT ON COLUMN client_products.image_urls IS 'Array of public Blob URLs for product images';
COMMENT ON COLUMN client_products.compliance_badges IS 'Array of compliance labels shown as badges: fda, coa, organic, fsvp';
