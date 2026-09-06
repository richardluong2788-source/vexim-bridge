-- ============================================================================
-- Migration 069: Supplier Researcher role (SR)
-- ============================================================================
-- Tách bộ phận tìm supplier khỏi AE, đối xứng với Lead Researcher (LR) ở
-- phía buyer:
--
--   LR  (lead_researcher)    → tìm & nhập BUYER vào hệ thống
--   SR  (supplier_researcher)→ tìm & qualification SUPPLIER (client) vào hệ thống
--   AE  (account_executive)  → chỉ nhận dữ liệu 2 đầu và kết nối buyer ↔ supplier
--
-- App-layer capability map: lib/auth/permissions.ts
--   SR = CLIENT_VIEW + CLIENT_WRITE + OWNERSHIP_BYPASS (pool-wide read).
--   SR KHÔNG có: BUYER_VIEW, DEAL_VIEW, MATCH_INBOX_VIEW, FINANCE_*, ...
--
-- Migration này chỉ làm phần DATABASE:
--   1. Mở rộng CHECK constraint trên profiles.role (+ RLS SELECT cho SR trên
--      profiles, vì trang chi tiết client đọc qua session client).
--   2. RLS SELECT cho SR trên compliance_docs + tokenized share links
--      (trang chi tiết supplier cần hiển thị hồ sơ pháp lý / link chia sẻ).
-- Idempotent — chạy nhiều lần không lỗi.

-- ---------------------------------------------------------------------------
-- 1. CHECK constraint: cho phép giá trị role mới
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'super_admin',
    'admin',
    'account_executive',
    'lead_researcher',
    'supplier_researcher',
    'finance',
    'client',
    -- Legacy — kept to avoid breaking old rows; new users must NOT use this.
    'staff'
  ));

COMMENT ON COLUMN public.profiles.role IS
  'RBAC role. Canonical values: super_admin, admin, account_executive, lead_researcher, supplier_researcher, finance, client. Legacy "staff" is kept for backward compatibility but mapped to account_executive in the app layer.';

-- ---------------------------------------------------------------------------
-- 2. profiles: SR đọc toàn bộ profiles (supplier pool).
--    Policy "Admins can view all profiles" (20260422) chỉ cho
--    admin/staff/super_admin — nhưng trang /admin/clients/[id] đọc profile
--    bằng session client (RLS áp dụng thật), nên SR cần thêm ở đây.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.get_current_user_role() = any (array[
      'admin', 'staff', 'super_admin', 'supplier_researcher'
    ])
  );

-- ---------------------------------------------------------------------------
-- 3. compliance_docs: SR chỉ ĐỌC (qualification hồ sơ pháp lý supplier).
--    Không cho INSERT/UPDATE/DELETE — ghi đè lên policy FOR ALL của 009
--    bằng policy SELECT riêng.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers view compliance_docs" ON public.compliance_docs;
CREATE POLICY "Supplier researchers view compliance_docs"
  ON public.compliance_docs
  FOR SELECT
  USING (
    public.get_current_user_role() = 'supplier_researcher'
  );

-- ---------------------------------------------------------------------------
-- 4. tokenized_share_links + tokenized_share_link_docs: SR chỉ ĐỌC
--    (trang chi tiết supplier render danh sách link chia sẻ).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers view share_links" ON public.tokenized_share_links;
CREATE POLICY "Supplier researchers view share_links"
  ON public.tokenized_share_links
  FOR SELECT
  USING (
    public.get_current_user_role() = 'supplier_researcher'
  );

DROP POLICY IF EXISTS "Supplier researchers view share_link_docs" ON public.tokenized_share_link_docs;
CREATE POLICY "Supplier researchers view share_link_docs"
  ON public.tokenized_share_link_docs
  FOR SELECT
  USING (
    public.get_current_user_role() = 'supplier_researcher'
  );

-- ---------------------------------------------------------------------------
-- 5. client_intake_submissions: SR đọc toàn bộ queue "Hồ sơ chờ duyệt"
--    (supplier tự nộp qua link) — SR là chủ pipeline supplier.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_intake_supplier_researcher_read_all"
  ON client_intake_submissions;
CREATE POLICY "client_intake_supplier_researcher_read_all"
  ON client_intake_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'supplier_researcher'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. client_products: SR chỉ ĐỌC danh mục sản phẩm của supplier.
--    Trang chi tiết supplier (/admin/clients/[id]/profile) đọc qua session
--    client nên cần policy này — thiếu nó SR sẽ thấy danh sách sản phẩm rỗng
--    dù vẫn thêm/sửa được qua products-actions (service-role + CLIENT_WRITE).
--    Danh mục sản phẩm chính là dữ liệu AI dùng để shortlist supplier
--    (getAIMatchedClients) — SR phải thấy được khi qualification.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier researchers view client_products"
  ON public.client_products;
CREATE POLICY "Supplier researchers view client_products"
  ON public.client_products
  FOR SELECT
  USING (
    public.get_current_user_role() = 'supplier_researcher'
  );

-- Lưu ý: app-layer (requireCap / role checks) là cổng chính; RLS ở đây chỉ
-- là defense-in-depth cho các đường đọc bằng session client.
