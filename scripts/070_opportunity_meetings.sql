-- ============================================================================
-- Migration 070: opportunity_meetings — Cuộc gặp & Tham quan gắn với deal
--
-- Bối cảnh: khi buyer nghiêm túc, luồng thực địa là gần như bắt buộc:
--   - Video call với nhà máy (qualification từ xa)
--   - Buyer trip: buyer sang VN, AE + SR dẫn tham quan nhà máy
-- Đây là SỰ KIỆN có lịch, không phải giai đoạn pipeline — một deal có thể
-- có nhiều cuộc gặp rải ở nhiều giai đoạn khác nhau. Nên tách bảng riêng,
-- gắn opportunity_id, hiển thị: badge trên thẻ Kanban + section riêng
-- trong sheet chi tiết deal + dải "sắp tới" trên trang Pipeline.
--
-- Lưu ý RLS: app đọc/ghi qua service-role client (bypass RLS) trong server
-- actions; policy bên dưới chỉ canh trực tiếp từ client (anon key) theo
-- đúng pattern 051 (AE chủ sở hữu + admin).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  -- Loại cuộc gặp:
  --   video_call    — gọi video với nhà máy / buyer (qualification từ xa)
  --   factory_tour  — dẫn buyer tham quan nhà máy (SR/AE đi cùng)
  --   buyer_trip    — chuyến buyer sang VN (nhiều điểm đến)
  --   meeting       — họp trực tiếp / online thông thường
  --   trade_fair    — gặp tại hội chợ triển lãm
  kind TEXT NOT NULL DEFAULT 'meeting'
    CHECK (kind IN ('video_call', 'factory_tour', 'buyer_trip', 'meeting', 'trade_fair')),
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  -- Ghi nhận sau khi cuộc gặp diễn ra (kết quả, cảm nhận buyer, bước tiếp theo)
  outcome TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_meetings_opp
  ON public.opportunity_meetings(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_meetings_scheduled
  ON public.opportunity_meetings(scheduled_at);

ALTER TABLE public.opportunity_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AE manage meetings on own opportunities" ON public.opportunity_meetings;
CREATE POLICY "AE manage meetings on own opportunities"
  ON public.opportunity_meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_meetings.opportunity_id
        AND o.account_manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_meetings.opportunity_id
        AND o.account_manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'super_admin')
    )
  );
