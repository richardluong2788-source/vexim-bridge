-- ============================================================
-- Migration 017: Add phone + fda_expires_at to profiles
-- ============================================================
-- Context:
--   app/admin/clients/new/actions.ts upserts profiles with
--   `phone` and `fda_expires_at`, but 001_create_schema.sql
--   never declared those columns. PostgREST's schema cache
--   therefore rejects the write with:
--     "Could not find the 'phone' column of 'profiles'"
--
--   This migration is idempotent (IF NOT EXISTS) so it is safe
--   to re-run on environments that were patched manually.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS fda_expires_at  DATE;

COMMENT ON COLUMN public.profiles.phone
  IS 'Optional contact phone for the client account. Free-form string; no validation at DB level.';

COMMENT ON COLUMN public.profiles.fda_expires_at
  IS 'Expiry date of the client''s FDA registration. NULL = unknown / not provided yet.';

-- Partial index: only profiles that actually have an FDA expiry,
-- so the "expiring soon" admin dashboard query stays cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_fda_expires_at
  ON public.profiles (fda_expires_at)
  WHERE fda_expires_at IS NOT NULL;

-- Force PostgREST (Supabase API) to reload the schema cache so the
-- new columns become visible to the REST layer immediately without
-- needing a project restart.
NOTIFY pgrst, 'reload schema';
