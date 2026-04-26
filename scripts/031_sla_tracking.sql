-- =====================================================================
-- Migration 031 — SLA Tracking (Sprint 1 MVP + v2 MUST refinements)
-- =====================================================================
-- Purpose: enable monthly automated evaluation of the 7 SLA metrics
-- defined in §7.3 of the service contract:
--
--   M1 pipeline_update_response   — pipeline updated within 1 business day
--   M2 monthly_qualified_leads    — qualified opp threshold per plan
--   M3 monthly_email_outreach     — sent buyer email threshold per plan
--   M4 client_request_response    — admin response time within X hours
--   M5 swift_verification_lag     — verify Swift within Y business days
--   M6 fda_renewal_alert          — FDA expiry notice ≥ 90 days early
--   M7 monthly_status_report      — monthly digest delivered to client
--
-- The data needed for M1, M3, M5, M6, M7 already exists in the system
-- (activities, email_drafts, deals, profiles, notification_email_log).
-- This migration adds:
--
--   1. opportunities.qualified_at / qualified_by  — backfills M2 source
--   2. client_requests                            — single source for M4
--   3. sla_targets                                — per-plan thresholds
--   4. sla_violations                             — evaluator output
--   5. sla_holidays              (v2 B.1)         — public holiday calendar
--   6. sla_evaluation_runs       (v2 B.6)         — idempotency state
--
-- Idempotent — safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. opportunities.qualified_at / qualified_by — for M2
-- ---------------------------------------------------------------------
-- "Qualified" = opportunity has progressed past the initial 'new' stage.
-- We capture the FIRST transition so a deal that moves new -> contacted
-- -> new -> contacted only counts once.
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qualified_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.opportunities.qualified_at IS
  'Timestamp of first transition out of stage=new. Drives SLA M2 (monthly qualified leads).';
COMMENT ON COLUMN public.opportunities.qualified_by IS
  'Staff member who marked the opportunity as qualified.';

-- Backfill from existing data: any opp not in stage='new' is already
-- qualified — use last_updated as best-effort timestamp.
UPDATE public.opportunities
SET qualified_at = COALESCE(qualified_at, last_updated, created_at)
WHERE stage <> 'new'
  AND qualified_at IS NULL;

-- Trigger to capture first qualification.
CREATE OR REPLACE FUNCTION public.handle_opportunity_qualification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set on the first transition AWAY from 'new'.
  IF (OLD.stage = 'new' OR OLD.stage IS NULL)
     AND NEW.stage <> 'new'
     AND NEW.qualified_at IS NULL THEN
    NEW.qualified_at := NOW();
    NEW.qualified_by := COALESCE(auth.uid(), NEW.qualified_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_opportunity_qualification ON public.opportunities;
CREATE TRIGGER on_opportunity_qualification
  BEFORE UPDATE OF stage ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_opportunity_qualification();

CREATE INDEX IF NOT EXISTS idx_opportunities_qualified_at
  ON public.opportunities (qualified_at)
  WHERE qualified_at IS NOT NULL;


-- ---------------------------------------------------------------------
-- 2. client_requests — for M4 (response-time SLA)
-- ---------------------------------------------------------------------
-- Inbound questions from the client (portal form, Zalo log, phone log).
-- The evaluator computes (first_response_at - received_at) in business
-- hours and compares against the active sla_targets row.
CREATE TABLE IF NOT EXISTS public.client_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  channel TEXT NOT NULL CHECK (channel IN (
    'portal',     -- /client/sla form
    'email',      -- inbound email forwarded to support
    'zalo',       -- chat
    'phone',      -- phone call
    'whatsapp',
    'other'
  )),

  subject     TEXT NOT NULL,
  body        TEXT,
  priority    TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- When the request actually came in (allows backdated manual logs).
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Filled when an admin/staff member first responds.
  first_response_at TIMESTAMPTZ,
  first_response_by UUID REFERENCES public.profiles(id),
  first_response_note TEXT,

  resolved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

  -- v2 B.5 — audit when staff backdate-logs a request on behalf of a client.
  logged_by  UUID REFERENCES public.profiles(id),
  logged_via_channel BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT received_at_not_future
    CHECK (received_at <= now() + INTERVAL '5 minutes'),
  CONSTRAINT first_response_after_received
    CHECK (first_response_at IS NULL OR first_response_at >= received_at)
);

CREATE INDEX IF NOT EXISTS idx_client_requests_client
  ON public.client_requests (client_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_requests_open
  ON public.client_requests (status, received_at)
  WHERE status IN ('open', 'in_progress');
-- Speed up the monthly evaluator query that buckets by month of receipt.
-- NOTE: date_trunc('month', received_at) on a timestamptz is STABLE, not
-- IMMUTABLE, so it cannot be used directly in an index expression. The
-- composite (client_id, received_at DESC) index defined above already
-- supports range scans by month, which is what the evaluator needs.

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage client_requests" ON public.client_requests;
CREATE POLICY "Staff manage client_requests"
  ON public.client_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'super_admin', 'admin', 'staff',
          'account_executive', 'lead_researcher', 'finance'
        )
    )
  );

DROP POLICY IF EXISTS "Clients view own client_requests" ON public.client_requests;
CREATE POLICY "Clients view own client_requests"
  ON public.client_requests FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Clients insert own client_requests" ON public.client_requests;
CREATE POLICY "Clients insert own client_requests"
  ON public.client_requests FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND logged_by IS NULL
    AND logged_via_channel = FALSE
    AND received_at >= now() - INTERVAL '5 minutes'
  );

CREATE OR REPLACE FUNCTION public.handle_client_requests_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_requests_updated ON public.client_requests;
CREATE TRIGGER on_client_requests_updated
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_requests_updated();


-- ---------------------------------------------------------------------
-- 3. sla_targets — per-billing-plan thresholds
-- ---------------------------------------------------------------------
-- Each row defines ONE measurable SLA promise. The evaluator joins
-- this with measurement data to compute compliance per (client, month).
--
-- target_value semantics depend on metric_key:
--   - pipeline_update_response   : max business hours
--   - monthly_qualified_leads    : min count
--   - monthly_email_outreach     : min count
--   - client_request_response    : max business hours
--   - swift_verification_lag     : max business days
--   - fda_renewal_alert          : min days advance notice
--   - monthly_status_report      : 1 = required, 0 = not required
CREATE TABLE IF NOT EXISTS public.sla_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- NULL billing_plan_id → global default (fallback for clients without
  -- a custom row). Custom rows override the default per metric.
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE CASCADE,

  metric_key TEXT NOT NULL CHECK (metric_key IN (
    'pipeline_update_response',
    'monthly_qualified_leads',
    'monthly_email_outreach',
    'client_request_response',
    'swift_verification_lag',
    'fda_renewal_alert',
    'monthly_status_report'
  )),

  target_value NUMERIC(10, 2) NOT NULL,

  -- Weight in the SLA Health Score (v2 B.7) — defaults to equal slices.
  weight NUMERIC(4, 3) NOT NULL DEFAULT 0.143
    CHECK (weight >= 0 AND weight <= 1),

  -- Cents of penalty per occurrence (Sprint 2 will use this).
  penalty_usd_cents INT NOT NULL DEFAULT 0
    CHECK (penalty_usd_cents >= 0),

  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active target per (plan, metric). NULL plan_id is the global default.
CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_targets_plan_metric_active
  ON public.sla_targets (COALESCE(billing_plan_id, '00000000-0000-0000-0000-000000000000'), metric_key)
  WHERE active = TRUE;

ALTER TABLE public.sla_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sla_targets" ON public.sla_targets;
CREATE POLICY "Admins manage sla_targets"
  ON public.sla_targets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

DROP POLICY IF EXISTS "Staff read sla_targets" ON public.sla_targets;
CREATE POLICY "Staff read sla_targets"
  ON public.sla_targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'super_admin', 'admin', 'staff',
          'account_executive', 'lead_researcher', 'finance'
        )
    )
  );

-- Clients can read targets for THEIR active plan, so the portal can
-- show "Promised: 1 business day" alongside the actual measurement.
DROP POLICY IF EXISTS "Clients read own plan sla_targets" ON public.sla_targets;
CREATE POLICY "Clients read own plan sla_targets"
  ON public.sla_targets FOR SELECT
  USING (
    billing_plan_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.billing_plans bp
      WHERE bp.id = sla_targets.billing_plan_id
        AND bp.client_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.handle_sla_targets_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_sla_targets_updated ON public.sla_targets;
CREATE TRIGGER on_sla_targets_updated
  BEFORE UPDATE ON public.sla_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sla_targets_updated();

-- Seed conservative global defaults so the evaluator works on day 1.
INSERT INTO public.sla_targets (billing_plan_id, metric_key, target_value, weight, notes)
VALUES
  (NULL, 'pipeline_update_response', 24,  0.18, 'Cập nhật pipeline trong 1 ngày làm việc'),
  (NULL, 'monthly_qualified_leads',  10,  0.15, 'Tối thiểu opportunities đủ điều kiện trong tháng'),
  (NULL, 'monthly_email_outreach',   30,  0.12, 'Tối thiểu email gửi tới buyers trong tháng'),
  (NULL, 'client_request_response',  24,  0.18, 'Phản hồi câu hỏi client trong 24 giờ làm việc'),
  (NULL, 'swift_verification_lag',   2,   0.12, 'Xác minh Swift wire trong 2 ngày làm việc'),
  (NULL, 'fda_renewal_alert',        90,  0.10, 'Cảnh báo gia hạn FDA tối thiểu 90 ngày trước'),
  (NULL, 'monthly_status_report',    1,   0.15, 'Báo cáo tháng gửi đúng hạn (mùng 5 tháng kế tiếp)')
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
-- 4. sla_violations — evaluator output
-- ---------------------------------------------------------------------
-- Append-only log of detected breaches. The cron is idempotent via
-- (client_id, metric_key, period_month, occurrence_in_month).
CREATE TABLE IF NOT EXISTS public.sla_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  sla_target_id   UUID REFERENCES public.sla_targets(id)   ON DELETE SET NULL,

  metric_key TEXT NOT NULL,
  -- The first day of the month the breach was attributed to (UTC).
  period_month DATE NOT NULL,
  -- 1 for "monthly" metrics that breach at most once. For per-event
  -- metrics like client_request_response, this is a stable ID derived
  -- from the underlying record (e.g. crc32 of request UUID) so the
  -- evaluator can write one row per missed event without duplicates.
  occurrence_in_month INT NOT NULL DEFAULT 1,

  -- Snapshot of measurement vs. promise at evaluation time.
  measured_value NUMERIC(15, 3) NOT NULL,
  target_value   NUMERIC(15, 3) NOT NULL,
  -- Gap = (measured - target) for "max" metrics, or (target - measured)
  -- for "min" metrics. Always positive when in violation.
  delta NUMERIC(15, 3) NOT NULL,

  -- Pointer back to the offending record where applicable.
  -- 'opportunity' | 'client_request' | 'deal' | 'profile' | 'aggregate'.
  source_kind TEXT,
  source_id   UUID,

  -- Sprint 1: every violation lands as 'logged'. Sprint 2 introduces
  -- pending_review / overridden / applied (v2 B.2).
  status TEXT NOT NULL DEFAULT 'logged'
    CHECK (status IN ('logged', 'pending_review', 'overridden', 'applied', 'waived')),

  detail JSONB,

  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_violations_dedup
  ON public.sla_violations (client_id, metric_key, period_month, occurrence_in_month);
CREATE INDEX IF NOT EXISTS idx_sla_violations_client_period
  ON public.sla_violations (client_id, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_sla_violations_metric_period
  ON public.sla_violations (metric_key, period_month DESC);

ALTER TABLE public.sla_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sla_violations" ON public.sla_violations;
CREATE POLICY "Admins manage sla_violations"
  ON public.sla_violations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

DROP POLICY IF EXISTS "Staff read sla_violations" ON public.sla_violations;
CREATE POLICY "Staff read sla_violations"
  ON public.sla_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'super_admin', 'admin', 'staff',
          'account_executive', 'lead_researcher', 'finance'
        )
    )
  );

DROP POLICY IF EXISTS "Clients view own sla_violations" ON public.sla_violations;
CREATE POLICY "Clients view own sla_violations"
  ON public.sla_violations FOR SELECT
  USING (client_id = auth.uid());


-- ---------------------------------------------------------------------
-- 5. sla_holidays — v2 B.1 (skip business-day calculations)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_holidays (
  holiday_date DATE PRIMARY KEY,
  label        TEXT NOT NULL,
  country      TEXT NOT NULL DEFAULT 'VN',
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sla_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sla_holidays" ON public.sla_holidays;
CREATE POLICY "Admins manage sla_holidays"
  ON public.sla_holidays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Anyone authenticated reads sla_holidays" ON public.sla_holidays;
CREATE POLICY "Anyone authenticated reads sla_holidays"
  ON public.sla_holidays FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed VN public holidays. Admins can edit/extend via the UI later.
INSERT INTO public.sla_holidays (holiday_date, label) VALUES
  ('2026-01-01', 'Tết Dương lịch'),
  ('2026-04-30', 'Giải phóng miền Nam'),
  ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-09-02', 'Quốc khánh'),
  ('2027-01-01', 'Tết Dương lịch'),
  ('2027-02-15', 'Tết Nguyên Đán — mùng 1'),
  ('2027-02-16', 'Tết Nguyên Đán — mùng 2'),
  ('2027-02-17', 'Tết Nguyên Đán — mùng 3'),
  ('2027-02-18', 'Tết Nguyên Đán — mùng 4'),
  ('2027-02-19', 'Tết Nguyên Đán — mùng 5'),
  ('2027-04-30', 'Giải phóng miền Nam'),
  ('2027-05-01', 'Quốc tế Lao động'),
  ('2027-09-02', 'Quốc khánh')
ON CONFLICT (holiday_date) DO NOTHING;


-- ---------------------------------------------------------------------
-- 6. sla_evaluation_runs — v2 B.6 (idempotency state machine)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_evaluation_runs (
  period_month  DATE PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  triggered_by  TEXT NOT NULL DEFAULT 'cron',
  -- Counters from the run, useful for the admin re-run UI.
  scanned_clients INT NOT NULL DEFAULT 0,
  violations_inserted INT NOT NULL DEFAULT 0,
  error_message TEXT
);

ALTER TABLE public.sla_evaluation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read sla_evaluation_runs" ON public.sla_evaluation_runs;
CREATE POLICY "Admins read sla_evaluation_runs"
  ON public.sla_evaluation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'finance')
    )
  );

-- Writes only via service-role (cron) — no INSERT/UPDATE policy intentionally.


-- ---------------------------------------------------------------------
-- 7. Aggregator view: sla_monthly_summary
-- ---------------------------------------------------------------------
-- One row per (client, period_month, metric_key) summarising compliance.
-- Used by /admin/sla and /client/sla. Numbers compute on read so it is
-- always consistent with sla_violations even if the cron has not yet
-- run for the current period.
CREATE OR REPLACE VIEW public.sla_monthly_summary AS
SELECT
  v.client_id,
  v.period_month,
  v.metric_key,
  COUNT(*)                                       AS violations,
  SUM(v.delta)                                   AS total_delta,
  MAX(v.detected_at)                             AS last_detected_at
FROM public.sla_violations v
GROUP BY v.client_id, v.period_month, v.metric_key;

COMMENT ON VIEW public.sla_monthly_summary IS
  'One row per (client, month, metric) with the aggregate violation count and gap. Drives the admin dashboard heatmap and client portal scorecard.';


-- ---------------------------------------------------------------------
-- 8. Schema cache reload
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- DONE — verify with:
--   SELECT * FROM public.sla_targets WHERE billing_plan_id IS NULL;
--   SELECT * FROM public.sla_holidays ORDER BY holiday_date;
--   \d public.client_requests
--   \d public.sla_violations
-- =====================================================================
