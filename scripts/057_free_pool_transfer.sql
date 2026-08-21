-- 057_free_pool_transfer.sql
-- "Kho tự do": cho phép AE trả một buyer đã claim về kho chung để AE khác
-- tự nhận, khi buyer hỏi sản phẩm không khớp với client mà AE đang quản lý.
--
-- Tái dùng cơ chế fan-out "mở cho mọi AE, ai nhận trước được" đã có sẵn cho
-- buyer mới không có AE cùng ngành (xem lib/matching/orchestrator.ts).
--
-- Idempotent: an toàn khi chạy lại nhiều lần.

-- 1. ae_match_inbox: thêm cờ nhận biết "dòng này sinh ra từ việc AE trả buyer
--    về kho tự do" (khác với dòng sinh ra từ AI/LR phân bổ buyer mới).
alter table public.ae_match_inbox
  add column if not exists transferred_from_ae_id uuid references public.profiles(id) on delete set null,
  add column if not exists transfer_reason text;

create index if not exists idx_ae_match_inbox_transferred_from
  on public.ae_match_inbox (transferred_from_ae_id)
  where transferred_from_ae_id is not null;

-- 2. buyer_engagements: thêm stage 'returned_to_pool' (AE trả buyer về kho
--    tự do) — khác với 'dropped' (AE bỏ hẳn buyer, không ai xử lý tiếp).
alter table public.buyer_engagements
  drop constraint if exists buyer_engagements_stage_check;

alter table public.buyer_engagements
  add constraint buyer_engagements_stage_check
  check (stage = any (array[
    'claimed',
    'requirement_email_sent',
    'requirements_received',
    'shortlist_ready',
    'shortlist_sent',
    'buyer_viewed',
    'buyer_responded',
    'qualified_interest',
    'converted',
    'dropped',
    'returned_to_pool'
  ]));

-- 3. Cập nhật unique index "1 lead chỉ có 1 engagement active tại 1 thời điểm"
--    để buyer đã 'returned_to_pool' được coi là không còn ai active xử lý,
--    cho phép AE khác tạo engagement mới khi nhận từ kho tự do.
drop index if exists idx_buyer_engagements_active_lead;

create unique index idx_buyer_engagements_active_lead
  on public.buyer_engagements (lead_id)
  where stage not in ('converted', 'dropped', 'returned_to_pool');
