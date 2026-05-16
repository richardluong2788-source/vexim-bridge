-- ============================================================
-- 041: Add Description Column to Client Profiles
-- Description: Add company description field for supplier profiles
-- Date: 2026-05-17
-- ============================================================

-- 1. Add description column to client_profiles table
-- ============================================================

ALTER TABLE IF EXISTS client_profiles
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Add comment for the new column
-- ============================================================

COMMENT ON COLUMN client_profiles.description IS 'Detailed company description and introduction for buyers';
