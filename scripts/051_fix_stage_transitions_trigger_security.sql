-- Migration 051 — Fix RLS violation on stage_transitions inserts
--
-- Bug
-- ---
-- Migration 029 added two trigger functions on `opportunities` that log
-- into `stage_transitions`:
--   * log_initial_stage_transition() — fires AFTER INSERT
--   * log_stage_transition()         — fires AFTER UPDATE OF stage
--
-- The 029 comment claimed "The triggers above run with the table owner so
-- they bypass RLS", but neither function was actually declared
-- SECURITY DEFINER. By default a PL/pgSQL function is SECURITY INVOKER, so
-- the INSERT into stage_transitions runs as the CALLING user (e.g. an
-- account_executive moving a card on the Kanban board), not the table
-- owner. The "Admins write stage_transitions" RLS policy only allows
-- admin/super_admin/staff to INSERT — so any AE/lead_researcher moving an
-- opportunity's stage (or the system creating a new opportunity) hits:
--
--   "new row violates row-level security policy for table
--   \"stage_transitions\""
--
-- Fix
-- ---
-- Recreate both functions with SECURITY DEFINER (+ a pinned search_path,
-- the standard hardening pattern already used by
-- enforce_fda_for_opportunity, next_invoice_number, etc. in this repo) so
-- the insert runs as the function owner and legitimately bypasses RLS —
-- matching what 029 always intended. No RLS policy or table change needed;
-- staff-only writes to `stage_transitions` are still enforced for any
-- direct client-side insert attempt, only the trigger's own logging is
-- exempted.
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.log_initial_stage_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stage_transitions
    (opportunity_id, from_stage, to_stage, transitioned_by, transitioned_at)
  VALUES
    (NEW.id, NULL, NEW.stage, NULL, NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_stage_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_at   timestamptz;
  prev_secs bigint;
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    SELECT transitioned_at INTO prev_at
      FROM public.stage_transitions
      WHERE opportunity_id = NEW.id
      ORDER BY transitioned_at DESC
      LIMIT 1;

    IF prev_at IS NULL THEN
      prev_at := OLD.created_at;
    END IF;

    prev_secs := GREATEST(0, EXTRACT(EPOCH FROM (now() - prev_at)))::bigint;

    INSERT INTO public.stage_transitions
      (opportunity_id, from_stage, to_stage, transitioned_by,
       transitioned_at, time_in_previous_stage_seconds)
    VALUES
      (NEW.id, OLD.stage, NEW.stage, NULL, now(), prev_secs);
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers already point at these function names (created in 029) and do
-- not need to be recreated — CREATE OR REPLACE FUNCTION above is enough to
-- swap in the SECURITY DEFINER versions. Re-asserting them here anyway for
-- clarity and in case this migration ever runs before 029 in a fresh DB.
DROP TRIGGER IF EXISTS trg_log_initial_stage_transition ON public.opportunities;
CREATE TRIGGER trg_log_initial_stage_transition
  AFTER INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_initial_stage_transition();

DROP TRIGGER IF EXISTS trg_log_stage_transition ON public.opportunities;
CREATE TRIGGER trg_log_stage_transition
  AFTER UPDATE OF stage ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_stage_transition();
