-- ============================================================
-- 047: buyer_contacts — Đa liên hệ / đa phòng ban cho công ty buyer
-- ============================================================
-- Mot buyer (leads) co the co nhieu lien he: nhieu phong ban,
-- nhieu dai dien theo thi truong (cong ty da quoc gia), va chuoi
-- "gioi thieu sang nguoi khac". Bang nay khong lam vo du lieu cu:
-- leads.contact_* van duoc giu dong bo voi lien he primary.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  department TEXT,
  market_region TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_decision_maker BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved', 'inactive')),
  referred_by_contact_id UUID REFERENCES public.buyer_contacts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_contacts_lead_id ON public.buyer_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_email ON public.buyer_contacts(lower(email));
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_referred_by ON public.buyer_contacts(referred_by_contact_id);

-- Chi co toi da 1 lien he primary cho moi lead
CREATE UNIQUE INDEX IF NOT EXISTS uniq_buyer_contacts_primary_per_lead
  ON public.buyer_contacts(lead_id)
  WHERE is_primary = true;

ALTER TABLE public.buyer_contacts ENABLE ROW LEVEL SECURITY;

-- Noi bo Vexim (admin/staff/super_admin/account_executive/lead_researcher)
-- duoc doc-ghi toan bo. KHONG cho client doc truc tiep (giong R-07: PII buyer
-- bi mask cho client qua client_leads_masked).
DROP POLICY IF EXISTS "Internal staff manage buyer_contacts" ON public.buyer_contacts;
CREATE POLICY "Internal staff manage buyer_contacts"
  ON public.buyer_contacts FOR ALL
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

CREATE OR REPLACE FUNCTION public.update_buyer_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buyer_contacts_updated_at ON public.buyer_contacts;
CREATE TRIGGER trigger_buyer_contacts_updated_at
  BEFORE UPDATE ON public.buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_buyer_contacts_updated_at();

COMMENT ON TABLE public.buyer_contacts IS
  'Nhieu lien he / phong ban / dai dien thi truong cho mot buyer (leads). '
  'Ho tro chuoi gioi thieu qua referred_by_contact_id. Noi bo Vexim, khong public.';

-- ============================================================
-- Data migration: copy leads.contact_* hien co -> buyer_contacts primary
-- ============================================================
INSERT INTO public.buyer_contacts (lead_id, full_name, title, email, phone, is_primary, is_decision_maker, status, created_by)
SELECT
  l.id,
  COALESCE(l.contact_person, 'Chưa rõ tên'),
  l.contact_title,
  l.contact_email,
  l.contact_phone,
  true,
  true,
  'active',
  l.created_by
FROM public.leads l
WHERE (l.contact_person IS NOT NULL OR l.contact_email IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.buyer_contacts bc WHERE bc.lead_id = l.id
  );

-- ============================================================
-- email_drafts: them cot cc_emails de gui kem CC nhieu lien he
-- ============================================================
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS cc_emails TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.email_drafts.cc_emails IS
  'Danh sach email CC bo sung tu buyer_contacts khi gui email.';
