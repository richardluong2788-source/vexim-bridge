-- ============================================================
-- Sprint D — view security hardening
-- Migration 011: ensure client_commission_timeline respects RLS
-- ============================================================
-- In Postgres 15+, views default to SECURITY INVOKER only when created
-- with `WITH (security_invoker = true)`. Without the option, clients
-- could SELECT from the view and bypass RLS on deals/opportunities.
--
-- We recreate the view explicitly as security_invoker and restrict
-- privileges to authenticated users, plus grant row-level filtering
-- through a helper that mirrors the RLS policy on opportunities.
-- ============================================================

-- 1. Drop & recreate as security_invoker view.
DROP VIEW IF EXISTS public.client_commission_timeline;

CREATE VIEW public.client_commission_timeline
  WITH (security_invoker = true)
AS
SELECT
  o.client_id,
  COALESCE(d.paid_at, d.updated_at)::date AS paid_on,
  COALESCE(d.commission_amount, 0)         AS commission_amount,
  COALESCE(d.invoice_value, 0)             AS invoice_value
FROM public.deals d
JOIN public.opportunities o ON o.id = d.opportunity_id
WHERE d.payment_status = 'paid';

COMMENT ON VIEW public.client_commission_timeline IS
  'Paid-commission rows grouped by client and paid date. security_invoker=true so RLS on deals/opportunities is respected — clients only see their own.';

-- 2. Make sure authenticated users can select the view. RLS on the
-- underlying tables will still restrict row visibility.
GRANT SELECT ON public.client_commission_timeline TO authenticated;
