-- ============================================================================
-- Migration 068: Buyer "active inquiry" (nhu cầu thực tế từ bên ngoài)
--
-- Context
-- -------
-- Trước đây form "Thêm Lead" (/admin/leads/new) của Lead Researcher được
-- thiết kế cho buyer NGHIÊN CỨU (sourced từ ImportYeti). Khi một buyer
-- chủ động có NHU CẦU THỰC TẾ (email trực tiếp, điện thoại, Zalo, hội chợ,
-- giới thiệu...), LR không có chỗ nhập cấu trúc — chỉ nhét được vào ghi chú.
--
-- Solution
-- --------
-- Thêm 1 nhóm cột "active inquiry" trên bảng leads:
--   * has_active_inquiry — đánh dấu buyer đang có nhu cầu thật (vs research)
--   * inquiry_products / inquiry_quantity / inquiry_target_price /
--     inquiry_timeline / inquiry_channel / inquiry_notes — chi tiết nhu cầu
--   * inquiry_received_at — thời điểm đội ngũ nhận được nhu cầu
--
-- Downstream effects (xem code):
--   * leads.source = 'direct_inquiry' khi có nhu cầu thực (set bởi action,
--     không phải DB trigger — giữ logic ở 1 chỗ).
--   * AI matching: calculatePriorityBonus() cho điểm tối đa khi
--     has_active_inquiry = TRUE (lib/matching/scorer.ts).
--   * AE inbox: hiện badge "Có nhu cầu ngay" + chi tiết nhu cầu.
--   * claimBuyer(): tự đổ inquiry vào buyer_engagements (requested_products,
--     moq, target_price_range...) để AE khỏi hỏi lại những gì đã biết.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS has_active_inquiry boolean NOT NULL DEFAULT false;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_products text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_quantity text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_target_price text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_timeline text;

-- Kênh nhu cầu đến từ đâu (không phải kênh research)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_channel text
  CHECK (inquiry_channel IN (
    'email', 'phone', 'zalo', 'whatsapp', 'linkedin',
    'trade_fair', 'referral', 'other'
  ));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_notes text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS inquiry_received_at timestamptz;

-- Fast lookup: "buyer đang có nhu cầu thực" cho dashboard / rematch jobs.
CREATE INDEX IF NOT EXISTS leads_active_inquiry_idx
  ON public.leads (has_active_inquiry, inquiry_received_at DESC)
  WHERE has_active_inquiry;

COMMENT ON COLUMN public.leads.has_active_inquiry IS
  'TRUE khi buyer chủ động có nhu cầu thực tế (direct inquiry từ bên ngoài — '
  'email/phone/Zalo/hội chợ/giới thiệu), ngược với buyer thuần research '
  '(ImportYeti/bulk_import). Set cùng lúc leads.source = ''direct_inquiry''.';

COMMENT ON COLUMN public.leads.inquiry_channel IS
  'Kênh nhận nhu cầu: email | phone | zalo | whatsapp | linkedin | trade_fair | referral | other';

-- Rollback (nếu cần):
-- ALTER TABLE public.leads
--   DROP COLUMN IF EXISTS has_active_inquiry,
--   DROP COLUMN IF EXISTS inquiry_products,
--   DROP COLUMN IF EXISTS inquiry_quantity,
--   DROP COLUMN IF EXISTS inquiry_target_price,
--   DROP COLUMN IF EXISTS inquiry_timeline,
--   DROP COLUMN IF EXISTS inquiry_channel,
--   DROP COLUMN IF EXISTS inquiry_notes,
--   DROP COLUMN IF EXISTS inquiry_received_at;
