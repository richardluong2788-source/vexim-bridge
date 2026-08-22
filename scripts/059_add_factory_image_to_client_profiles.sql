-- ============================================================
-- 059: Add Factory Image Column to Client Profiles
-- Description: Add a factory photo URL so the public profile page can
--              show a factory image next to the factory video.
-- Date: 2026-08-22
-- ============================================================

-- 1. Add factory_image_url column to client_profiles table
-- ============================================================

ALTER TABLE IF EXISTS client_profiles
ADD COLUMN IF NOT EXISTS factory_image_url TEXT;

-- 2. Add comment for the new column
-- ============================================================

COMMENT ON COLUMN client_profiles.factory_image_url IS 'Factory photo shown alongside the factory video on the public profile page';
