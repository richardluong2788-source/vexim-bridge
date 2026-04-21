-- ============================================================
-- Migration 014 — SUPERSEDED by 015_fda_enforcement_v2.sql
-- ============================================================
-- DO NOT RUN THIS FILE. Kept only for audit history.
-- 014 used the $fn$ dollar-quote delimiter which the v0/Supabase SQL
-- runner does not tokenize correctly, causing it to split the function
-- body and misinterpret the word "active" inside a RAISE EXCEPTION
-- string as a table name. Migration 015 rewrites the same logic with
-- the standard $$ delimiter and short error codes.
--
-- Historical note on 014's intent:
--
--   1. The original trigger function queried profiles.fda_expires_at,
--      but no prior migration ever added that column. It lived only
--      in TypeScript typings. Reading it via PL/pgSQL SELECT INTO
--      therefore failed at runtime.
--
--   2. The CREATE FUNCTION body in 013 used SELECT ... INTO v_fda_number
--      which some SQL runners that split scripts on ";" misinterpret
--      when they do not respect dollar-quoted ($$...$$) function bodies.
--      We rewrite the function to use EXISTS subqueries instead, which
--      never declares local variables and is therefore parser-proof.
--
-- This migration is idempotent; safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Add the missing column so the trigger has something to read.
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fda_expires_at DATE;

COMMENT ON COLUMN public.profiles.fda_expires_at IS
  'FDA registration expiry date. Compared against CURRENT_DATE inside '
  'the enforce_fda_for_opportunity trigger. NULL = unknown (treated as '
  'valid so pre-existing clients are not locked out until the admin '
  'updates them).';

-- Keep a lightweight index so the trigger''s EXISTS subquery stays fast
-- even when the profiles table grows.
CREATE INDEX IF NOT EXISTS profiles_fda_expires_at_idx
  ON public.profiles (fda_expires_at);


-- ------------------------------------------------------------
-- 2. Drop the old function + triggers from 013 (if they landed) so the
--    replacement can own the name cleanly.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS enforce_fda_on_opportunity_insert ON public.opportunities;
DROP TRIGGER IF EXISTS enforce_fda_on_opportunity_stage  ON public.opportunities;
DROP FUNCTION IF EXISTS public.enforce_fda_for_opportunity();


-- ------------------------------------------------------------
-- 3. Recreate the enforcement function with the EXISTS pattern.
--    No local variables, no SELECT INTO, all RAISE EXCEPTION strings
--    are single-line — maximum portability across SQL runners.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_fda_for_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Research / outreach stages are allowed without FDA. The block
  -- kicks in the moment the sales team tries to advance into an
  -- active compliance-required stage.
  IF NEW.stage IS NULL OR NEW.stage IN ('new', 'contacted') THEN
    RETURN NEW;
  END IF;

  -- (a) Missing FDA number.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND fda_registration_number IS NOT NULL
      AND length(btrim(fda_registration_number)) > 0
  ) THEN
    RAISE EXCEPTION 'FDA registration is required before assigning buyer opportunities to this client. Upload the FDA number in the client profile first (stage=%).', NEW.stage
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) FDA present but expired.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND fda_expires_at IS NOT NULL
      AND fda_expires_at < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'FDA registration for this client has expired. Ask them to renew before creating or advancing opportunities into active pipeline stages (stage=%).', NEW.stage
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.enforce_fda_for_opportunity() IS
  'R-02 hard block: refuses to INSERT an opportunity or advance its '
  'stage when the owning client has a missing or expired FDA number. '
  'Defence-in-depth for the AddLeadForm UI check.';


-- ------------------------------------------------------------
-- 4. Re-attach the triggers.
-- ------------------------------------------------------------
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
-- Quick verification queries (run manually if you like):
--
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='profiles'
--       AND column_name='fda_expires_at';
--
--   SELECT tgname FROM pg_trigger
--     WHERE tgrelid = 'public.opportunities'::regclass
--       AND tgname LIKE 'enforce_fda%';
-- ------------------------------------------------------------
