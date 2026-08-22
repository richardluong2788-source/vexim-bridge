-- ============================================================
-- 060: Convert Factory Image to a Multi-Image Gallery
-- Description: Replace the single factory_image_url column with
--              factory_image_urls (TEXT[]) so a profile can show
--              multiple factory photos in a carousel next to the
--              factory video. Existing single-image data is migrated
--              into the new array column automatically.
-- Date: 2026-08-22
-- ============================================================

-- 1. Add the new array column
-- ============================================================

ALTER TABLE IF EXISTS client_profiles
ADD COLUMN IF NOT EXISTS factory_image_urls TEXT[] DEFAULT '{}';

-- 2. Backfill from the old single-image column, if it exists
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_profiles' AND column_name = 'factory_image_url'
  ) THEN
    UPDATE client_profiles
    SET factory_image_urls = ARRAY[factory_image_url]
    WHERE factory_image_url IS NOT NULL
      AND (factory_image_urls IS NULL OR factory_image_urls = '{}');
  END IF;
END $$;

-- 3. Drop the old single-image column
-- ============================================================

ALTER TABLE IF EXISTS client_profiles
DROP COLUMN IF EXISTS factory_image_url;

-- 4. Add comment for the new column
-- ============================================================

COMMENT ON COLUMN client_profiles.factory_image_urls IS 'Factory photos shown as a carousel alongside the factory video on the public profile page';
