# Báo cáo hàng tuần cho Client (Weekly Reports)

> Tính năng: hệ thống **tự động tạo báo cáo pipeline hàng tuần** cho từng client — gửi email, hiển thị trên dashboard client + admin (AE), và cho phép **tải PDF sạch/đẹp** để AE gửi trực tiếp cho khách hàng.

## Tóm tắt những gì đã thêm

| Thành phần | Vị trí | Mô tả |
|---|---|---|
| Bảng lưu snapshot | `scripts/067_client_weekly_reports.sql` | 1 row/client/tuần, payload jsonb chứa toàn bộ số liệu. Idempotent, RLS: client chỉ đọc của mình, admin-shell đọc tất cả |
| Data layer dùng chung | `lib/reports/weekly-report.ts` | Build payload (đã mask tên buyer theo R-07), upsert, đánh dấu trạng thái email |
| PDF renderer | `lib/reports/weekly-report-pdf.ts` | pdf-lib + font Be Vietnam Pro (OFL), A4, song ngữ vi/en theo `profiles.preferred_language` |
| API tải PDF | `app/api/reports/weekly/[clientId]/route.ts` | `GET ?week=YYYY-MM-DD&inline=1` — client tải của chính mình, AE/admin tải của client mình phụ trách |
| Cron (cập nhật) | `app/api/cron/weekly-report/route.ts` | Thứ Hai 09:00 UTC: build → **lưu DB** → gửi email → **tạo notification in-app** |
| Trang client | `app/client/reports` + card trên dashboard | Lịch sử báo cáo từng tuần + nút tải PDF |
| Trang AE/admin | Card "Báo cáo hàng tuần" trên `/admin/clients/[id]` | Danh sách báo cáo + tải từng tuần hoặc bản mới nhất |

## Luồng hoạt động

```
Cron (thứ Hai 09:00 UTC, vercel.json)
  └─ với mỗi client có ≥ 1 opportunity:
       1. buildWeeklyReportPayload()      ← query opportunities + leads (đã mask R-07)
       2. UPSERT client_weekly_reports     ← (client_id, week_start) unique → idempotent
       3. Gửi email (Resend)               ← CTA trỏ đến /client/reports
       4. INSERT notifications             ← in-app bell, KHÔNG gửi email lần 2
```

Client / AE mở dashboard → thấy lịch sử → bấm **Tải PDF** → API lấy snapshot lưu sẵn (hoặc build live nếu tuần đó chưa có) → render PDF → download.

## Triển khai

### 1. Database (bắt buộc)

Chạy `scripts/067_client_weekly_reports.sql` trong **Supabase SQL Editor** (idempotent, chạy lại an toàn):

```sql
-- Verify sau khi chạy:
SELECT count(*) FROM client_weekly_reports;          -- = 0 khi mới chạy
SELECT policyname FROM pg_policies
 WHERE tablename = 'client_weekly_reports';           -- 2 policies
```

> Nếu chưa chạy migration, hệ thống **vẫn hoạt động** (PDF build live, email vẫn gửi) — chỉ thiếu lịch sử báo cáo trên dashboard. Trang sẽ hiện cảnh báo nhắc chạy migration.

### 2. Biến môi trường (đã có sẵn trên production)

- `CRON_SECRET` — bảo vệ cron endpoint (vercel.json đã đăng ký schedule)
- `RESEND_API_KEY` — gửi email
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — service client

### 3. Font PDF

File `public/fonts/BeVietnamPro-*.ttf` đã bundle trong repo (SIL OFL 1.1 — license kèm theo). Vercel tự include thư mục `public/` vào serverless function.

## Test thủ công

```bash
# Kích hoạt cron chạy ngay (CRON_SECRET từ env):
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<domain>/api/cron/weekly-report

# Tải PDF (đăng nhập với tài khoản client hoặc AE):
curl -o bao-cao.pdf https://<domain>/api/reports/weekly/<clientId>?week=2026-08-31
```

## Bảo mật (quan trọng)

- **R-07 masking**: tên buyer chỉ hiển thị từ `price_agreed` trở đi; trước đó chỉ hiện `buyer_code`. Áp dụng trong **email, PDF, và payload lưu DB** (bản cũ của cron bị lộ tên trong email — đã sửa).
- **RLS**: client chỉ SELECT report của mình; admin-shell (super_admin/admin/staff/finance/AE/lead_researcher) SELECT tất cả; ghi dữ liệu chỉ qua service role.
- **API route**: client chỉ tải của chính mình (403 nếu khác); AE/researcher/staff bị giới hạn client mình phụ trách (`account_manager_id`); admin/super_admin/finance không giới hạn.
- PDF embed font subset — file ~20-30KB, sạch, không JS/external resource.

## Cấu trúc payload (jsonb)

```jsonc
{
  "clientId": "uuid", "clientName": "Công ty ...",
  "weekStart": "2026-08-31", "periodStart": "2026-08-31", "periodEnd": "2026-09-06",
  "totalLeads": 14, "activeLeads": 9, "wonCount": 3, "lostCount": 2, "winRate": 21,
  "newThisWeek": 4, "updatedThisWeek": 7,
  "stageCounts": [{ "stage": "new", "count": 2 }, /* ... 10 stages */],
  "recentLeads": [{ "displayName": "BYR-2026-0142", "stage": "negotiation", "updatedAt": "..." }]
}
```
