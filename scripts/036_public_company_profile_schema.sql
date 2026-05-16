-- Migration: 036_public_company_profile_schema.sql
-- Purpose: Add public company profile fields and configuration table for Option A
-- Date: 2026-05-16
-- Depends on: 002_phase2_schema.sql (profiles table must exist)

-- Add public profile fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS company_description TEXT,
ADD COLUMN IF NOT EXISTS production_stats JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS company_video_url TEXT,
ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT FALSE;

-- Create company_public_profiles table to manage visibility and share settings
-- This allows fine-grained control over what's shared publicly
CREATE TABLE IF NOT EXISTS company_public_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Visibility settings
  is_visible BOOLEAN DEFAULT FALSE,
  show_email BOOLEAN DEFAULT FALSE,
  show_phone BOOLEAN DEFAULT FALSE,
  show_website BOOLEAN DEFAULT FALSE,
  show_factory_address BOOLEAN DEFAULT FALSE,
  
  -- Share settings
  share_token TEXT UNIQUE,
  share_token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Analytics
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_public_profiles_company_id 
  ON company_public_profiles(company_id);

CREATE INDEX IF NOT EXISTS idx_company_public_profiles_is_visible 
  ON company_public_profiles(is_visible);

CREATE INDEX IF NOT EXISTS idx_company_public_profiles_share_token 
  ON company_public_profiles(share_token);

-- Enable RLS on company_public_profiles
ALTER TABLE company_public_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Public can view only visible profiles (for share token pages)
DROP POLICY IF EXISTS "public_can_view_visible_profiles" ON company_public_profiles;
CREATE POLICY "public_can_view_visible_profiles"
  ON company_public_profiles
  FOR SELECT
  USING (is_visible = TRUE OR share_token IS NOT NULL);

-- 2. Authenticated clients can view/update their own profile
DROP POLICY IF EXISTS "clients_can_manage_own_profile" ON company_public_profiles;
CREATE POLICY "clients_can_manage_own_profile"
  ON company_public_profiles
  FOR ALL
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- 3. Admin can view/update any profile
DROP POLICY IF EXISTS "admin_can_manage_profiles" ON company_public_profiles;
CREATE POLICY "admin_can_manage_profiles"
  ON company_public_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Add RLS policies for profiles table to allow public viewing of certain fields
-- when is_public_profile = true
DROP POLICY IF EXISTS "public_can_view_public_profiles" ON profiles;
CREATE POLICY "public_can_view_public_profiles"
  ON profiles
  FOR SELECT
  USING (is_public_profile = TRUE);
