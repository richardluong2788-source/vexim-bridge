-- ============================================================================
-- Migration 071: Retire các giai đoạn "new" / "contacted" khỏi pipeline board
--
-- Bối cảnh (audit pipeline, 09/2026):
--   1. Deal sinh ra từ engagement flow đã được tạo ở "sample_requested"
--      (migration logic trong code, commit trước) — buyer lúc đó đã trao đổi
--      sâu, nên "new"/"contacted" là 2 giai đoạn chết.
--   2. Form báo giá công khai (profile page / product page) trước đây tạo
--      opportunity trực tiếp ở stage "new" — bypass matching + engagement.
--      Giờ đã chuyển qua AI matching: lead → AE inbox → engagement → deal,
--      đúng MỘT cổng vào duy nhất cho pipeline.
--
-- Hệ quả: không còn dòng chảy nào tạo deal ở "new"/"contacted". UI đã bỏ
-- 2 cột này khỏi Kanban board, dashboard, analytics, weekly report.
--
-- Migration này dồn dữ liệu cũ về đúng chỗ: mọi deal đang nằm ở
-- "new"/"contacted" thực chất đã được liên lạc (luồng cũ) → "sample_requested".
--
-- LƯU Ý: KHÔNG xóa giá trị khỏi CHECK constraint / type — giữ phòng thủ
-- cho dữ liệu lịch sử không lường trước; UI không hiển thị nữa.
-- ============================================================================

-- 1) Dồn deal cũ về "sample_requested" (kèm bump last_updated để không bị
--    detector "deal kẹt 7 ngày" báo oan ngay sau migration)
UPDATE public.opportunities
SET stage = 'sample_requested',
    last_updated = NOW()
WHERE stage IN ('new', 'contacted');

-- 2) Vệ sinh: thông báo cho ai theo dõi số liệu (không bắt buộc)
--    (chỉ COMMENT — không có tác dụng phụ)
-- Sau migration: mọi deal mở đều nằm ở sample_requested .. shipped.
