-- ============================================================================
-- Migration 072: Supplier Researcher — create intake links + review submissions
-- ============================================================================
-- Fix: SR (supplier_researcher) owns the supplier pipeline end-to-end, but the
-- RLS policies on `client_intake_submissions` (migration 064) only allowed
-- admin/staff/super_admin/account_executive to INSERT (create links) and
-- UPDATE (approve/reject) rows. Migration 069 already let SR SELECT the whole
-- queue, and the app layer already treats SR as a reviewer
-- (REVIEWER_ROLES in app/admin/clients/intake/actions.ts) and as a client
-- creator (createClientAccount / createIntakeLink in
-- app/admin/clients/new/actions.ts).
--
-- The application currently writes through the service-role client (which
-- bypasses RLS), so this is defense-in-depth: it keeps the database policies
-- aligned with the app-layer decision so a future switch to session-client
-- writes would not silently break SR.
--
-- Uses public.get_current_user_role() (SECURITY DEFINER, from migration 003)
-- instead of a self-referencing subquery on profiles, per the recursion-safe
-- pattern used in migration 069.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. INSERT: SR can generate single-use intake links (owned by themselves).
DROP POLICY IF EXISTS "client_intake_supplier_researcher_insert_own"
  ON public.client_intake_submissions;
CREATE POLICY "client_intake_supplier_researcher_insert_own"
  ON public.client_intake_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ae_id = auth.uid()
    AND public.get_current_user_role() = 'supplier_researcher'
  );

-- 2. UPDATE: SR can review/approve/reject submissions across the pool.
DROP POLICY IF EXISTS "client_intake_supplier_researcher_update_all"
  ON public.client_intake_submissions;
CREATE POLICY "client_intake_supplier_researcher_update_all"
  ON public.client_intake_submissions
  FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher')
  WITH CHECK (public.get_current_user_role() = 'supplier_researcher');
