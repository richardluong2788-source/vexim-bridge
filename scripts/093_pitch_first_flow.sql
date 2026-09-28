-- ============================================================================
-- Migration 093: Pitch-first flow (Phase 1) — "1 đề xuất chính + ghế dự bị"
-- ============================================================================
-- Thay đổi tư duy gửi supplier cho buyer: KHÔNG gửi danh sách Option A/B/C
-- làm mặc định nữa — buyer không mua danh sách, buyer cần Vexim CHỌN GIÚP.
-- Mỗi lần gửi = 1 PRIMARY (buyer thấy duy nhất) + BENCH (ghế dự bị, AE giữ,
-- buyer KHÔNG THẤY). Flow danh sách cũ được giữ làm ngoại lệ (role 'option').
--
-- Additive-only:
--   1. buyer_engagement_shortlist_items.role      — 'option' (legacy) | 'primary' | 'bench'
--   2. buyer_engagement_shortlist_versions.pitch_note — ghi chú "vì sao tôi
--      đề xuất nhà máy này" (AI soạn theo match reasoning, AE duyệt/sửa)
--   3. buyer_action thêm giá trị 'declined' — buyer bấm "Not the right fit"
--      ngay trên trang share → AE dùng gate chặn re-pitch supplier đã chê.
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. role trên item -----------------------------------------------------------
ALTER TABLE public.buyer_engagement_shortlist_items
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'option';

ALTER TABLE public.buyer_engagement_shortlist_items
  DROP CONSTRAINT IF EXISTS buyer_engagement_shortlist_items_role_check;

ALTER TABLE public.buyer_engagement_shortlist_items
  ADD CONSTRAINT buyer_engagement_shortlist_items_role_check
  CHECK (role IN ('primary', 'bench', 'option'));

COMMENT ON COLUMN public.buyer_engagement_shortlist_items.role IS
  'Pitch-first flow (migration 093): primary = the ONE supplier shown to the buyer in a pitch; bench = AE-held alternates, NEVER rendered on the buyer-facing share page; option = legacy comparison-list item (pre-093 rows default here).';

CREATE INDEX IF NOT EXISTS idx_shortlist_items_role
  ON public.buyer_engagement_shortlist_items(version_id, role);

-- 2. pitch_note trên version --------------------------------------------------
ALTER TABLE public.buyer_engagement_shortlist_versions
  ADD COLUMN IF NOT EXISTS pitch_note TEXT;

COMMENT ON COLUMN public.buyer_engagement_shortlist_versions.pitch_note IS
  'Buyer-facing "why I recommend this factory" note for pitch-mode versions (role=primary items). AI-drafted from match reasoning, AE-reviewed before send. Null for legacy comparison-list versions.';

-- 3. buyer_action thêm 'declined' --------------------------------------------
ALTER TABLE public.buyer_engagement_shortlist_items
  DROP CONSTRAINT IF EXISTS buyer_engagement_shortlist_items_buyer_action_check;

ALTER TABLE public.buyer_engagement_shortlist_items
  ADD CONSTRAINT buyer_engagement_shortlist_items_buyer_action_check
  CHECK (buyer_action IS NULL OR buyer_action IN (
    'viewed_only', 'interested_no_details', 'requested_info',
    'requested_sample', 'requested_meeting', 'requested_order_discussion',
    'selected_primary', 'sent_price_volume', 'sent_po',
    'declined'
  ));

COMMENT ON COLUMN public.buyer_engagement_shortlist_items.buyer_action IS
  'Buyer reaction to THIS supplier on THIS version. 093 adds declined = buyer explicitly passed on this supplier (share-page button or AE record); declined suppliers are blocked from re-pitching the same engagement (re-pitch gate in buildShortlist).';
