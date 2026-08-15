-- Migration 048: Theo dõi liên hệ khi buyer reply tu mot dia chi khac (gioi thieu ngang)
--
-- Bo sung cho buyer_contacts (047): khi mot buyer reply tu email KHONG co trong
-- danh ba buyer_contacts, AE can duoc canh bao va xac nhan them lien he moi
-- thay vi he thong tu dong bo qua hoac tao nham.
--
-- matched_contact_id: lien he trong danh ba khop voi from_email cua reply nay
--   (NULL neu from_email chua tung xuat hien trong buyer_contacts).
-- is_unrecognized_sender: true khi email nguoi gui KHONG co trong buyer_contacts
--   cua lead nay (nhung van khop opportunity qua In-Reply-To) -> can AE xac nhan.

ALTER TABLE public.buyer_replies
  ADD COLUMN IF NOT EXISTS matched_contact_id UUID REFERENCES public.buyer_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_unrecognized_sender BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_buyer_replies_matched_contact ON public.buyer_replies(matched_contact_id);
CREATE INDEX IF NOT EXISTS idx_buyer_replies_unrecognized ON public.buyer_replies(is_unrecognized_sender) WHERE is_unrecognized_sender = true;

COMMENT ON COLUMN public.buyer_replies.matched_contact_id IS
  'Lien he trong buyer_contacts khop voi from_email cua reply nay (NULL neu email la nguoi la).';
COMMENT ON COLUMN public.buyer_replies.is_unrecognized_sender IS
  'True khi buyer reply tu email chua co trong danh ba buyer_contacts (co the la nguoi duoc gioi thieu sang) - AE can xac nhan/them lien he moi.';
