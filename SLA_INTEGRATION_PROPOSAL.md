# Đề xuất Tích hợp SLA Tracking vào Vexim Bridge

> **Phạm vi:** Đánh giá khả năng tự động hoá theo dõi 7 chỉ tiêu SLA tại Điều 7
> hợp đồng (Bên A — Vexim Bridge), bao gồm cơ chế phạt 7.3 (a) & (b).
>
> **Ngày soạn:** 26/4/2026 | **Tham chiếu:** `SYSTEM_AUDIT.md` + 30 SQL migrations

---

## 1. Kết luận nhanh (TL;DR)

**KHẢ THI — hệ thống đã sẵn ~75% dữ liệu raw cần thiết.**

| # | Chỉ tiêu SLA | Tự động hoá | Bảng / nguồn dữ liệu hiện có |
|---|---|---|---|
| 1 | Phản hồi yêu cầu Bên B ≤ 1 ngày làm việc | Cần bổ sung | **Thiếu** — phải thêm `client_requests` |
| 2 | Cập nhật pipeline ≥ 1 lần/tuần | Có sẵn | `activities` (WORM, append-only) + `stage_transitions` |
| 3 | Báo cáo tuần/tháng đúng hạn | Có sẵn | `notification_email_log` + cron `monthly-digest` |
| 4 | Số lead đủ tiêu chuẩn / tháng | Có sẵn (cần định nghĩa) | `leads` + `opportunities.stage` |
| 5 | Số email tiếp cận / tháng | Có sẵn | `email_drafts` (status `sent`) |
| 6 | Xác thực SWIFT ≤ 2 ngày làm việc | Có sẵn | `deals.swift_verified_at` − `swift_uploaded_at` |
| 7 | Cảnh báo FDA ≥ 90 ngày trước hạn | Có sẵn | Cron `fda-expiry-check` đã chạy |

**Cần bổ sung 4 thành phần mới:**
1. Bảng `client_requests` (lưu request từ Bên B để đo response time).
2. Bảng `sla_targets` (cấu hình ngưỡng theo billing plan).
3. Bảng `sla_violations` (audit log + cơ sở áp deduction).
4. Cron `sla-monthly-evaluation` chạy 02:00 UTC ngày 1 hàng tháng.

---

## 2. Phân tích từng chỉ tiêu (đối chiếu schema thực)

### 2.1 Phản hồi yêu cầu của Bên B ≤ 1 ngày làm việc

**Khoảng trống:** Hiện chưa có "ticketing" — request của khách đi qua email
ngoài hệ thống, không log được. Đây là phần **bắt buộc** phải xây thêm.

**Đề xuất:** thêm `client_requests` + form gửi yêu cầu trong `/client/sidebar`,
admin reply qua `/admin/clients/[id]/requests`.

```sql
CREATE TABLE public.client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('portal', 'email', 'phone')),
  subject TEXT NOT NULL,
  body TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Đo SLA:** `business_hours(received_at, first_responded_at) ≤ 8h` (loại trừ T7/CN).

---

### 2.2 Cập nhật pipeline ≥ 1 lần/tuần cho mỗi opportunity active

**Có sẵn:** Bảng `activities` (script `001`, đã được hardening WORM ở `013`)
ghi mọi `action_type` (`stage_changed`, `note_added`, `email_sent`, …) gắn với
`opportunity_id` + `performed_by` + `created_at`. Bảng `stage_transitions`
(script `029`) ghi riêng từng lần đổi stage.

**Query mẫu:**
```sql
-- Opportunities đang "active" (không phải won/lost) mà 7 ngày qua
-- không có activity nào → vi phạm trong tuần đó.
SELECT o.id, o.client_id, o.stage, MAX(a.created_at) AS last_activity
FROM public.opportunities o
LEFT JOIN public.activities a ON a.opportunity_id = o.id
WHERE o.stage NOT IN ('won', 'lost')
GROUP BY o.id
HAVING MAX(a.created_at) < now() - INTERVAL '7 days'
    OR MAX(a.created_at) IS NULL;
```

**Hiệu ứng:** đếm số tuần trong tháng có gap → mỗi gap = 1 occurrence.

---

### 2.3 Báo cáo tuần / tháng đúng hạn

**Có sẵn:**
- Cron `app/api/cron/monthly-digest/route.ts` chạy ngày 1 → log vào
  `notification_email_log` (script `005`) với `category` & `dedup_key`.
- Báo cáo tuần: hiện đang được gửi qua workflow trong action; có thể chuẩn
  hoá thêm cron riêng `weekly-report` (chưa có file, cần thêm).

**Query:**
```sql
-- Bản tin tuần phải gửi trước 10h thứ Hai (giờ Việt Nam)
SELECT
  user_id,
  sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS sent_local,
  EXTRACT(DOW  FROM sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS dow,
  EXTRACT(HOUR FROM sent_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS hour
FROM public.notification_email_log
WHERE dedup_key LIKE 'weekly_report:%'
  AND sent_at >= date_trunc('month', now());
-- Vi phạm: dow != 1 OR hour >= 10
```

**Bổ sung nhỏ:** thêm cron `weekly-report` riêng + `dedup_key` chuẩn để evaluate
sau này không bị nhầm.

---

### 2.4 Số lead đủ tiêu chuẩn nghiên cứu / tháng

**Có sẵn:** `leads` table + `enriched_data` JSONB (script `002`). Định nghĩa
"đủ tiêu chuẩn" theo Điều 7.4 hợp đồng → có thể là `leads.status = 'qualified'`
hoặc opportunity của lead đó vào `contacted`+.

**Đề xuất:** thêm 1 cột nhỏ thay vì tạo bảng mới:
```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qualified_by UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_leads_qualified_at
  ON public.leads (qualified_at) WHERE qualified_at IS NOT NULL;
```

Set giá trị tự động bằng trigger khi `opportunities.stage` chuyển khỏi `new`,
hoặc bằng action thủ công của lead_researcher.

**Query:**
```sql
SELECT l.client_id, COUNT(*) AS qualified_count
FROM public.leads l
WHERE l.qualified_at >= date_trunc('month', now())
  AND l.qualified_at <  date_trunc('month', now()) + INTERVAL '1 month'
GROUP BY l.client_id;
```

---

### 2.5 Số email tiếp cận gửi đi / tháng

**Có sẵn:** `email_drafts` (script `002`) với `status` enum (`pending_approval`,
`approved`, `sent`, `rejected`, `failed`) + `client_id` (qua join opportunity →
client) + `sent_at`. Thư tới buyer cũng được log riêng vào `buyer_email_log`
(script `025`).

**Query:**
```sql
-- Tổng số email outreach của 1 client trong tháng
SELECT
  o.client_id,
  COUNT(*) AS sent_count
FROM public.email_drafts ed
JOIN public.opportunities o ON o.id = ed.opportunity_id
WHERE ed.status = 'sent'
  AND ed.updated_at >= date_trunc('month', now())
GROUP BY o.client_id;
```

---

### 2.6 Xác thực SWIFT ≤ 2 ngày làm việc

**Có sẵn:** Trên bảng `deals` (script `007` + `019`):
- `swift_doc_url` — file upload
- `swift_uploaded_at`, `swift_uploaded_by` (script `019`)
- `swift_verified`, `swift_verified_at`, `swift_verified_by`
- Constraint Segregation of Duties: uploader ≠ verifier

**Query:**
```sql
SELECT
  id, opportunity_id,
  swift_uploaded_at,
  swift_verified_at,
  EXTRACT(EPOCH FROM (swift_verified_at - swift_uploaded_at)) / 3600
    AS hours_to_verify
FROM public.deals
WHERE swift_uploaded_at >= date_trunc('month', now())
  AND swift_uploaded_at IS NOT NULL;
-- Vi phạm: hours_to_verify > 16 (2 ngày × 8h business hours)
```

---

### 2.7 Cảnh báo FDA ≥ 90 ngày trước hạn

**Đã chạy 100% tự động:**
- `app/api/cron/fda-expiry-check/route.ts` chạy hàng ngày.
- `profiles.fda_expires_at` + `fda_renewal_notified_at` (script `001` mở rộng).
- `lib/fda/status.ts` tính `daysUntilExpiry`.

**Query đo SLA:**
```sql
-- Trường hợp được notify nhưng < 90 ngày trước hạn = vi phạm
SELECT id, fda_expires_at, fda_renewal_notified_at,
       EXTRACT(DAY FROM (fda_expires_at - fda_renewal_notified_at))
         AS days_lead_time
FROM public.profiles
WHERE fda_renewal_notified_at IS NOT NULL
  AND fda_expires_at IS NOT NULL
  AND (fda_expires_at - fda_renewal_notified_at) < INTERVAL '90 days';
```

Hoặc: nếu hôm nay `fda_expires_at - now() < 90 days` mà
`fda_renewal_notified_at IS NULL` → cũng tính vi phạm.

---

## 3. Kiến trúc tích hợp

### 3.1 Schema mới — `scripts/031_sla_tracking.sql`

```sql
-- =========================================================
-- SLA tracking — Article 7 of the Vexim Global service contract
-- Idempotent. Safe to re-run.
-- =========================================================

-- 1. client_requests — phục vụ chỉ tiêu 2.1 (response time)
CREATE TABLE IF NOT EXISTS public.client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('portal','email','phone')),
  subject TEXT NOT NULL,
  body TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','responded','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_requests_client_open
  ON public.client_requests (client_id, received_at DESC)
  WHERE status = 'open';
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
-- (RLS policies giống pattern hiện hữu — admin all, client own)

-- 2. sla_targets — gắn vào billing_plan, có hiệu lực theo khoảng
CREATE TABLE IF NOT EXISTS public.sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_plan_id UUID NOT NULL
    REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to   DATE,

  -- ngưỡng số lượng (Điều 7.4)
  min_qualified_leads_per_month INT NOT NULL DEFAULT 0,
  min_outreach_emails_per_month INT NOT NULL DEFAULT 0,

  -- ngưỡng thời gian (giờ làm việc)
  response_time_hours   INT NOT NULL DEFAULT 8,    -- 1 ngày làm việc
  pipeline_update_days  INT NOT NULL DEFAULT 7,
  swift_verify_hours    INT NOT NULL DEFAULT 16,   -- 2 ngày làm việc
  fda_warning_days      INT NOT NULL DEFAULT 90,

  -- mốc deadline báo cáo
  weekly_report_dow     INT NOT NULL DEFAULT 1,    -- Mon
  weekly_report_hour    INT NOT NULL DEFAULT 10,
  monthly_report_day    INT NOT NULL DEFAULT 5,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX IF NOT EXISTS idx_sla_targets_plan
  ON public.sla_targets (billing_plan_id, effective_from DESC);
ALTER TABLE public.sla_targets ENABLE ROW LEVEL SECURITY;

-- 3. sla_violations — audit + nguồn cho deduction
CREATE TABLE IF NOT EXISTS public.sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id),
  billing_plan_id UUID REFERENCES public.billing_plans(id),
  metric_key TEXT NOT NULL CHECK (metric_key IN (
    'response_time','pipeline_update','weekly_report','monthly_report',
    'qualified_leads','outreach_emails','swift_verify','fda_warning'
  )),
  category TEXT NOT NULL CHECK (category IN ('operational','volume')),
  period_month DATE NOT NULL,                  -- '2026-04-01'
  occurrence_in_month INT NOT NULL DEFAULT 1,
  expected_value NUMERIC,
  actual_value   NUMERIC,
  shortfall_pct  NUMERIC,
  consequence    TEXT NOT NULL CHECK (consequence IN (
    'warning','5pct','10pct','review_triggered','terminated'
  )),
  retainer_deduction_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  evidence JSONB,                              -- ID record gốc
  invoice_id UUID REFERENCES public.invoices(id),  -- nếu đã apply deduction
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sla_violations_client_month
  ON public.sla_violations (client_id, period_month DESC);
ALTER TABLE public.sla_violations ENABLE ROW LEVEL SECURITY;

-- 4. View tổng hợp cho dashboard
CREATE OR REPLACE VIEW public.v_sla_monthly_summary AS
SELECT
  client_id,
  period_month,
  COUNT(*) FILTER (WHERE category = 'operational') AS op_count,
  COUNT(*) FILTER (WHERE category = 'volume')      AS vol_count,
  SUM(retainer_deduction_usd) AS total_deduction_usd,
  bool_or(consequence = 'review_triggered') AS needs_review
FROM public.sla_violations
GROUP BY client_id, period_month;
```

### 3.2 Cron `app/api/cron/sla-monthly-evaluation/route.ts`

Schedule: `0 2 1 * *` (02:00 UTC ngày 1 — sau khi `monthly-retainer` đã tạo
invoice draft).

```ts
// Pseudocode
for (const plan of activeBillingPlans) {
  const target = await getActiveSlaTarget(plan.id, lastMonth)
  const evidence = await collectEvidence(plan.client_id, lastMonth, target)

  const violations = applyArticle73(target, evidence)
  // Article 7.3(a) — operational:
  //   occurrence 1 → consequence 'warning' (không trừ tiền)
  //   occurrence ≥ 2 → 'pct5'  + retainer × 0.05 (cap 20%)
  //   3 tháng liên tiếp → 'review_triggered'
  // Article 7.3(b) — volume:
  //   shortfall < 20% → 'warning' + makeup next month
  //   shortfall ≥ 20% → 'pct10' + retainer × 0.10
  //   2 tháng liên tiếp → 'review_triggered'

  for (const v of violations) {
    await admin.from('sla_violations').insert(v)
    if (v.retainer_deduction_usd > 0) {
      // Áp credit âm vào invoice retainer tháng đó
      await applyDeduction(plan.client_id, lastMonth, v.retainer_deduction_usd)
    }
  }

  if (violations.length > 0) {
    await dispatch({
      userId: plan.client_id,
      category: 'system',
      title: 'Báo cáo SLA tháng ' + lastMonth.format('MM/YYYY'),
      link: '/client/sla',
    })
  }
}
```

### 3.3 UI mới

**A. `/admin/sla` (mới — admin + finance)** — dashboard tổng:
- 7 KPI tiles theo từng metric, mỗi tile cho biết "% client đạt SLA tháng này".
- Bảng vi phạm tháng hiện tại (filter theo client / metric / consequence).
- Action: review thủ công, override deduction (capability `SLA_OVERRIDE`).

**B. `/admin/clients/[id]` — thêm tab "SLA"** cạnh tab `Performance`:
- Card hiển thị target hiện tại + biểu đồ so sánh actual vs target 6 tháng.
- Bảng vi phạm history.

**C. `/client/sla` (mới — client tự xem)**:
- Báo cáo SLA tháng + 12 tháng gần nhất.
- Thông tin về deduction đã áp dụng vào invoice retainer.
- Link tới giải trình / kế hoạch khắc phục.

---

## 4. Khối lượng triển khai

| Thành phần | File | LOC |
|---|---|---:|
| Migration SQL | `scripts/031_sla_tracking.sql` | ~140 |
| Helper `lib/sla/` | `rules.ts`, `evidence.ts`, `business-hours.ts`, `evaluator.ts` | ~450 |
| Cron evaluation | `app/api/cron/sla-monthly-evaluation/route.ts` | ~150 |
| Server actions | `app/admin/sla/actions.ts`, `app/client/requests/actions.ts` | ~200 |
| Admin SLA dashboard | `app/admin/sla/page.tsx` + 5 components | ~500 |
| Admin client SLA tab | `components/admin/clients/sla-tab.tsx` | ~250 |
| Client SLA page | `app/client/sla/page.tsx` | ~200 |
| Client request form | `app/client/requests/page.tsx` + form | ~250 |
| Capability + RBAC | `lib/auth/permissions.ts` (thêm `SLA_OVERRIDE`) | ~20 |
| i18n | `lib/i18n/dictionaries/{vi,en}.ts` | ~120 |
| Email template | `lib/email/sla-monthly-report.ts` | ~150 |
| **Tổng** | | **~2,400** |

### Đề xuất chia 3 sprint

| Sprint | Phạm vi | Giá trị mang lại |
|---|---|---|
| **Sprint 1 (MVP)** | Migration `031` + helper + cron + admin dashboard | Đo được, ghi log, **chưa auto-deduct** — admin xem báo cáo |
| **Sprint 2** | Auto-deduct vào invoice + client SLA page + email báo cáo | Hoàn thiện cơ chế phạt 7.3 |
| **Sprint 3** | `client_requests` + form + override workflow + export PDF | Đo được response time + workflow giải trình |

---

## 5. Rủi ro & lưu ý

1. **Business hours VN:** cần helper `lib/sla/business-hours.ts` xử lý T7/CN +
   ngày lễ. Đề xuất bảng `holidays_vn` (tách riêng để admin tự cập nhật).
2. **Backfill:** chỉ enforce SLA từ `sla_targets.effective_from` → tránh phạt
   ngược trên dữ liệu trước ngày sign hợp đồng.
3. **Quyền override:** chỉ `super_admin`/`admin` mới được sửa
   `sla_violations.consequence` hay `resolved_at`. Mọi thay đổi ghi vào
   `activities` (đã WORM theo script `013`).
4. **Định nghĩa "active opportunity":** cần chốt với business — opportunity
   `lost` còn tính SLA cập nhật pipeline không? Đề xuất: không.
5. **Timezone:** mọi mốc đều quy đổi `Asia/Ho_Chi_Minh` để khớp hợp đồng.
   Cron Vercel chạy UTC → cần `+7h` khi compare với `weekly_report_dow/hour`.
6. **Idempotency:** evaluation cron có thể chạy lại → dedup bằng UNIQUE
   `(client_id, metric_key, period_month, occurrence_in_month)`.
7. **Số liệu nhạy cảm tài chính:** Sprint 1 không auto-deduct → admin có 1-2
   tháng tinh chỉnh quy tắc trước khi bật automation tài chính.

---

## 6. Khuyến nghị

**Triển khai Sprint 1 ngay** — MVP chỉ ~1.000 LOC, không động tới invoice
hiện tại. Sau 2 tháng vận hành sẽ có data thực để hiệu chỉnh ngưỡng và quy
tắc trước khi bật auto-deduction (Sprint 2).

Trong Sprint 1, tận dụng tối đa:
- `activities` (đã WORM, đủ cho metric pipeline + audit trail).
- `notification_email_log` (đã có timestamp + template_key).
- `email_drafts.status='sent'` + `deals.swift_*` + `profiles.fda_*` (đã có).

Chỉ build mới: 3 bảng SQL + 1 cron + UI dashboard. **Không có rủi ro
breaking change** với hệ thống hiện hữu.

---

## Appendix B — v2 Refinements (peer-review)

Các điều chỉnh dưới đây được bổ sung sau vòng review nội bộ, tập trung vào
ba nhóm rủi ro thực tế: **lễ Tết**, **đổi plan giữa kỳ**, và **vi phạm
biên giới**. Tất cả đều backward-compatible với schema Sprint 1.

### B.1. Holiday calendar — không phạt vào ngày nghỉ

Vấn đề: SLA đo "1 ngày làm việc" — nếu hợp đồng tính dương lịch và rơi vào
Tết Nguyên Đán (5–9 ngày liên tiếp), hệ thống sẽ tự sinh hàng loạt vi phạm
do không ai phản hồi.

Giải pháp:

```sql
-- thêm vào scripts/031_sla_tracking.sql
CREATE TABLE public.sla_holidays (
  holiday_date DATE PRIMARY KEY,
  label        TEXT NOT NULL,                    -- "Tết Nguyên Đán 2027"
  country      TEXT NOT NULL DEFAULT 'VN',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed cố định (admin có thể thêm/sửa qua /admin/sla/holidays):
INSERT INTO public.sla_holidays (holiday_date, label) VALUES
  ('2026-04-30', 'Giải phóng miền Nam'),
  ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-09-02', 'Quốc khánh'),
  ('2027-01-01', 'Tết Dương lịch'),
  ('2027-02-15', 'Tết Nguyên Đán — mùng 1'),
  ('2027-02-16', 'Tết Nguyên Đán — mùng 2'),
  ('2027-02-17', 'Tết Nguyên Đán — mùng 3');
```

Kèm helper `lib/sla/business-hours.ts`:

```ts
// Loại bỏ Sat/Sun và sla_holidays khi tính diff
export async function businessHoursBetween(
  start: Date,
  end: Date,
  tz = "Asia/Ho_Chi_Minh"
): Promise<number> { /* ... */ }
```

Cron `sla-monthly-evaluation` dùng helper này thay vì `EXTRACT(epoch ...) / 3600`.

### B.2. Grace period 48h — admin override trước khi auto-deduct

Vấn đề (Sprint 2 trở đi): cron chạy 02:00 UTC ngày 1 → tự cộng penalty vào
invoice tháng đó. Nếu lý do bất khả kháng (FDA Mỹ down, Tết, client tự huỷ
yêu cầu) thì admin không kịp can thiệp.

Giải pháp: thêm trạng thái `pending_review` vào `sla_violations` với
`auto_apply_at = created_at + INTERVAL '48 hours'`. Cron thứ hai
`sla-apply-pending` chạy mỗi giờ:

```sql
ALTER TABLE public.sla_violations
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','overridden','applied','waived')),
  ADD COLUMN auto_apply_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN review_note TEXT;
```

Flow:

1. Cron tháng tạo `pending_review` (không trừ tiền).
2. Admin vào `/admin/sla/violations` xem danh sách → 1-click **Override**
   (waive với note) hoặc **Confirm now** (apply ngay).
3. Sau 48h không action → cron `sla-apply-pending` chuyển `status='applied'`
   và adjust invoice tháng đó.

### B.3. Scope opportunity hợp lệ cho Pipeline Update SLA

Chốt rule: chỉ opportunity ở stage `prospecting`, `contacted`, `qualified`,
`proposal`, `negotiation` mới tính. Stage `won` / `lost` bị loại khỏi
mẫu số ngay lập tức — nhưng activity lịch sử của chúng **vẫn** dùng để đo
SLA của tháng quá khứ (audit trail không thay đổi).

```sql
-- View aggregator dùng:
WHERE d.stage NOT IN ('won','lost','cancelled')
  AND d.archived_at IS NULL
```

### B.4. Proration khi đổi billing plan giữa tháng

Vấn đề: Client A từ 5/4 đổi từ "Starter (10 leads/tháng)" sang
"Growth (30 leads/tháng)" → mẫu số nào áp cho tháng 4?

Giải pháp: `client_billing_plans` đã có `effective_from` + `effective_to`,
chỉ cần thêm logic prorate trong cron:

```ts
// quota_for_month(client_id, period_month) returns:
//   plan_A.lead_quota * (days_under_A / total_days_in_month)
// + plan_B.lead_quota * (days_under_B / total_days_in_month)
```

Áp dụng cho mọi metric **volume-based**: lead quota, email quota.
Metric **time-based** (response time, pipeline updates) đo per-event nên
không cần prorate.

### B.5. Manual log với backdated `received_at`

Khi admin log thủ công request từ Zalo/phone vào `client_requests`, form
phải cho phép chọn `received_at` lùi giờ (đã thiết kế sẵn ở Sprint 1
nhưng cần ràng buộc):

```sql
ALTER TABLE public.client_requests
  ADD CONSTRAINT received_at_not_future
    CHECK (received_at <= now() + INTERVAL '5 minutes');

-- Audit trail bắt buộc với manual entry:
ALTER TABLE public.client_requests
  ADD COLUMN logged_by UUID REFERENCES auth.users(id),  -- ai log thay client
  ADD COLUMN logged_via_channel BOOLEAN DEFAULT FALSE;  -- TRUE = manual log
```

Form tự gắn `logged_by = auth.uid()` khi role là staff (không phải
client_user) — minh bạch về việc ai backdated.

### B.6. Idempotency của cron (chốt cứng)

Cron `sla-monthly-evaluation` đã có UNIQUE `(client_id, metric_key,
period_month, occurrence_in_month)`. Bổ sung **state machine** chống
double-run:

```sql
CREATE TABLE public.sla_evaluation_runs (
  period_month  DATE PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,
  status        TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  triggered_by  TEXT NOT NULL  -- 'cron' | 'manual_admin_user_id'
);
```

Cron đầu tiên lệnh `INSERT ... ON CONFLICT DO NOTHING RETURNING` — nếu
không có row trả về thì bỏ qua (đã có người chạy). Cho phép admin
re-trigger qua `/admin/sla` (button "Re-run evaluation") — useful khi cron
chết.

### B.7. SLA Health Score widget — early warning

Bổ sung vào `/admin` dashboard tổng:

```
┌─ SLA Health Score (this month, real-time) ───┐
│  ████████░░  82 / 100      ▼ -8 vs last mo   │
│                                               │
│  At risk: 3 clients  |  Breached: 1 client   │
│  Top issue: "Pipeline updates" (24 misses)   │
└───────────────────────────────────────────────┘
```

Công thức (tính lũy kế trong tháng đang chạy, refresh mỗi 5 phút qua
materialized view):

$$\text{Score} = 100 - \sum_{m \in \text{metrics}} w_m \cdot \frac{\text{misses}_m}{\text{target}_m} \cdot 100$$

Trong đó $w_m$ là trọng số metric (lấy từ `sla_targets.weight`,
default = 1/7). Score < 80 → cảnh báo vàng, < 60 → đỏ — gửi push
notification cho AE/Researcher quản trực tiếp client đó.

### Tổng kết v2

| Refinement | LOC thêm | Sprint | Mức ưu tiên |
|---|---:|---|---|
| B.1 holiday_config + helper | ~120 | Sprint 1 | **MUST** (chống false positive Tết) |
| B.2 grace period 48h | ~180 | Sprint 2 | **MUST** (gate auto-deduct) |
| B.3 active opportunity scope | ~30 | Sprint 1 | **MUST** (chốt scope) |
| B.4 proration | ~80 | Sprint 1 | SHOULD |
| B.5 manual log audit | ~40 | Sprint 1 | SHOULD |
| B.6 evaluation_runs state machine | ~60 | Sprint 1 | **MUST** |
| B.7 health score widget | ~250 | Sprint 1 | NICE-TO-HAVE |

Tổng v2 thêm ~760 LOC vào ước lượng Sprint 1 → từ ~1.000 lên ~1.500 LOC.
Không phá vỡ thiết kế gốc, tất cả đều là extension qua `ALTER TABLE` /
bảng phụ.
