-- ============================================================================
-- Migration 081: FDA Pending Supplement Status & AE Sourcing Support
-- ============================================================================
-- Bối cảnh:
--   1. AE chủ động tiếp cận Buyer trước khi có sẵn dữ liệu Supplier.
--   2. Sau khi nhận RFQ từ Buyer, AE tự tìm kiếm nhà cung cấp và nạp vào hệ thống.
--   3. Nhà cung cấp có thể đang trong quá trình làm FDA ("Đang bổ sung" /
--      pending_supplement) — nhà xưởng cam kết hoàn thiện khi chốt đơn.
--   4. Trạng thái "Đang bổ sung" vẫn đủ điều kiện (eligible) để AI phân tích,
--      chấm điểm và cho phép AE chọn vào Shortlist gửi Buyer.
--   5. Trigger enforce_fda_for_opportunity được cập nhật để cho phép các deal
--      đang trong giai đoạn thương thảo / đàm phán (sample, negotiation, etc.)
--      đối với nhà cung cấp có trạng thái FDA "pending_supplement".
--
-- Idempotent — an toàn để chạy lại nhiều lần.
-- ============================================================================

-- 1. Thêm cột fda_status vào bảng profiles nếu chưa có
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fda_status TEXT DEFAULT 'missing';

COMMENT ON COLUMN public.profiles.fda_status IS
  'Trạng thái FDA: valid (hợp lệ), expired (hết hạn), expiring_soon (sắp hết hạn), pending_supplement (đang bổ sung hồ sơ), missing (chưa có)';

-- 2. Cập nhật trigger enforce_fda_for_opportunity
--    Cho phép cơ hội tiến triển nếu supplier có fda_status = 'pending_supplement'
--    hoặc fda_registration_number ghi nhận PENDING / ĐANG BỔ SUNG.
CREATE OR REPLACE FUNCTION public.enforce_fda_for_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Giai đoạn đầu và giai đoạn thương thảo sơ bộ không chặn
  IF NEW.stage IS NULL OR NEW.stage IN ('new', 'contacted') THEN
    RETURN NEW;
  END IF;

  -- Cho phép nếu supplier có trạng thái Đang bổ sung FDA hoặc có số đăng ký PENDING
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND (
        fda_status = 'pending_supplement'
        OR fda_registration_number ILIKE 'PENDING%'
        OR fda_registration_number ILIKE 'DANG_BO_SUNG%'
        OR fda_registration_number ILIKE 'ĐANG BỔ SUNG%'
      )
  ) THEN
    RETURN NEW;
  END IF;

  -- Kiểm tra đã có số FDA
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND fda_registration_number IS NOT NULL
      AND length(btrim(fda_registration_number)) > 0
  ) THEN
    RAISE EXCEPTION 'FDA_REQUIRED: client has no FDA number on file'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Kiểm tra hạn FDA
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.client_id
      AND fda_expires_at IS NOT NULL
      AND fda_expires_at < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'FDA_EXPIRED: client FDA registration has expired'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
