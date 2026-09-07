-- ============================================================================
-- Migration 075: convert legacy `staff` → `account_executive`
-- ============================================================================
-- The legacy `staff` role is mapped to `account_executive` in the app layer
-- (migration 069 + lib/auth/permissions.ts + buyers/page.tsx), but the AI
-- matching pipeline and the /admin/clients Account Manager dropdown look up
-- role = 'account_executive'. Keeping real AEs on the legacy role causes
-- them to be invisible to those surfaces, so this migration promotes them.
--
-- SAFE + IDEMPOTENT:
--   * Only touches rows whose role is exactly 'staff' — never a client,
--     admin, or any other role.
--   * Backfills `industries` from the scalar `industry` column first, so a
--     promoted AE is never left without industry coverage (the matching
--     hard-filter only scores AEs that cover a buyer's industry).
--   * The migration-018 trigger `profiles_sync_primary_industry` keeps
--     `industry = industries[1]` in sync automatically.
--   * The migration-021 trigger `profiles_role_change_audit` (if applied)
--     logs each role change into `activities` — no audit history is lost.
--   * Re-runnable: once no `staff` rows remain it prints a notice and exits.
--
-- NOTE: in the current database there are 0 `staff` rows (role census shows
-- only admin/client/lead_researcher/super_admin/supplier_researcher), so
-- this migration converts nothing today. It is kept for future consistency.
-- To actually have AEs, promote a specific user — see the template at the
-- bottom of this file.
-- ============================================================================

DO $$
DECLARE
  staff_count integer;
BEGIN
  SELECT count(*) INTO staff_count FROM public.profiles WHERE role = 'staff';

  IF staff_count = 0 THEN
    RAISE NOTICE 'No legacy "staff" rows — nothing to convert.';
    RETURN;
  END IF;

  -- 1) Backfill the industries array from the scalar column where empty,
  --    so the promoted AE keeps their existing industry coverage.
  UPDATE public.profiles
  SET industries = ARRAY[industry]
  WHERE role = 'staff'
    AND industry IS NOT NULL
    AND (industries IS NULL OR array_length(industries, 1) IS NULL);

  -- 2) Promote staff → account_executive.
  UPDATE public.profiles
  SET role = 'account_executive'
  WHERE role = 'staff';

  RAISE NOTICE 'Converted % "staff" rows to "account_executive".', staff_count;
END
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- TEMPLATE — promote ONE existing internal user to Account Executive
-- ============================================================================
-- Use this when nobody yet has the AE role. The dropdown is empty simply
-- because there are no AEs; this is the step that fixes that.
--
-- ⚠️  Edit the email AND the industry list before running. Industry values
--     must come from the canonical list in lib/constants/industries.ts:
--     "Food & Beverage", "Agriculture", "Seafood",
--     "Cosmetics & Personal Care", "Pharmaceuticals", "Textiles & Garments",
--     "Footwear", "Furniture & Home Decor", "Machinery & Industrial Parts",
--     "Electronics & Components", "Packaging & Printing",
--     "Chemicals & Raw Materials", "Other".
--
-- Prefer the Team page UI (/admin/users → đổi vai trò → Account Executive)
-- when possible: it also backfills the sender email (work_email) and syncs
-- Supabase Auth user_metadata, which raw SQL below does not do. The app's
-- RBAC reads role from public.profiles (not the JWT), so this SQL works for
-- gating, but the UI path is the most complete.
-- ============================================================================

-- BEGIN;

-- DO $$
-- DECLARE
--   target uuid;
-- BEGIN
--   SELECT id INTO target
--   FROM public.profiles
--   WHERE lower(email) = 'nguoibanhang@veximtrade.com';  -- ⚠️ đổi email

--   IF target IS NULL THEN
--     RAISE EXCEPTION 'No profile found for that email.';
--   END IF;

--   IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target AND role = 'client') THEN
--     RAISE EXCEPTION 'Refusing to promote a client account to AE.';
--   END IF;

--   UPDATE public.profiles
--   SET role = 'account_executive',
--       industries = CASE
--         WHEN industries IS NULL OR array_length(industries, 1) IS NULL
--           THEN ARRAY['Food & Beverage']::text[]  -- ⚠️ đổi ngành hàng
--         ELSE industries
--       END
--   WHERE id = target;

--   RAISE NOTICE 'Promoted %.', target;
-- END
-- $$;

-- COMMIT;
