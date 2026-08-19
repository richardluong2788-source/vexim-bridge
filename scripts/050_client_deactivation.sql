-- ============================================================
-- Migration 050: Client deactivation (soft delete)
-- ------------------------------------------------------------
-- Problem: `profiles` has an ON DELETE RESTRICT relationship from
-- `invoices.client_id` (and other financial/history tables), so a
-- super_admin cannot hard-delete a client that has ever been invoiced
-- — Postgres correctly refuses, to avoid losing financial history.
--
-- Instead of a hard delete, staff can now "deactivate" a client:
--   - The client row (and all its history: invoices, deals, docs...)
--     is kept intact.
--   - The client is flagged `is_active = false` and hidden from the
--     default admin/AE list views + AI matching + login.
--   - It can be reactivated at any time.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.profiles.is_active IS
  'Soft-delete flag for client accounts. false = deactivated (hidden from lists/matching/login) but all history is preserved. Staff accounts are always true.';

-- Fast filtering for "active clients only" list queries.
CREATE INDEX IF NOT EXISTS idx_profiles_role_is_active
  ON public.profiles (role, is_active);
