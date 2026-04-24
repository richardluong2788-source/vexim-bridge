-- Migration: 023_client_products_schema.sql
-- Purpose: Add client_products table for product discovery
-- Date: 2026-04-24
-- Depends on: 002_phase2_schema.sql (profiles table must exist)

-- Create the client_products table
CREATE TABLE IF NOT EXISTS client_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Product identification
  product_name TEXT NOT NULL,
  product_code TEXT,
  
  -- Categorization
  category TEXT, -- "coffee", "cocoa", "cashew", "pepper", etc.
  subcategory TEXT, -- "arabica", "robusta", "instant", "fermented", etc.
  
  -- Product details
  description TEXT,
  hs_code TEXT, -- Harmonized System code for customs
  unit_of_measure TEXT DEFAULT 'kg', -- "kg", "lbs", "ton", "piece", etc.
  
  -- Pricing
  min_unit_price DECIMAL(10, 2),
  max_unit_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Capacity
  monthly_capacity_units INT, -- Monthly production/supply capacity
  
  -- Status & tracking
  status TEXT CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one SKU per client
  UNIQUE(client_id, product_code)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_client_products_client_id 
  ON client_products(client_id);

CREATE INDEX IF NOT EXISTS idx_client_products_category 
  ON client_products(category);

CREATE INDEX IF NOT EXISTS idx_client_products_subcategory 
  ON client_products(subcategory);

CREATE INDEX IF NOT EXISTS idx_client_products_status 
  ON client_products(status);

CREATE INDEX IF NOT EXISTS idx_client_products_category_status 
  ON client_products(category, status);

-- Enable RLS
ALTER TABLE client_products ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Admins and staff can view and manage all products
DROP POLICY IF EXISTS "Admins manage all client products" ON client_products;
CREATE POLICY "Admins manage all client products"
  ON client_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'staff', 'super_admin')
    )
  );

-- RLS Policy 2: Clients can view and manage their own products
DROP POLICY IF EXISTS "Clients manage own products" ON client_products;
CREATE POLICY "Clients manage own products"
  ON client_products
  FOR ALL
  USING (client_id = auth.uid());

-- RLS Policy 3: Public can view active products only (for public endpoint)
DROP POLICY IF EXISTS "Public can see active products" ON client_products;
CREATE POLICY "Public can see active products"
  ON client_products
  FOR SELECT
  USING (status = 'active');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_products_updated_at_trigger ON client_products;
CREATE TRIGGER client_products_updated_at_trigger
BEFORE UPDATE ON client_products
FOR EACH ROW
EXECUTE FUNCTION update_client_products_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON client_products TO authenticated;

-- Activity logging
-- This will be handled in server actions where we insert into activities table
-- with action_type like 'client_product_added', 'client_product_updated', 'client_product_deleted'
