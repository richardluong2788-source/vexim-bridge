-- ============================================================
-- 050: buyer_intel_notes — Ghi nhan thong tin AE thu duoc khi
-- lien lac truc tiep voi buyer (gia, thanh toan, ho so, kiem nghiem)
-- ============================================================
-- He thong hien tai chi phan tich tot du lieu QUA KHU cua buyer
-- (ImportYeti: health score, loyalty, HS code...). Thong tin "song"
-- ma AE thu duoc SAU KHI goi/chat voi buyer - gia da trao doi, chinh
-- sach thanh toan, ho so/chung tu buyer yeu cau, kiem nghiem - chua
-- co noi ghi nhan co cau truc. Bang nay la append-only log gan theo
-- tung Opportunity (deal), giu lai lich su day du qua nhieu lan
-- lien lac, khong chi gia tri moi nhat.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyer_intel_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('pricing', 'payment', 'documents', 'testing', 'general')),
  raw_note TEXT NOT NULL,
  ai_summary TEXT,
  ai_extracted JSONB,
  applied_to_opportunity BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_intel_notes_opportunity
  ON public.buyer_intel_notes(opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_buyer_intel_notes_category
  ON public.buyer_intel_notes(opportunity_id, category, created_at DESC);

ALTER TABLE public.buyer_intel_notes ENABLE ROW LEVEL SECURITY;

-- Noi bo Vexim (admin/staff/super_admin/account_executive/lead_researcher)
-- duoc doc-ghi toan bo. KHONG cho client doc truc tiep - day la ghi chu
-- noi bo nhay cam ve gia/dam phan, giong pattern buyer_contacts (047).
DROP POLICY IF EXISTS "Internal staff manage buyer_intel_notes" ON public.buyer_intel_notes;
CREATE POLICY "Internal staff manage buyer_intel_notes"
  ON public.buyer_intel_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'staff', 'account_executive', 'lead_researcher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'staff', 'account_executive', 'lead_researcher')
    )
  );

COMMENT ON TABLE public.buyer_intel_notes IS
  'Log append-only cac ghi nhan cua AE sau khi lien lac truc tiep voi buyer: '
  'gia, chinh sach thanh toan, ho so/chung tu, kiem nghiem. AI tu phan loai va '
  'tom tat, AE tu bam Ap dung de ghi de field cau truc tren opportunities. '
  'Noi bo Vexim, khong public, khong cho client doc.';
