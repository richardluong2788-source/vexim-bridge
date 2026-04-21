-- ============================================================
-- Vexim Bridge - Migration 018
-- profiles.industries TEXT[] — multi-industry support
-- ============================================================
-- Rationale: Vietnamese exporters often operate across several
-- industries (e.g. Seafood + Food & Beverage, or Textiles +
-- Footwear). The single `industry` column forced admins to pick
-- one, which in turn limited AI personalization and reporting.
--
-- This migration adds a plural `industries` array column and
-- keeps the singular `industry` column as the "primary" industry
-- (= industries[1]) via a trigger so every existing consumer
-- (display, filters, AI prompts) keeps working unchanged.
-- ============================================================

-- 1. Add the new array column (empty array by default, NOT NULL
--    so downstream SELECTs never have to null-check it).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS industries TEXT[] NOT NULL DEFAULT '{}';

-- 2. Backfill existing rows: lift the scalar `industry` into the
--    array. Only touches rows where the array is still empty so
--    re-running this migration is safe.
UPDATE public.profiles
SET industries = ARRAY[industry]
WHERE industry IS NOT NULL
  AND industry <> ''
  AND (industries IS NULL OR array_length(industries, 1) IS NULL);

-- 3. Trigger that keeps `industry` (singular, primary) in sync
--    with `industries` (plural). Rules:
--      - If `industries` is non-empty → industry = industries[1]
--      - If `industries` is empty but `industry` is set → lift
--        industry into industries (so admins editing legacy rows
--        via the old path still populate the array).
CREATE OR REPLACE FUNCTION public.profiles_sync_primary_industry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.industries IS NOT NULL AND array_length(NEW.industries, 1) >= 1 THEN
    NEW.industry := NEW.industries[1];
  ELSIF NEW.industry IS NOT NULL AND NEW.industry <> '' THEN
    NEW.industries := ARRAY[NEW.industry];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_primary_industry ON public.profiles;
CREATE TRIGGER profiles_sync_primary_industry
  BEFORE INSERT OR UPDATE OF industry, industries ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_sync_primary_industry();

-- 4. GIN index so "clients that work in X" filters stay fast even
--    once a few hundred clients each tagged with 3-5 industries.
CREATE INDEX IF NOT EXISTS idx_profiles_industries_gin
  ON public.profiles USING GIN (industries);

COMMENT ON COLUMN public.profiles.industries IS
  'All industries the client operates in. industries[1] is mirrored to the legacy `industry` column by trigger for backward compatibility.';
