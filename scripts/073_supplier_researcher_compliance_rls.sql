-- ============================================================================
-- Migration 073: Supplier Researcher — full supplier qualification surface
-- ============================================================================
-- Fix: SR (supplier_researcher) is the person working directly with the
-- supplier (client) and owns supplier qualification end-to-end, but the RLS
-- policies only let SR SELECT the supplier data (migration 069). The app now
-- grants SR CLIENT_COMPLIANCE_WRITE (lib/auth/permissions.ts), which unlocks
-- the compliance-dossier workflow: upload FDA cert / COA / price sheet /
-- factory video+photos, create/revoke tokenized share links, and manage the
-- factory capability assessment.
--
-- The application writes through the service-role client (which bypasses RLS),
-- so these policies are defense-in-depth: they keep the database aligned with
-- the app-layer decision so a future switch to session-client writes would not
-- silently break SR.
--
-- Uses public.get_current_user_role() (SECURITY DEFINER, migration 003)
-- instead of a self-referencing subquery on profiles — the recursion-safe
-- pattern used in migrations 069 and 072.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. compliance_docs — SR needs full CRUD (qualification hồ sơ pháp lý).
--    Migration 069 granted SELECT only; 009's "FOR ALL" policy covers
--    admin/staff/super_admin/account_executive but not SR.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers manage compliance_docs"
  ON public.compliance_docs;
CREATE POLICY "Supplier researchers manage compliance_docs"
  ON public.compliance_docs
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher')
  WITH CHECK (public.get_current_user_role() = 'supplier_researcher');

-- ---------------------------------------------------------------------------
-- 2. tokenized_share_links — SR issues/revokes buyer-facing share links.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers manage share_links"
  ON public.tokenized_share_links;
CREATE POLICY "Supplier researchers manage share_links"
  ON public.tokenized_share_links
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher')
  WITH CHECK (public.get_current_user_role() = 'supplier_researcher');

-- ---------------------------------------------------------------------------
-- 3. tokenized_share_link_docs — SR creates bundle links (one URL → many docs).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers manage share_link_docs"
  ON public.tokenized_share_link_docs;
CREATE POLICY "Supplier researchers manage share_link_docs"
  ON public.tokenized_share_link_docs
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher')
  WITH CHECK (public.get_current_user_role() = 'supplier_researcher');

-- ---------------------------------------------------------------------------
-- 4. client_factory_assessments — SR fills in the capability assessment
--    (mục 6-15) for suppliers they qualify. Migration 046's internal policies
--    only covered admin/super_admin/staff/account_executive.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "factory_assessments_sr_read"
  ON public.client_factory_assessments;
CREATE POLICY "factory_assessments_sr_read"
  ON public.client_factory_assessments
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher');

DROP POLICY IF EXISTS "factory_assessments_sr_insert"
  ON public.client_factory_assessments;
CREATE POLICY "factory_assessments_sr_insert"
  ON public.client_factory_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_current_user_role() = 'supplier_researcher');

DROP POLICY IF EXISTS "factory_assessments_sr_update"
  ON public.client_factory_assessments;
CREATE POLICY "factory_assessments_sr_update"
  ON public.client_factory_assessments
  FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher')
  WITH CHECK (public.get_current_user_role() = 'supplier_researcher');

DROP POLICY IF EXISTS "factory_assessments_sr_delete"
  ON public.client_factory_assessments;
CREATE POLICY "factory_assessments_sr_delete"
  ON public.client_factory_assessments
  FOR DELETE
  TO authenticated
  USING (public.get_current_user_role() = 'supplier_researcher');
