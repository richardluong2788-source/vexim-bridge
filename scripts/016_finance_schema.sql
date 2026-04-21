-- ============================================================
-- ESH (Export Sales Hub) — Finance / Cash-Flow schema
-- Migration 016 (idempotent)
--
-- Adds the full revenue-side model so the platform can run the
-- complete cash-flow loop described in the business doc:
--
--   1. billing_plans       — per-client contract: setup fee, monthly
--                            retainer, success fee %, retainer credit %.
--   2. invoices            — three kinds: setup_fee (one-off),
--                            retainer (monthly, automated), success_fee
--                            (auto-generated when a deal ships).
--   3. retainer_credits    — immutable ledger of credit earned from
--                            paid retainers and applied against success
--                            fee invoices (default 50% offset policy).
--   4. operating_expenses  — outbound cash (salary, tools, marketing).
--   5. finance_settings    — singleton: FX rate, company bank info for
--                            VietQR, invoice prefix, payment terms.
--   6. invoice_counters    — monotonic per-year counter to generate
--                            invoice numbers safely under concurrency.
--
-- All monetary values are USD (DECIMAL 15,2). VND is derived at render
-- time using finance_settings.default_fx_rate_vnd_per_usd, or the
-- fx_rate_vnd_per_usd snapshot captured on the invoice row.
-- ============================================================


-- ------------------------------------------------------------
-- 1. FINANCE_SETTINGS (singleton)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Currency
  default_fx_rate_vnd_per_usd DECIMAL(12, 2) NOT NULL DEFAULT 25000,

  -- Invoice numbering (e.g. "ESH-2026-0001")
  invoice_prefix TEXT NOT NULL DEFAULT 'ESH',
  default_payment_terms_days INT NOT NULL DEFAULT 14,

  -- Company (issuer) — printed on every invoice
  company_name TEXT,
  company_address TEXT,
  company_tax_id TEXT,
  company_email TEXT,
  company_phone TEXT,

  -- Bank for VietQR (Napas 247). bank_bin is the 6-digit Napas code,
  -- e.g. 970436 (Vietcombank), 970418 (BIDV), 970422 (MBBank).
  bank_name TEXT,
  bank_account_no TEXT,
  bank_account_name TEXT,
  bank_bin TEXT,
  bank_swift_code TEXT,

  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the singleton row.
INSERT INTO public.finance_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage finance_settings" ON public.finance_settings;
CREATE POLICY "Admins manage finance_settings"
  ON public.finance_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

-- Finance settings need to be readable by invoice render pages — allow
-- any authenticated user to SELECT. The sensitive fields are all public
-- on an invoice anyway (bank info, company info).
DROP POLICY IF EXISTS "Authenticated can read finance_settings" ON public.finance_settings;
CREATE POLICY "Authenticated can read finance_settings"
  ON public.finance_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ------------------------------------------------------------
-- 2. BILLING_PLANS — per-client contract
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  plan_name TEXT NOT NULL,                          -- e.g. "Starter", "Growth"

  -- Commercial terms — all nullable so admins can partially configure.
  setup_fee_usd DECIMAL(15, 2),                     -- one-off on contract start
  monthly_retainer_usd DECIMAL(15, 2),              -- billed every month
  success_fee_percent DECIMAL(6, 3) DEFAULT 10.000, -- % of profit_margin_usd
  retainer_credit_percent DECIMAL(6, 3) NOT NULL DEFAULT 50.000,
                                                    -- % of paid retainers
                                                    -- credited toward success fee

  contract_start_date DATE,
  contract_end_date DATE,                           -- null = open-ended
  billing_anchor_day SMALLINT NOT NULL DEFAULT 1
    CHECK (billing_anchor_day BETWEEN 1 AND 28),
    -- Day of month to issue the monthly retainer.

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'terminated')),

  -- Snapshot of FX rate at contract signing (for VND preview).
  fx_rate_vnd_per_usd DECIMAL(12, 2),

  notes TEXT,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_client
  ON public.billing_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_status
  ON public.billing_plans(status);
-- At most one ACTIVE plan per client.
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_plans_active_per_client
  ON public.billing_plans(client_id) WHERE status = 'active';

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage billing_plans" ON public.billing_plans;
CREATE POLICY "Admins manage billing_plans"
  ON public.billing_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

DROP POLICY IF EXISTS "Clients view own billing_plans" ON public.billing_plans;
CREATE POLICY "Clients view own billing_plans"
  ON public.billing_plans FOR SELECT
  USING (client_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_billing_plans_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_billing_plans_updated ON public.billing_plans;
CREATE TRIGGER on_billing_plans_updated
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_billing_plans_updated();


-- ------------------------------------------------------------
-- 3. INVOICE_COUNTERS — year -> last_number (atomic increment)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
-- Only SECURITY DEFINER helper reads/writes this table; no direct policies.


-- ------------------------------------------------------------
-- 4. INVOICES — generalized, supports 3 kinds
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,              -- filled by trigger

  -- Public share token — used on /invoice/[token] so buyers/clients
  -- can view the printable invoice without logging in.
  public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  kind TEXT NOT NULL CHECK (kind IN (
    'setup_fee', 'retainer', 'success_fee', 'manual'
  )),

  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

  -- Money
  amount_usd DECIMAL(15, 2) NOT NULL CHECK (amount_usd >= 0),
  credit_applied_usd DECIMAL(15, 2) NOT NULL DEFAULT 0
    CHECK (credit_applied_usd >= 0),
  net_amount_usd DECIMAL(15, 2)
    GENERATED ALWAYS AS (amount_usd - credit_applied_usd) STORED,

  -- FX snapshot so VND totals on the printed invoice stay stable even
  -- when the global rate later changes.
  fx_rate_vnd_per_usd DECIMAL(12, 2) NOT NULL,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  period_start DATE,                                -- retainer only
  period_end DATE,                                  -- retainer only

  paid_at TIMESTAMPTZ,
  paid_amount_usd DECIMAL(15, 2) DEFAULT 0,
  payment_reference TEXT,                           -- bank txn id / memo

  -- Presentation / sharing
  memo TEXT,                                        -- transfer memo for client
  pdf_url TEXT,                                     -- if admin uploads a signed PDF
  email_sent_at TIMESTAMPTZ,

  -- Snapshots so the invoice stays legible even after settings change.
  issuer_snapshot JSONB,                            -- company info at issue
  bank_snapshot JSONB,                              -- bank info at issue

  notes TEXT,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_kind
  ON public.invoices(kind);
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_deal
  ON public.invoices(deal_id);

-- Prevent accidental duplicates of the retainer for the same period.
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_retainer_period
  ON public.invoices(billing_plan_id, period_start)
  WHERE kind = 'retainer' AND status <> 'cancelled' AND status <> 'void';
-- One success_fee invoice per deal (also kept active-only).
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_success_fee_deal
  ON public.invoices(deal_id)
  WHERE kind = 'success_fee' AND status <> 'cancelled' AND status <> 'void';

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices"
  ON public.invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

DROP POLICY IF EXISTS "Clients view own invoices" ON public.invoices;
CREATE POLICY "Clients view own invoices"
  ON public.invoices FOR SELECT
  USING (client_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_invoices_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoices_updated ON public.invoices;
CREATE TRIGGER on_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_invoices_updated();


-- ------------------------------------------------------------
-- 5. INVOICE NUMBER ALLOCATOR (SECURITY DEFINER)
-- Uses an UPSERT on invoice_counters to atomically reserve the next
-- sequence number for the current year. Format: <PREFIX>-<YYYY>-<NNNN>.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  v_year   INT;
  v_num    INT;
  v_prefix TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::INT;

  SELECT fs.invoice_prefix
    INTO v_prefix
    FROM public.finance_settings fs
    WHERE fs.id = 1;

  IF v_prefix IS NULL OR LENGTH(v_prefix) = 0 THEN
    v_prefix := 'ESH';
  END IF;

  INSERT INTO public.invoice_counters (year, last_number)
    VALUES (v_year, 1)
    ON CONFLICT (year)
      DO UPDATE SET last_number = public.invoice_counters.last_number + 1
    RETURNING public.invoice_counters.last_number INTO v_num;

  RETURN v_prefix || '-' || v_year::TEXT || '-' || LPAD(v_num::TEXT, 4, '0');
END;
$$;

-- Auto-assign invoice_number if not provided.
CREATE OR REPLACE FUNCTION public.handle_invoices_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.next_invoice_number();
  END IF;

  -- Default due_date from settings if not provided.
  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.issue_date
      + COALESCE(
          (SELECT default_payment_terms_days FROM public.finance_settings WHERE id = 1),
          14
        ) * INTERVAL '1 day';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoices_before_insert ON public.invoices;
CREATE TRIGGER on_invoices_before_insert
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_invoices_before_insert();


-- ------------------------------------------------------------
-- 6. RETAINER CREDITS — signed ledger
--   amount_usd > 0  -> credit earned (from paid retainer)
--   amount_usd < 0  -> credit applied (to a success_fee invoice)
--   amount_usd can also be a manual adjustment (use kind = 'adjustment')
--
-- A client's available balance is SUM(amount_usd) for that client.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retainer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  kind TEXT NOT NULL CHECK (kind IN (
    'earned',       -- from a paid retainer invoice
    'applied',      -- applied to a success_fee invoice
    'expired',      -- admin decision to expire unused credit
    'adjustment'    -- manual correction
  )),

  amount_usd DECIMAL(15, 2) NOT NULL,

  -- Link back to the invoice that either generated or consumed this row.
  source_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  applied_to_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retainer_credits_client
  ON public.retainer_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_retainer_credits_source
  ON public.retainer_credits(source_invoice_id);
CREATE INDEX IF NOT EXISTS idx_retainer_credits_applied
  ON public.retainer_credits(applied_to_invoice_id);

ALTER TABLE public.retainer_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage retainer_credits" ON public.retainer_credits;
CREATE POLICY "Admins manage retainer_credits"
  ON public.retainer_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

DROP POLICY IF EXISTS "Clients view own retainer_credits" ON public.retainer_credits;
CREATE POLICY "Clients view own retainer_credits"
  ON public.retainer_credits FOR SELECT
  USING (client_id = auth.uid());


-- ------------------------------------------------------------
-- 7. OPERATING_EXPENSES — outbound cash
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operating_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  expense_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'salary',
    'tools',          -- software, Apollo, Vercel, Supabase, Resend, etc.
    'marketing',
    'office',
    'legal',
    'travel',
    'other'
  )),
  vendor TEXT,
  description TEXT,

  amount_usd DECIMAL(15, 2) NOT NULL CHECK (amount_usd >= 0),
  fx_rate_vnd_per_usd DECIMAL(12, 2),               -- optional snapshot

  -- Recurring expenses help the dashboard project run-rate.
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency TEXT CHECK (
    recurring_frequency IS NULL
    OR recurring_frequency IN ('monthly', 'quarterly', 'yearly')
  ),

  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_date
  ON public.operating_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_category
  ON public.operating_expenses(category);

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage operating_expenses" ON public.operating_expenses;
CREATE POLICY "Admins manage operating_expenses"
  ON public.operating_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin')
    )
  );


-- ============================================================
-- DONE. Quick sanity:
--   SELECT * FROM public.finance_settings;          -- 1 row
--   SELECT public.next_invoice_number();            -- e.g. ESH-2026-0001
--   SELECT * FROM public.invoice_counters;
-- ============================================================
