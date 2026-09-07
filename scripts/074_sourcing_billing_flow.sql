-- ============================================================================
-- Migration 074: Supplier Researcher — billing proposal & collections
-- ============================================================================
-- Business flow: SR chốt điều khoản thương mại với supplier (client) và ĐỀ
-- XUẤT hợp đồng (billing plan) ở trạng thái draft; Finance DUYỆT & kích hoạt,
-- phát hành hoá đơn và mark paid; SR theo dõi hoá đơn của supplier mình đưa
-- vào để đốc thu.
--
-- App-layer capability map (lib/auth/permissions.ts):
--   SR += BILLING_PLAN_PROPOSE (draft only), INVOICE_VIEW_OWN (read-only).
--   Finance giữ nguyên BILLING_PLAN_WRITE / INVOICE_WRITE.
--
-- Migration này chỉ làm phần DATABASE (idempotent):
--   1. profiles.sourced_by — ghi lại SR nào đã mang supplier này vào.
--   2. billing_plans.status thêm 'draft' + cột approved_by / approved_at.
--   3. RLS cho SR trên billing_plans (propose/đọc) và invoices (đọc),
--      dùng public.get_current_user_role() (SECURITY DEFINER, migration 003)
--      để tránh recursion — đồng bộ với pattern migration 069/072/073.
--   4. Sửa policy "Admins manage billing_plans/invoices" để thêm role finance
--      (thiếu sót từ migration 016 — các policy này chỉ ghi admin/staff/
--      super_admin/account_executive dù finance có đủ cap ở app layer).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.sourced_by
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sourced_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_sourced_by
  ON public.profiles(sourced_by)
  WHERE sourced_by IS NOT NULL;

COMMENT ON COLUMN public.profiles.sourced_by IS
  'Supplier Researcher (SR) who sourced/onboarded this client. Set at client creation. Drives SR billing-proposal + collections scope.';

-- ---------------------------------------------------------------------------
-- 2. billing_plans: draft status + approval columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_status_check;
ALTER TABLE public.billing_plans
  ADD CONSTRAINT billing_plans_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'terminated'));

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.billing_plans.status IS
  'draft = SR proposed, awaiting Finance approval; active = approved, cron bills monthly retainer; paused/terminated = inactive.';
COMMENT ON COLUMN public.billing_plans.approved_by IS
  'Finance/admin user who approved the draft plan into active.';
COMMENT ON COLUMN public.billing_plans.approved_at IS
  'When the draft plan was approved.';

-- ---------------------------------------------------------------------------
-- 3. RLS: SR propose + read billing_plans (defense-in-depth; app writes via
--    service role today, but keep DB aligned with the app-layer decision).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers propose billing_plans"
  ON public.billing_plans;
CREATE POLICY "Supplier researchers propose billing_plans"
  ON public.billing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_user_role() = 'supplier_researcher'
    AND status = 'draft'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles c
      WHERE c.id = client_id AND c.sourced_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Supplier researchers view own billing_plans"
  ON public.billing_plans;
CREATE POLICY "Supplier researchers view own billing_plans"
  ON public.billing_plans
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'supplier_researcher'
    AND EXISTS (
      SELECT 1 FROM public.profiles c
      WHERE c.id = client_id AND c.sourced_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. RLS: SR read invoices of sourced clients (đốc thu)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers view own invoices"
  ON public.invoices;
CREATE POLICY "Supplier researchers view own invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'supplier_researcher'
    AND EXISTS (
      SELECT 1 FROM public.profiles c
      WHERE c.id = client_id AND c.sourced_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Fix: finance role missing from the 016-era manage policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage billing_plans" ON public.billing_plans;
CREATE POLICY "Admins manage billing_plans"
  ON public.billing_plans FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = any (
      array['admin', 'staff', 'super_admin', 'account_executive', 'finance']
    )
  )
  WITH CHECK (
    public.get_current_user_role() = any (
      array['admin', 'staff', 'super_admin', 'account_executive', 'finance']
    )
  );

DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (
    public.get_current_user_role() = any (
      array['admin', 'staff', 'super_admin', 'account_executive', 'finance']
    )
  )
  WITH CHECK (
    public.get_current_user_role() = any (
      array['admin', 'staff', 'super_admin', 'account_executive', 'finance']
    )
  );
