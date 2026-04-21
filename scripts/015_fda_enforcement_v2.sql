-- ============================================================
-- Migration 015 - FDA enforcement, parser-safe rewrite
-- ============================================================
-- Supersedes 014. Two fixes:
--
--   1. Uses the standard $$ dollar-quote delimiter instead of $fn$.
--      Some SQL runners (including v0's Supabase proxy) only tokenize
--      $$ as a dollar quote. With $fn$ they fall back to splitting the
--      function body on ";" and then try to execute fragments of the
--      RAISE EXCEPTION strings as real SQL, producing errors like
--      "relation \"active\" does not exist".
--
--   2. RAISE EXCEPTION messages no longer contain English words that
--      happen to look like bare identifiers (e.g. "active"). Only
--      short, unambiguous tokens are used.
--
-- Idempotent; safe to re-run.
-- ============================================================


-- 1. Ensure the column exists (014 may or may not have landed).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fda_expires_at DATE;

CREATE INDEX IF NOT EXISTS profiles_fda_expires_at_idx
  ON public.profiles (fda_expires_at);


-- 2. Clean up any prior attempts so the new definitions own the names.
DROP TRIGGER IF EXISTS enforce_fda_on_opportunity_insert ON public.opportunities;
DROP TRIGGER IF EXISTS enforce_fda_on_opportunity_stage  ON public.opportunities;
DROP FUNCTION IF EXISTS public.enforce_fda_for_opportunity();


-- 3. Recreate the enforcement function with the standard $$ delimiter
--    and minimal RAISE EXCEPTION payloads.
CREATE OR REPLACE FUNCTION public.enforce_fda_for_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS NULL OR NEW.stage IN ('new', 'contacted') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND fda_registration_number IS NOT NULL
      AND length(btrim(fda_registration_number)) > 0
  ) THEN
    RAISE EXCEPTION 'FDA_REQUIRED: client has no FDA number on file'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND fda_expires_at IS NOT NULL
      AND fda_expires_at < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'FDA_EXPIRED: client FDA registration has expired'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


-- 4. Re-attach the triggers.
CREATE TRIGGER enforce_fda_on_opportunity_insert
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fda_for_opportunity();

CREATE TRIGGER enforce_fda_on_opportunity_stage
  BEFORE UPDATE OF stage ON public.opportunities
  FOR EACH ROW
  WHEN (NEW.stage IS DISTINCT FROM OLD.stage)
  EXECUTE FUNCTION public.enforce_fda_for_opportunity();


-- ------------------------------------------------------------
-- Verify:
--   SELECT tgname FROM pg_trigger
--     WHERE tgrelid = 'public.opportunities'::regclass
--       AND tgname LIKE 'enforce_fda%';
-- ------------------------------------------------------------
