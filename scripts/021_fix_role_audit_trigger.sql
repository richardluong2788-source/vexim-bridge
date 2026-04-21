-- ============================================================
-- Migration 021: Fix profiles_role_change_audit trigger
-- ============================================================
-- Migration 020 created the audit trigger using an invented
-- `activities` schema (entity_type / entity_id / user_id /
-- metadata). The real activities table only has:
--   id, opportunity_id, action_type, description,
--   performed_by, created_at
-- Any UPDATE on profiles.role therefore failed with:
--   column "entity_type" of relation "activities" does not exist
--
-- This migration drops the broken function + trigger and
-- recreates them against the real schema. Idempotent.
-- ============================================================

-- Drop trigger first so no concurrent UPDATE can fire the bad fn.
DROP TRIGGER IF EXISTS profiles_role_change_audit ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_role_change_audit();

DO $$
BEGIN
  IF to_regclass('public.activities') IS NULL THEN
    RAISE NOTICE 'Skipping profiles_role_change_audit: activities table missing.';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.profiles_role_change_audit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    actor UUID := auth.uid();
  BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      -- activities has no dedicated "user" FK, so we encode the
      -- target user + role transition into description. The row
      -- is still immutable thanks to the WORM trigger from 013.
      INSERT INTO public.activities (
        opportunity_id,
        action_type,
        description,
        performed_by
      ) VALUES (
        NULL,
        'role_changed',
        format(
          'Role changed for %s (%s): %s -> %s',
          COALESCE(NEW.full_name, NEW.email, NEW.id::text),
          COALESCE(NEW.email, NEW.id::text),
          COALESCE(OLD.role, 'null'),
          COALESCE(NEW.role, 'null')
        ),
        actor
      );
    END IF;
    RETURN NEW;
  END;
  $fn$;

  CREATE TRIGGER profiles_role_change_audit
    AFTER UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_role_change_audit();
END$$;

NOTIFY pgrst, 'reload schema';
