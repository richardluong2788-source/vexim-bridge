-- ============================================================
-- Migration 030 — Client analytics RLS
-- ============================================================
-- IDEMPOTENT — safe to re-run.
--
-- Why
-- ---
-- The new /client/analytics page (Phase 4) needs four data sources:
--   1. client_leads_masked         — already RLS-safe (filters by auth.uid)
--   2. client_commission_timeline  — already RLS-safe (security invoker)
--   3. opportunities               — already RLS-safe ("Clients can view own")
--   4. stage_transitions           — NOT YET readable by clients
--
-- (4) was created in migration 029 with policies for staff only. To compute
--   - average time spent in each phase
--   - which phase a deal fell off when it was lost
--   - whether a deal ever reached "price_agreed" or beyond
-- the client portal needs to read its OWN transitions.
--
-- This policy mirrors the long-standing "Clients can view own activities"
-- policy from migration 001: a client may SELECT a row IFF the underlying
-- opportunity belongs to them. Cross-client leakage is impossible because
-- the EXISTS sub-query is always anchored to auth.uid().
-- ============================================================

DROP POLICY IF EXISTS "Clients read own stage_transitions"
  ON public.stage_transitions;

CREATE POLICY "Clients read own stage_transitions"
  ON public.stage_transitions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.opportunities o
      WHERE o.id = stage_transitions.opportunity_id
        AND o.client_id = auth.uid()
    )
  );

COMMENT ON POLICY "Clients read own stage_transitions" ON public.stage_transitions IS
  'Lets a logged-in client see the stage history of their own opportunities only. '
  'Drives the Phase 4 client analytics page (/client/analytics). '
  'Anchored to opportunities.client_id = auth.uid() so a client can never read '
  'another client''s transitions.';

-- ============================================================
-- DONE — verify with:
--   set role authenticated;
--   set request.jwt.claims.sub = '<a-client-uuid>';
--   select count(*) from public.stage_transitions;  -- should only count theirs
-- ============================================================
