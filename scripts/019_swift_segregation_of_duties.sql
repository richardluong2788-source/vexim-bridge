-- =============================================================================
-- Migration 019 — Swift verification: Segregation of Duties (SoD) enforcement
-- =============================================================================
-- Fixes audit finding R-05 (HIGH): same admin could upload and verify a Swift
-- wire transfer copy, enabling self-dealing fraud (e.g. Pakistan 16B case).
--
-- Defence-in-depth (4 layers):
--   (A) Schema: record who uploaded the Swift doc and when.
--   (B) Data integrity: CHECK constraint blocks self-verify at row level.
--   (C) Trigger: re-uploading Swift auto-resets verification state so the
--       uploader cannot bypass SoD by editing a pre-verified deal.
--   (D) Application code enforces the same rule for better UX error messages.
-- =============================================================================

-- (A) Provenance columns — who uploaded the Swift scan, and when.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS swift_uploaded_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS swift_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.deals.swift_uploaded_by IS
  'Profile ID of the admin who uploaded the Swift wire copy. Segregation of Duties: this user MUST NOT be the same as swift_verified_by.';
COMMENT ON COLUMN public.deals.swift_uploaded_at IS
  'Timestamp when the Swift doc was uploaded. Used for audit trail and SoD enforcement.';

-- Backfill: for existing deals where a Swift doc already exists but we
-- don't know who uploaded it, fall back to the deal creator. This keeps
-- the SoD constraint satisfiable for legacy data (verifier must still be
-- different from whoever is now recorded as uploader).
UPDATE public.deals
SET swift_uploaded_by = COALESCE(swift_uploaded_by, created_by),
    swift_uploaded_at = COALESCE(swift_uploaded_at, updated_at, created_at)
WHERE swift_doc_url IS NOT NULL
  AND swift_uploaded_by IS NULL;

-- (B) Row-level CHECK constraint. If the deal has been verified, the
-- verifier MUST be a different profile than the uploader. NULLs bypass
-- the check so unverified rows are unaffected.
ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_swift_sod_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_swift_sod_check
  CHECK (
    swift_verified = FALSE
    OR swift_verified_by IS NULL
    OR swift_uploaded_by IS NULL
    OR swift_verified_by <> swift_uploaded_by
  );

-- (C) Trigger: if the Swift URL changes, reset verification so the new
-- uploader can't inherit a previous admin's verification approval.
CREATE OR REPLACE FUNCTION public.deals_swift_reupload_resets_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only interested in actual content changes, not NULL -> same NULL.
  IF NEW.swift_doc_url IS DISTINCT FROM OLD.swift_doc_url THEN
    NEW.swift_verified := FALSE;
    NEW.swift_verified_at := NULL;
    NEW.swift_verified_by := NULL;
    -- NOTE: we do NOT clear swift_uploaded_by here — the application
    -- layer sets it to the current user in the same UPDATE statement.
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_swift_reupload_resets_verification ON public.deals;
CREATE TRIGGER deals_swift_reupload_resets_verification
  BEFORE UPDATE OF swift_doc_url ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_swift_reupload_resets_verification();

-- Refresh PostgREST schema cache so Supabase client sees the new columns.
NOTIFY pgrst, 'reload schema';
