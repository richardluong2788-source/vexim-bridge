-- ============================================================
-- 012 · Nâng user hocluongvan88@gmail.com lên role 'admin'
-- ============================================================
-- Điều kiện:
--   • Bảng public.profiles có cột role với CHECK IN
--     ('admin','staff','client','super_admin','lead_researcher','account_executive')
--     (được thiết lập trong 001 + 002).
--   • Profile thường được tạo tự động khi user đăng ký qua Supabase Auth.
--     Nếu chưa có profile, script sẽ insert mới.
-- ============================================================

-- 1) UPSERT profile + promote role. Dùng UUID từ auth.users để đảm bảo
--    khớp với session Supabase khi đăng nhập.
INSERT INTO public.profiles (id, full_name, role)
VALUES (
  '39017b0e-50d8-4e7d-9197-f1d8f6aba107',
  'hocluongvan88',   -- fallback nếu profile chưa tồn tại; sẽ không ghi đè nếu đã có
  'admin'
)
ON CONFLICT (id) DO UPDATE
   SET role = 'admin';

-- 2) Verify — chạy kèm để xem kết quả ngay trong console.
SELECT id, full_name, role, created_at
FROM public.profiles
WHERE id = '39017b0e-50d8-4e7d-9197-f1d8f6aba107';
