-- ============================================================================
-- 094 — Pitch-first Phase 1.5: structured decline reasons
-- ============================================================================
-- Bối cảnh: 093 thêm buyer_action='declined' (buyer bấm "This one isn't the
-- right fit" trên share page). Buyer KHÔNG bị hỏi "không phù hợp ở điểm nào"
-- → AE không có dữ liệu để (a) pitch supplier phù hợp hơn ở vòng sau,
-- (b) giải thích cho supplier bị chê.
--
-- Migration này THÊM 2 cột optional trên items — KHÔNG bắt buộc, buyer vẫn
-- decline được mà không chọn lý do (signal thô vẫn về). Additive-only.
--
-- Idempotent: chạy lại không lỗi, không mất dữ liệu.
-- ============================================================================

-- 1. decline_reason — quick-pick do buyer chọn (hoặc null nếu bỏ qua) --------
ALTER TABLE public.buyer_engagement_shortlist_items
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_shortlist_items_decline_reason'
      AND conrelid = 'public.buyer_engagement_shortlist_items'::regclass
  ) THEN
    ALTER TABLE public.buyer_engagement_shortlist_items
      ADD CONSTRAINT chk_shortlist_items_decline_reason CHECK (
        decline_reason IS NULL OR decline_reason IN (
          'products_mismatch',    -- Sản phẩm không khớp lĩnh vực mình nhập
          'price_moq',            -- Giá / MOQ không phù hợp
          'missing_certs',        -- Thiếu chứng nhận yêu cầu
          'existing_supplier',    -- Đã có supplier tương tự
          'other'                 -- Khác (kèm ghi chú tự do)
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.buyer_engagement_shortlist_items.decline_reason IS
  'Structured decline reason picked by the buyer on the share page (optional — buyer can decline without picking one). Feeds AE pitch learning now, AI re-ranking in Phase 2. NULL = declined without a reason.';

-- 2. decline_reason_note — ghi chú tự do tuỳ chọn ----------------------------
ALTER TABLE public.buyer_engagement_shortlist_items
  ADD COLUMN IF NOT EXISTS decline_reason_note TEXT;

COMMENT ON COLUMN public.buyer_engagement_shortlist_items.decline_reason_note IS
  'Optional free-text from the buyer when declining ("Other" or extra context). Never shown to the declined supplier automatically — AE reads it and decides.';
