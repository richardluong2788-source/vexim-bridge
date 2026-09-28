-- ============================================================================
-- Migration 082: marketing_leads — lead inbound từ các form công khai
--
-- Context
-- -------
-- Form "Đăng ký tư vấn 1:1" trên landing page (app/page.tsx →
-- app/api/consultation/route.ts) hiện CHỈ gửi email nội bộ. Không có bất kỳ
-- dòng nào được ghi vào DB, nên:
--   * lead biến mất nếu email vào spam / SMTP lỗi (route trả 502, người gửi
--     thấy lỗi và thường… bỏ đi);
--   * không đo được kênh nào ra lead (utm/referrer/page_path không lưu);
--   * không có hàng đợi triage → không SLA, không ai sở hữu, không biết lead
--     đã được liên hệ hay chưa.
--
-- Vì sao KHÔNG insert thẳng vào public.leads
-- ------------------------------------------
-- `leads` là bảng BUYER (phía cung: nhà nhập khẩu Mỹ) — opportunities tham
-- chiếu lead_id, /admin/buyers + AI matching (runMatchingPipeline) và
-- has_active_inquiry (068) đều hiểu một row ở đó là "buyer cần tìm nhà cung
-- cấp". Landing page hiện tại thu request từ NHÀ MÁY VN muốn Vexim bán hàng
-- hộ — đẩy nó vào `leads` sẽ bơm ngược supplier vào pipeline matching buyer↔client.
-- Tách bảng riêng, có `audience`, để:
--   * audience='supplier' → hàng đợi của Supplier Researcher / AE (nguồn
--     cung mới cho pool),
--   * audience='buyer'    → sau này (phase marketing EN) được "convert" sang
--     public.leads + chạy matching qua đúng cổng mà submitQuoteRequest
--     (lib/profile/actions.ts) đang dùng.
--
-- Solution
-- --------
-- Bảng marketing_leads: payload đã validate + attribution (utm, referrer,
-- page_path, locale, user_agent, ip HASH không phải IP thô) + vòng đời triage
-- (status / assigned_to / notes / last_contacted_at / converted_*).
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ai đang nói với mình? Quyết định hàng đợi xử lý và việc có được convert
  -- sang public.leads hay không.
  audience TEXT NOT NULL DEFAULT 'supplier'
    CHECK (audience IN ('supplier', 'buyer', 'other')),

  -- Nguồn cụ thể. KHÔNG có CHECK: thêm landing/CTA mới không cần migration.
  -- Quy ước: landing_consultation | website_rfq | product_page | profile_page | other
  source TEXT NOT NULL,

  -- Trạng thái triage. 'new' là hàng đợi đang chờ; 'converted' = đã đưa vào
  -- hệ thống (leads/clients), 'junk' = spam/bot lọt qua honeypot.
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'contacted', 'converted', 'junk', 'archived')),

  -- Mã ngắn để tra chiếu trong email/chat (VX-1A2B3C4D). Không unique — id vẫn
  -- là khoá chính; sinh ở lib/marketing/leads.ts.
  reference TEXT,

  -- Nội dung form
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  industry TEXT,
  preferred_time TEXT,
  message TEXT,
  locale TEXT CHECK (locale IN ('vi', 'en')),

  -- Attribution — thứ đang mất hoàn toàn hôm nay
  page_path TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  user_agent TEXT,
  -- SHA-256(ip + salt + yyyy-mm-dd), cắt 32 ký tự. KHÔNG bao giờ lưu IP thô:
  -- chỉ cần để chặn spam lặp lại, không để định danh người gửi.
  ip_hash TEXT,
  -- Payload gốc sau khi zod strip — để mở rộng form mà không mất dữ liệu cũ
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Triage
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  triaged_at TIMESTAMPTZ,
  triaged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Con đường convert (nullable — set khi nhân viên kéo lead vào hệ thống)
  converted_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  converted_client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.marketing_leads IS
  'Inbound submissions from public marketing forms (landing consultation, future EN buyer RFQ). System of record for inbound demand: app/api/consultation writes here, then emails the team. NOT the buyer table — public.leads is where US buyers live; audience=''buyer'' rows get converted into leads via the same gate as lib/profile/actions.ts::submitQuoteRequest.';
COMMENT ON COLUMN public.marketing_leads.audience IS
  'supplier = nhà máy VN muốn Vexim bán hàng hộ (hàng đợi của SR/AE) | buyer = nhà nhập khẩu Mỹ (convert sang public.leads + chạy matching) | other';
COMMENT ON COLUMN public.marketing_leads.source IS
  'Điểm chạm tạo ra lead. Không có CHECK — thêm kênh mới không cần migration. Quy ước: landing_consultation (form tư vấn 1:1), website_rfq, product_page, profile_page.';
COMMENT ON COLUMN public.marketing_leads.ip_hash IS
  'SHA-256 of client IP + MARKETING_LEAD_IP_SALT + UTC date, truncated. Anti-abuse signal only; raw IP is deliberately never stored, and the salt-then-date rotation means rows cannot be joined into a long-lived profile.';
COMMENT ON COLUMN public.marketing_leads.status IS
  'new (chờ xử lý) | in_review | contacted | converted (đã vào leads/clients) | junk | archived';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Chốt chặn spam cuối cùng: tối đa MỘT row 'new' cho mỗi (email, source).
-- Bot gửi form 50 lần → 1 hàng đợi duy nhất; sau khi nhân viên chuyển
-- status (contacted/junk/…) thì người thật gửi lại sẽ tạo row mới bình thường.
-- Route cũng check trước để không gửi email xác nhận trùng — index này là
-- backstop cho race giữ 2 worker.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_leads_open_dedupe_idx
  ON public.marketing_leads (lower(email), source)
  WHERE status = 'new' AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_leads_queue_idx
  ON public.marketing_leads (status, audience, created_at DESC);

-- "Kênh nào ra lead" — report theo source theo thời gian.
CREATE INDEX IF NOT EXISTS marketing_leads_source_idx
  ON public.marketing_leads (source, created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_leads_email_idx
  ON public.marketing_leads (lower(email));

CREATE INDEX IF NOT EXISTS marketing_leads_reference_idx
  ON public.marketing_leads (reference);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Đọc được: các role vận hành. Loại trừ rõ `client` (nhà cung cấp không thấy
-- nhau) và `finance`. Ghi chú: app đọc/ghi qua service-role client
-- (createAdminClient) nên policy này là backstop, giống 063.
DROP POLICY IF EXISTS marketing_leads_ops_read ON public.marketing_leads;
CREATE POLICY marketing_leads_ops_read
  ON public.marketing_leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'staff',
                       'supplier_researcher', 'lead_researcher')
    )
  );

-- Cập nhật triage: chỉ role được giao việc xử lý hàng đợi.
DROP POLICY IF EXISTS marketing_leads_ops_update ON public.marketing_leads;
CREATE POLICY marketing_leads_ops_update
  ON public.marketing_leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'staff',
                       'supplier_researcher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'staff',
                       'supplier_researcher')
    )
  );

-- KHÔNG có policy INSERT: công chúng ghi qua API route dùng service-role key.
-- Vì vậy form không thể tự tạo quyền truy cập, và anon không bao giờ insert
-- thẳng được dù route bị lộ.

-- Rollback (nếu cần):
-- DROP TABLE IF EXISTS public.marketing_leads;

-- ============================================================================
-- DONE
-- ============================================================================
