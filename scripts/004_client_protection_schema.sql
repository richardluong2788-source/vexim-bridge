-- ============================================================
-- ESH (Export Sales Hub) - Phase 3 Schema Migration
-- Migration 004: Client protection + commercial deal fields
-- ============================================================
-- IDEMPOTENT — safe to run multiple times.
-- Goals:
--   1. Give each opportunity a stable "buyer code" (e.g. US-1042) so
--      the client portal can reference buyers WITHOUT revealing the
--      real company name while the deal is still in progress.
--   2. Add commercial fields so clients see meaningful deal context
--      instead of a bare table (product, quantity, price, incoterms,
--      payment terms, destination port, target close date).
--   3. Add workflow fields so clients always know what the ESH team
--      is doing next and what action (if any) they need to take.
--   4. Add "region" to leads for masked display like
--      "US-1042 · Food & Beverage · California, US".
-- ============================================================


-- ============================================================
-- 1. LEADS: Add region for masked identity display
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS region TEXT;
  -- e.g., "California, US" or "Texas, US". Shown to clients in
  -- place of full company name during pre-commit stages.


-- ============================================================
-- 2. OPPORTUNITIES: Buyer code + commercial + workflow fields
-- ============================================================

-- Stable identifier shown to clients (e.g. "US-1042")
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS buyer_code TEXT;

-- Commercial fields
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS products_interested TEXT;
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS quantity_required TEXT;
  -- Free text e.g. "2 x 40ft container" or "20 metric tons"
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS target_price_usd DECIMAL(15, 2);
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS price_unit TEXT;
  -- Free text e.g. "per kg", "per MT", "per container"
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS incoterms TEXT;
  -- e.g. "FOB Cat Lai", "CIF Long Beach", "DDP Los Angeles"
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;
  -- e.g. "50% T/T deposit, 50% at B/L", "Irrevocable L/C at sight"
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS destination_port TEXT;
  -- e.g. "Long Beach, CA"
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS target_close_date DATE;

-- Workflow visibility fields
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS next_step TEXT;
  -- What the ESH team is doing next. Shown to clients.
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS client_action_required TEXT;
  -- What the client needs to do. Empty = nothing pending.
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS client_action_due_date DATE;


-- ============================================================
-- 3. BUYER CODE: Sequence + auto-assign trigger + backfill
-- ============================================================

-- Sequence starts at 1042 for nicer looking early codes.
CREATE SEQUENCE IF NOT EXISTS public.buyer_code_seq START 1042;

CREATE OR REPLACE FUNCTION public.assign_buyer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.buyer_code IS NULL OR NEW.buyer_code = '' THEN
    NEW.buyer_code := 'US-' || nextval('public.buyer_code_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_opportunity_buyer_code ON public.opportunities;
CREATE TRIGGER on_opportunity_buyer_code
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.assign_buyer_code();

-- Backfill any existing opportunities without a buyer code
UPDATE public.opportunities
  SET buyer_code = 'US-' || nextval('public.buyer_code_seq')
  WHERE buyer_code IS NULL OR buyer_code = '';

-- Now that every row has one, enforce NOT NULL + UNIQUE.
ALTER TABLE public.opportunities
  ALTER COLUMN buyer_code SET NOT NULL;

-- Use a unique index (safe to re-run) rather than re-adding a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_buyer_code
  ON public.opportunities(buyer_code);


-- ============================================================
-- 4. INDEXES for client dashboard queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_opportunities_client_stage
  ON public.opportunities(client_id, stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_last_updated
  ON public.opportunities(last_updated DESC);


-- ============================================================
-- DONE
-- ============================================================
-- Verify with:
--   SELECT buyer_code, stage, products_interested, next_step
--   FROM public.opportunities LIMIT 5;
-- ============================================================
