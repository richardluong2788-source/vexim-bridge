-- =====================================================================
-- Migration 020: RBAC — 5-role system for Vexim Bridge
-- =====================================================================
-- Expands the profiles.role CHECK constraint to allow all 5 production
-- roles defined in the RBAC policy doc (21/04/2026):
--
--   1. super_admin       — Founder / system owner
--   2. admin             — Operations lead (you)
--   3. account_executive — Sales rep handling buyers
--   4. lead_researcher   — Researcher sourcing buyers
--   5. finance           — Accountant / bookkeeper
--   + client             — External portal user (not counted as RBAC)
--
-- Legacy role "staff" remains valid in the CHECK constraint for backward
-- compatibility, but the application layer treats it as account_executive
-- going forward. New user creation should never assign "staff".
--
-- Primary enforcement lives in the application layer via the capability
-- map in lib/auth/permissions.ts (service-role adminClient is used for
-- most writes). RLS stays as defense-in-depth.
--
-- NOTE: RLS policies on finance tables are wrapped in existence checks
-- (to_regclass) so this migration can run safely on environments where
-- script 016_finance_schema.sql has not yet been applied. When finance
-- tables are created later, re-run this migration OR run a dedicated
-- follow-up migration to add the policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Expand profiles.role CHECK constraint
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'super_admin',
    'admin',
    'account_executive',
    'lead_researcher',
    'finance',
    'client',
    -- Legacy — kept to avoid breaking old rows; new users must NOT use this.
    'staff'
  ));

COMMENT ON COLUMN public.profiles.role IS
  'RBAC role. Canonical values: super_admin, admin, account_executive, lead_researcher, finance, client. Legacy "staff" is kept for backward compatibility but mapped to account_executive in the app layer.';

-- ---------------------------------------------------------------------
-- 2. Finance role RLS: allow read on finance tables (defense-in-depth).
--    Each policy is guarded with to_regclass() so missing tables are
--    skipped rather than causing the whole migration to fail.
-- ---------------------------------------------------------------------

-- invoices
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS invoices_finance_select ON public.invoices';
    EXECUTE $policy$
      CREATE POLICY invoices_finance_select ON public.invoices
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'finance'
          )
        )
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping invoices_finance_select: table public.invoices does not exist yet.';
  END IF;
END$$;

-- operating_expenses
DO $$
BEGIN
  IF to_regclass('public.operating_expenses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS operating_expenses_finance_select ON public.operating_expenses';
    EXECUTE $policy$
      CREATE POLICY operating_expenses_finance_select ON public.operating_expenses
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'finance'
          )
        )
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping operating_expenses_finance_select: table public.operating_expenses does not exist yet.';
  END IF;
END$$;

-- billing_plans
DO $$
BEGIN
  IF to_regclass('public.billing_plans') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS billing_plans_finance_select ON public.billing_plans';
    EXECUTE $policy$
      CREATE POLICY billing_plans_finance_select ON public.billing_plans
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'finance'
          )
        )
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping billing_plans_finance_select: table public.billing_plans does not exist yet.';
  END IF;
END$$;

-- finance_settings
DO $$
BEGIN
  IF to_regclass('public.finance_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS finance_settings_finance_select ON public.finance_settings';
    EXECUTE $policy$
      CREATE POLICY finance_settings_finance_select ON public.finance_settings
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'finance'
          )
        )
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping finance_settings_finance_select: table public.finance_settings does not exist yet.';
  END IF;
END$$;

-- retainer_credits
DO $$
BEGIN
  IF to_regclass('public.retainer_credits') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS retainer_credits_finance_select ON public.retainer_credits';
    EXECUTE $policy$
      CREATE POLICY retainer_credits_finance_select ON public.retainer_credits
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'finance'
          )
        )
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping retainer_credits_finance_select: table public.retainer_credits does not exist yet.';
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- 3. Audit helper: record role changes in the immutable activities log.
--    Triggered whenever a profile's role is updated.
--    Guarded with to_regclass() in case the activities table is missing.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.activities') IS NULL THEN
    RAISE NOTICE 'Skipping profiles_role_change_audit trigger: table public.activities does not exist.';
    RETURN;
  END IF;

  -- NB: the real `activities` table schema is
  --   (id, opportunity_id, action_type, description,
  --    performed_by, created_at).
  -- We encode the role transition into description because there
  -- is no dedicated user FK. Rows are still WORM thanks to 013.
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

  EXECUTE 'DROP TRIGGER IF EXISTS profiles_role_change_audit ON public.profiles';
  EXECUTE 'CREATE TRIGGER profiles_role_change_audit
             AFTER UPDATE OF role ON public.profiles
             FOR EACH ROW
             EXECUTE FUNCTION public.profiles_role_change_audit()';
END$$;

NOTIFY pgrst, 'reload schema';
