# Báo cáo Kiểm toán Luồng Nghiệp vụ — Export Sales Hub (ESH)

> **Đơn vị kiểm toán:** Kiểm toán độc lập — Hệ thống thông tin & Quy trình kinh doanh
> **Đối tượng:** Export Sales Hub (ESH) — Nền tảng CRM xuất khẩu nông sản / thực phẩm Việt Nam sang thị trường Hoa Kỳ
> **Ngày phát hành:** 19/04/2026
> **Phạm vi kiểm toán:** Toàn bộ luồng nghiệp vụ end-to-end: Lead → Opportunity → Deal → Commission, bao gồm các chốt kiểm soát compliance (FDA, Swift, Risk), phân quyền (RLS/RBAC) và luồng tự động hoá (AI, Cron).
> **Chuẩn tham chiếu:** SOP nội bộ ESH (Phase 0 → Phase 3), nguyên tắc Segregation of Duties, FATF country-risk guidance, FDA facility registration.

---

## 1. Tổng quan Hệ thống

### 1.1 Mục tiêu nghiệp vụ

ESH là nền tảng B2B trung gian giữa:

- **Nhà xuất khẩu Việt Nam (Client)** — đối tượng có đăng ký FDA, cần kênh bán hàng sang Mỹ.
- **Người mua Mỹ (Buyer)** — đối tượng được ESH tìm kiếm, tiếp cận và đàm phán thay mặt client.
- **Đội ngũ ESH (Admin/Staff)** — vận hành toàn bộ chu trình bán hàng và hưởng **hoa hồng (commission)** tính trên giá trị hợp đồng.

Mô hình doanh thu: **hoa hồng theo % trên invoice value** (mặc định 5% — lưu tại `deals.commission_rate`, trường `commission_amount` là **GENERATED COLUMN** trong Postgres — tự động tính, không thể bị ghi đè bởi ứng dụng).

### 1.2 Kiến trúc & Tech stack

| Lớp | Công nghệ | Ghi chú kiểm toán |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19.2, Tailwind 4 | SSR + Server Actions — giảm bề mặt tấn công client-side |
| Auth & DB | Supabase (Postgres + Auth + RLS) | Row Level Security bật trên **mọi bảng nghiệp vụ** |
| Storage | Vercel Blob (private) | PO / Swift / B/L / FDA cert / COA / factory video |
| Email | Resend API | Có List-Unsubscribe RFC 8058 |
| AI | Vercel AI Gateway (OpenAI gpt-4o-mini) | Dùng cho sinh email, phân loại reply, gợi ý next step |
| Enrichment | Apollo.io | Enrich lead bulk import |
| Cron | Vercel Cron + `CRON_SECRET` | 3 job định kỳ |

### 1.3 Ma trận vai trò (RBAC)

Cơ sở dữ liệu định nghĩa 6 role trong `profiles.role`:

| Role | Quyền chính | Mức đặc quyền |
|---|---|---|
| `super_admin` | Toàn quyền cấu hình hệ thống | Cao nhất |
| `admin` | Vận hành toàn bộ pipeline + cấp quyền | Cao |
| `staff` | Vận hành pipeline | Trung bình-cao |
| `account_executive` | Chạy deal + quản lý compliance docs | Trung bình |
| `lead_researcher` | Import / enrich lead | Thấp-Trung bình |
| `client` | Chỉ xem portal riêng của mình | Thấp nhất |

> **Ghi chú kiểm toán (R-01):** DB là **source of truth** về role. File `app/page.tsx` ghi rõ: `user_metadata` có thể bị spoof, mặc định fallback về `/client` (least-privilege) nếu không xác định được role. ✅ **Đạt**.

---

## 2. Sơ đồ Luồng Nghiệp vụ Tổng thể

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          ESH BUSINESS FLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

  [0] ONBOARDING CLIENT                 (SOP Phase 0)
      profiles.role='client' + FDA docs (compliance_docs) + price_floor
          │
          ▼
  [1] LEAD SOURCING                      (SOP Phase 1)
      manual | bulk_import (Apollo) → leads                   ← lead_researcher
          │                                                    ← admin/staff
          ▼
  [2] OPPORTUNITY CREATION               (SOP Phase 2)
      opportunities (client_id, lead_id) — auto buyer_code US-XXXX
          │   stage: new → contacted
          ▼
  [3] SAMPLING & NEGOTIATION
      stages: sample_requested → sample_sent → negotiation → price_agreed
      AI email drafts (VI→EN→VI) → email_drafts (pending_approval → sent)
      buyer_replies logged + AI intent classifier
          │
          ▼
  [4] CLOSING & COMPLIANCE GATE          (SOP Phase 3) ⚠ CRITICAL CONTROL
      - assessCountryRisk(lead.country) → low/medium/high
      - Upload PO scan → deals.po_doc_url
      - Upload Swift copy → deals.swift_doc_url
      - ADMIN VERIFIES Swift (swift_verified = TRUE) ← GATE
      - If high/medium-risk country AND stage→{production,shipped,won}
        → BLOCKED until swift_verified=TRUE
          │
          ▼
  [5] PRODUCTION & SHIPPING
      stage: production → shipped
      Upload Bill of Lading → deals.bl_doc_url
          │
          ▼
  [6] WON / COMMISSION
      stage: won, deals.payment_status: pending → paid
      commission_amount = invoice_value * commission_rate / 100 (GENERATED)
          │
          ▼
  [7] POST-WIN
      Cron 90d → reengagement_reminder (action_required notification)
      Cron daily FDA expiry → nag client to renew
```

---

## 3. Phân tích chi tiết từng Giai đoạn & Chốt Kiểm soát

### 3.1 Phase 0 — Client Onboarding & FDA Compliance

**Mục tiêu:** Đảm bảo client có FDA Facility Registration hợp lệ **trước khi** ESH tìm buyer cho họ.

**Trường dữ liệu chính** (`profiles`):
- `fda_registration_number` — số đăng ký FDA.
- `fda_registered_at`, `fda_expires_at` — vòng đời đăng ký.
- `fda_renewal_notified_at` — đánh dấu dedup cron notify.

**Chốt kiểm soát:**

| # | Kiểm soát | File | Đánh giá |
|---|---|---|---|
| C-01 | Format FDA number: `^[A-Za-z0-9\-]+$`, độ dài 3-32 ký tự | `app/admin/clients/actions.ts:49-54` | ✅ **Đạt** — chống injection/nhập rác |
| C-02 | `expires_at ≥ registered_at` | `app/admin/clients/actions.ts:69` | ✅ **Đạt** |
| C-03 | Khi admin cập nhật cửa sổ hiệu lực → reset `fda_renewal_notified_at = NULL` | `app/admin/clients/actions.ts:99-107` | ✅ **Đạt** — tránh silent-drop reminder |
| C-04 | Chỉ `role=client` mới được cập nhật field FDA | `app/admin/clients/actions.ts:90` | ✅ **Đạt** — tránh admin ghi đè lẫn nhau |
| C-05 | Trạng thái FDA: `missing` / `expired` / `expiring_soon (≤90d)` / `valid` | `lib/fda/status.ts:12-17` | ✅ **Đạt** — dùng UTC midnight, tránh off-by-one |
| C-06 | Cron daily rà expiry + dedup 14 ngày giữa các lần nag | `app/api/cron/fda-expiry-check/route.ts` | ✅ **Đạt** — dùng `Authorization: Bearer CRON_SECRET` |

> **Rủi ro (R-02):** Hệ thống **không** chặn cứng việc tạo opportunity cho client có FDA đã hết hạn — chỉ cảnh báo bằng banner đỏ ở dashboard client (`app/client/page.tsx`). **Khuyến nghị:** bổ sung hard-gate ở `commitBulkImport` và `AddLeadForm` nếu `fda_expires_at < today`.

---

### 3.2 Phase 1 — Lead Sourcing

**Hai con đường tạo lead:**

#### A. Manual (form) — `app/admin/leads/new/page.tsx`
Admin nhập tay từng lead. Được phép bởi role admin/staff.

#### B. Bulk import — `app/admin/leads/import/actions.ts`
Hai pha: `previewBulkImport` → `commitBulkImport`.

**Chốt kiểm soát bulk import:**

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-07 | Role allowlist cho import: admin/staff/super_admin/lead_researcher/account_executive | ✅ **Đạt** |
| C-08 | Dedup theo **email** (normalized lowercase) AND **company_name** (normalized whitespace) | ✅ **Đạt** — tránh ghi trùng |
| C-09 | Dedup cả in-batch (cùng file) bằng marker `__in_batch` | ✅ **Đạt** |
| C-10 | Email regex kiểm tra `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | ⚠ **Tối thiểu** — không validate MX/tồn tại |
| C-11 | Client target phải `role='client'` | ✅ **Đạt** (`.eq("role", "client")`) |
| C-12 | Apollo enrichment chỉ chạy nếu `APOLLO_API_KEY` được cấu hình; không block flow nếu thất bại | ✅ **Đạt** |
| C-13 | Mỗi lead mới tự tạo 1 opportunity `stage='new'` gán cho client | ✅ **Đạt** |
| C-14 | Ghi 1 activity tổng hợp sau khi commit | ✅ **Đạt** — audit trail |

> **Rủi ro (R-03):** Khi insert bulk opportunity, **không** kiểm tra ràng buộc UNIQUE `(client_id, lead_id)` trước. Nếu có race condition → error toàn batch. **Khuyến nghị:** dùng `ON CONFLICT DO NOTHING` hoặc upsert.

---

### 3.3 Phase 2 — Opportunity Lifecycle (Pipeline 10 giai đoạn)

**Mô hình 2 cấp:** admin thấy 10 stage nội bộ, client thấy 5 phase tóm tắt.

```
Admin pipeline (10):
  new → contacted → sample_requested → sample_sent → negotiation
      → price_agreed → production → shipped → won / lost

Client phase (5): (lib/pipeline/phases.ts)
  prospecting → sampling → negotiation → fulfillment → closed_won / closed_lost
```

**Trường quan trọng** (`opportunities`):
- `buyer_code` — mã `US-XXXX` auto-generate từ sequence `buyer_code_seq START 1042`. **UNIQUE NOT NULL** — dùng thay tên buyer thật ở các giai đoạn đầu.
- `next_step` — ESH đang làm gì (hiển thị cho client).
- `client_action_required` + `client_action_due_date` — việc **client phải làm**.
- `reengagement_task_created_at` — marker dedup cho cron re-engage.

**Chốt kiểm soát stage transition** — `app/admin/opportunities/actions.ts:316`:

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-15 | Whitelist 10 stage hợp lệ | ✅ **Đạt** |
| C-16 | Role gate admin/staff mới được đổi stage | ✅ **Đạt** |
| C-17 | **SWIFT GATE** — khi chuyển sang `production/shipped/won` cho nước medium/high risk → yêu cầu `deals.swift_verified = TRUE`, nếu không sẽ trả `error: "swiftNotVerified"` | ✅ **ĐẠT — CHỐT KIỂM SOÁT QUAN TRỌNG NHẤT** |
| C-18 | Mỗi lần đổi stage → ghi activity `stage_changed` với mô tả `before → after` | ✅ **Đạt** — audit trail đầy đủ |
| C-19 | Notify client bằng dispatcher (in-app + email) | ✅ **Đạt** |
| C-20 | Dedup key notify: `opp_stage:{oppId}:{before}->{after}` | ✅ **Đạt** — tránh spam |

---

### 3.4 Phase 3 — Closing & Compliance (CORE CONTROL)

Đây là **trục kiểm soát quan trọng nhất** của hệ thống — nơi tiền thật chảy.

#### 3.4.1 Country Risk Engine — `lib/risk/country-risk.ts`

Phân loại dựa trên `leads.country`:

- **High risk (17 nước):** PK, NG, IR, KP, SY, AF, YE, SD, SS, MM, VE, CU, IQ, LY, SO, BY, RU.
  - Yêu cầu: **Sight L/C hoặc 100% T/T trả trước** + verified Swift.
- **Medium risk (23 nước):** BD, IN, ID, PH, EG, TR, KE, GH, ..., LB, ZW.
  - Yêu cầu: T/T 30–50% đặt cọc + verified Swift.
- **Low risk (35 nước):** US, CA, GB, AU, DE, JP, SG, ...
  - Không bắt buộc verified Swift.
- **Unknown / null country** → mặc định **medium** (an toàn) + yêu cầu Swift.

> **Ghi nhận tích cực (F-01):** Engine là **pure function, không có dependency** — có thể test đơn vị và dùng chung cho cả client preview và server gate. Kiến trúc tốt.

> **Rủi ro (R-04):** Danh sách high-risk được hard-code trong TypeScript, **không có cơ chế cập nhật runtime**. Khi FATF thay đổi grey/black list → cần deploy code. **Khuyến nghị:** chuyển sang bảng DB `country_risk_catalog` với cột `effective_date`.

#### 3.4.2 Document upload flow — `app/admin/opportunities/compliance-actions.ts`

Luồng upload 3 loại tài liệu:

```
uploadDealDocumentAction(formData: FormData {opportunityId, kind, file})
  ↓
  requireAdminOrStaff()                    ← role gate
  ↓
  ensureDeal(opportunityId, userId)        ← tạo deal nếu chưa có
  ↓
  uploadDealDoc({dealId, kind, file})      ← Vercel Blob (private)
  ↓
  UPDATE deals SET {po_doc_url|swift_doc_url|bl_doc_url} = url
  ↓
  INSERT activities (action_type='deal_doc_uploaded')
```

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-21 | Whitelist kind: `['po', 'swift', 'bl']` | ✅ **Đạt** |
| C-22 | File phải là `File` instance | ✅ **Đạt** |
| C-23 | Vercel Blob access = **private** (cần token để truy cập) | ✅ **Đạt** — chống leak công khai |
| C-24 | Ghi activity audit cho mọi upload | ✅ **Đạt** |

#### 3.4.3 Swift verification — `verifySwiftAction`

**Hành động này chính là "mắt kiểm soát" của hệ thống.**

- Admin sau khi đối chiếu chứng từ ngân hàng → toggle `swift_verified = TRUE`.
- Stamp `swift_verified_at` và `swift_verified_by = user.id`.
- Ghi activity `swift_verified` hoặc `swift_unverified`.
- Có thể nhập `transaction_reference` (max 120 chars).

> **Rủi ro kiểm toán nghiêm trọng (R-05 — HIGH):**
> **Cùng một admin có thể vừa upload Swift copy vừa verify.** → Vi phạm nguyên tắc **Segregation of Duties (SoD)**.
> **Khuyến nghị:** bổ sung ràng buộc: `verifier_id != uploader_id`. Có thể làm ở DB trigger hoặc trong `verifySwiftAction`:
> ```ts
> if (deal.created_by === guard.userId) return { ok: false, error: "sodViolation" }
> ```

#### 3.4.4 Financial fields — `app/admin/opportunities/financial-actions.ts`

Các trường trong `deals`:
- `cost_price_supplier` — giá gốc ESH trả client.
- `suggested_selling_price` — giá ESH bán cho buyer.
- `quantity_units` + `unit_label`.
- `profit_margin_usd` — **GENERATED COLUMN**: `(selling - cost) * COALESCE(quantity, 1)`.
- `invoice_value`, `commission_rate`, `commission_amount` (GENERATED).

> **Ghi nhận tích cực (F-02):** Cả `commission_amount` lẫn `profit_margin_usd` đều là **GENERATED STORED** ở Postgres — **không thể bị ghi đè từ application layer** → đảm bảo tính toàn vẹn tài chính. ✅

> **Rủi ro (R-06 — MEDIUM):** `updateDealFinancialsAction` cho phép role `account_executive` thay đổi `cost_price_supplier` và `suggested_selling_price` — **giá trị này trực tiếp ảnh hưởng đến profit margin**. Không có bước approval nào trước khi commit. **Khuyến nghị:** yêu cầu bước "approve by super_admin" khi chênh lệch margin > ngưỡng (ví dụ ±20% so với giá trị trước).

---

### 3.5 Phase 3+ — Buyer Identity Protection (Moat)

Hệ thống phân loại 3 cấp tiết lộ — `lib/protection/mask.ts`:

| Level | Stage | Được phép show | Bị ẩn |
|---|---|---|---|
| 1 | `new`, `contacted`, `sample_*`, `negotiation` | buyer_code (US-XXXX), industry, region | Toàn bộ contact info, tên công ty thật |
| 2 | `price_agreed`, `production` | + tên công ty thật | Contact info, website |
| 3 | `shipped`, `won` | + website, LinkedIn, contact person/email/phone | — (đã đóng deal, commission lock) |

> **Ghi nhận tích cực (F-03):** Tuy nhiên, file này **khai báo rõ**: *"đây là UI-side safeguard. Server queries và RLS nên enforce cả ở tầng DB"* — tác giả ý thức giới hạn.

> **Rủi ro (R-07 — HIGH):** Ở `app/client/page.tsx:56-66`, query **vẫn SELECT toàn bộ** `contact_person, contact_email, contact_phone, website, linkedin_url` từ `leads`. Dữ liệu về tới client component, mask chỉ làm việc ở render. **→ Trong React DevTools hoặc Network tab, client có thể đọc thô.**
> **Khuyến nghị (ưu tiên cao):** viết SQL view hoặc RLS policy chỉ trả sensitive fields khi `stage IN ('shipped', 'won')`. Ví dụ:
> ```sql
> CREATE VIEW public.client_leads_masked AS
> SELECT o.id, o.stage, o.buyer_code,
>        CASE WHEN o.stage IN ('price_agreed','production','shipped','won')
>             THEN l.company_name ELSE NULL END as company_name,
>        CASE WHEN o.stage IN ('shipped','won')
>             THEN l.contact_email ELSE NULL END as contact_email,
>        ...
> FROM opportunities o JOIN leads l ON l.id = o.lead_id
> WHERE o.client_id = auth.uid();
> ```

---

### 3.6 Phase 4 — AI Email Workflow

**Luồng 4 bước:**

```
1. Admin nhập prompt tiếng Việt + chọn email_type (introduction/follow_up/...)
   → generateEmailDraft()
     - Gọi OpenAI qua AI Gateway
     - Output: subject_en + content_en + content_vi (bản dịch tham khảo)
     - INSERT email_drafts (status='pending_approval')

2. Admin review bản EN + bản dịch VI → quyết định:
   - Approve & Send → sendEmailDraft(draftId)
   - Reject → rejectEmailDraft(draftId)

3. sendEmailDraft():
   - Role gate admin/staff/super_admin/account_executive
   - Resend API gửi email
   - UPDATE draft: status='sent', sent_at, approved_by
   - INSERT activity 'email_sent'

4. Buyer reply (admin paste tay vào dialog)
   → addBuyerReplyAction()
     - classifyBuyerReply() [AI] → intent + summary_vi + suggested_next_step_vi
     - INSERT buyer_replies
     - Nếu opp.next_step đang NULL → seed bằng AI suggestion
```

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-25 | Role gate mọi bước | ✅ **Đạt** |
| C-26 | Draft **không tự động gửi** — bắt buộc approve | ✅ **Đạt** — human-in-the-loop |
| C-27 | Lưu `approved_by`, `sent_at`, `resend_message_id` | ✅ **Đạt** — audit trail |
| C-28 | Nếu Resend trả lỗi → set `status='failed'` và throw | ✅ **Đạt** |
| C-29 | Buyer replies **ẩn hoàn toàn khỏi client** (không có RLS SELECT cho client role) | ✅ **Đạt** — bảo vệ moat |

> **Rủi ro (R-08 — LOW):** AI có thể "hallucinate" thông tin không có trong context. System prompt có dặn *"Never invent facts not provided in context"* nhưng không đủ guarantee. **Khuyến nghị:** thêm validator regex bắt email address / phone / số tiền trong `content_en`, đối chiếu với `context` trước khi lưu.

---

### 3.7 Notification System

**3 kênh đồng bộ:**

1. **In-app** (`notifications` table) — luôn luôn ghi.
2. **Email** (Resend) — chỉ gửi nếu:
   - `notification_preferences.email_enabled = TRUE`
   - Per-category toggle (vd `email_action_required`)
   - Recipient có email.
3. **Unsubscribe** — One-click theo **RFC 8058** (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`).

**Idempotency:** `notification_email_log` có UNIQUE `(user_id, dedup_key)` → guarantee **at-most-once** delivery kể cả khi server action retry.

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-30 | Dedup key ổn định per event | ✅ **Đạt** |
| C-31 | Unsubscribe token rotate mỗi khi user đổi preference | ✅ **Đạt** — chống leak token cũ |
| C-32 | Dispatcher **không throw** — swallow errors → action gốc không bị block | ✅ **Đạt** |
| C-33 | I18n theo `profiles.preferred_language` (vi/en) | ✅ **Đạt** |

---

### 3.8 Tokenized Share Links (for Factory Video)

**Use case:** ESH cần chia sẻ video nhà máy cho buyer mà **không yêu cầu buyer đăng ký tài khoản**.

```
createShareLinkAction → tokenized_share_links
  - token (UUID, PK)
  - doc_id → compliance_docs
  - expires_at (default +30 days)
  - revoked_at (nullable)
  - view_count, last_viewed_at

Public route: /share/[token]
```

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-34 | Default TTL 30 ngày, có thể revoke bất kỳ lúc nào | ✅ **Đạt** |
| C-35 | Token là UUIDv4 (random) | ✅ **Đạt** — non-enumerable |
| C-36 | View count tracking | ✅ **Đạt** — phát hiện lạm dụng |

> **Rủi ro (R-09 — MEDIUM):** **Không rate-limit** trên `/share/[token]`. Một buyer có thể hit 10k lần. **Khuyến nghị:** Upstash rate-limit 60 req/min per token hoặc per IP.

> **Rủi ro (R-10 — LOW):** Không có **IP allowlist / referer check**. Link leak ra public → ai cũng xem được trong TTL. **Khuyến nghị:** option bật require-OTP-by-email cho link sensitive (vd factory video chứa IP nhạy cảm).

---

### 3.9 Cron Jobs (3 job)

| Job | Tần suất | Mục đích | Auth |
|---|---|---|---|
| `/api/cron/fda-expiry-check` | Daily | Nag client về FDA sắp/đã hết hạn, dedup 14 ngày | `Bearer CRON_SECRET` |
| `/api/cron/reengage-won` | Daily | Tạo reminder cho deal `won` đã quá 90 ngày | `Bearer CRON_SECRET` |
| `/api/cron/weekly-report` | Mỗi thứ Hai 09:00 UTC | Gửi báo cáo pipeline tuần cho mỗi client | `Bearer CRON_SECRET` |

| # | Kiểm soát | Đánh giá |
|---|---|---|
| C-37 | `CRON_SECRET` — mismatch → 401 | ✅ **Đạt** |
| C-38 | `runtime = "nodejs"` cho job dùng Resend | ✅ **Đạt** |
| C-39 | Batch cap (`MAX_BATCH=200`) để tránh timeout | ✅ **Đạt** — reengage |
| C-40 | Dedup marker cho reengage (`reengagement_task_created_at`) | ✅ **Đạt** |

> **Rủi ro (R-11 — LOW):** Weekly report **không** có dedup — nếu cron chạy 2 lần thì client nhận 2 email. **Khuyến nghị:** dùng cùng `notification_email_log` pattern với `dedup_key = weekly_report:{YYYY-WW}:{clientId}`.

---

## 4. Row Level Security (RLS) — Đánh giá chi tiết

### 4.1 Ma trận quyền truy cập

| Bảng | admin/staff | client (own rows) | public |
|---|---|---|---|
| `profiles` | ALL | SELECT/UPDATE own | — |
| `leads` | ALL | SELECT (chỉ lead có opportunity gán cho mình) | — |
| `opportunities` | ALL | SELECT own (client_id = auth.uid()) | — |
| `activities` | ALL | SELECT via opportunity ownership | — |
| `deals` | ALL (admin/staff/super_admin/account_executive) | SELECT via opportunity ownership | — |
| `email_drafts` | ALL (staff-side only) | ❌ **Không** | — |
| `buyer_replies` | ALL (staff-side only) | ❌ **Không** | — |
| `compliance_docs` | ALL | SELECT own | — |
| `tokenized_share_links` | ALL | SELECT own | Anonymous qua token (service route) |
| `notifications` | admin ALL | SELECT/UPDATE own | — |
| `notification_preferences` | admin ALL | SELECT/UPDATE own | — |
| `notification_email_log` | admin ALL | ❌ | — |

### 4.2 Phát hiện kiểm toán

> **✅ Ưu điểm:**
> - RLS bật trên **TẤT CẢ** bảng nghiệp vụ.
> - Server actions **luôn** verify role **trước** khi dùng admin client (service role) — chống leak quyền.
> - Pattern chuẩn: `const supabase = createClient()` (RLS) → check role → nếu pass → `createAdminClient()` (bypass RLS).
> - View `client_commission_timeline` dùng `SECURITY INVOKER` — giữ RLS.

> **⚠ Rủi ro (R-12 — MEDIUM):** Policy `"Admins can manage all profiles"` có subquery `SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')`. **Từng có bug recursion** đã được fix ở migration 003 (`003_fix_profiles_rls_recursion.sql` → có function `get_user_role()`). **Đảm bảo tất cả policy mới đều dùng function này thay vì subquery inline** để tránh lặp lại bug.

> **⚠ Rủi ro (R-13 — LOW):** Policy ở `leads` cho phép client xem leads **thông qua opportunity**. Nhưng `lib/protection/mask.ts` cho thấy rằng sensitive fields vẫn bị leak ở level 1 (xem R-07). RLS chưa che đủ — cần view masked.

---

## 5. Kiểm tra Audit Trail (Bằng chứng kiểm toán)

Bảng `activities` là sổ cái nghiệp vụ. Các loại action đang được ghi:

- Lifecycle: `lead_created`, `opportunity_created`, `bulk_lead_import`
- Pipeline: `stage_changed` (với mô tả `before → after`)
- Email: `email_draft_created`, `email_approved`, `email_sent`
- Compliance: `deal_doc_uploaded`, `swift_verified`, `swift_unverified`, `deal_created`, `deal_paid`, `shipped`
- Engagement: `buyer_reply_logged`, `reengagement_reminder`
- Free text: `call_made`, `meeting_booked`, `note_added`

| # | Đánh giá | Kết quả |
|---|---|---|
| A-01 | Mọi thay đổi stage được log | ✅ **Đạt** |
| A-02 | Ai thực hiện (`performed_by`) — **NOT NULL** trên hầu hết các action server-side | ✅ **Đạt** |
| A-03 | Thời điểm (`created_at`) | ✅ **Đạt** |
| A-04 | Immutability — có trigger nào ngăn UPDATE/DELETE `activities` không? | ❌ **Chưa có** — xem R-14 |

> **Rủi ro nghiêm trọng (R-14 — HIGH):** `activities` **không có policy chặn UPDATE/DELETE**. Policy hiện là `FOR ALL` cho admin/staff → admin có thể sửa/xoá audit trail. Vi phạm nguyên tắc **WORM (Write Once Read Many)** cho audit log.
> **Khuyến nghị (ưu tiên cao):** thay policy thành `FOR SELECT, INSERT` only. Nếu cần correction thì dùng `correction_of_id` column để compensating entry, không xoá bản ghi gốc.

---

## 6. Bảo mật & Quyền riêng tư

### 6.1 Xác thực (Auth)

- Supabase Auth (cookie-based, HttpOnly, SameSite).
- Middleware `lib/supabase/middleware.ts` refresh session mọi request.
- Guard: `/admin`, `/client`, `/settings` → nếu không có user → redirect `/auth/login`.
- `/unsubscribe/[token]` cố tình **không** protect (email-based flow).
- `auth/callback` handle OAuth/magic-link.

### 6.2 Secret management

| Env var | Mục đích | Kiểm tra |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Public OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Public OK (RLS bảo vệ) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client **server-only** | ⚠ Chỉ dùng sau role check |
| `CRON_SECRET` | Bearer token cho cron | Strict check |
| `RESEND_API_KEY` | Email | Server-only |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob private | Server-only |
| `APOLLO_API_KEY` | Enrichment | Optional |
| `AI_GATEWAY_API_KEY` | AI (chỉ cần cho provider ngoài OpenAI) | Optional |
| `NEXT_PUBLIC_APP_URL` | Build email CTA | Public |

> **Rủi ro (R-15 — LOW):** Code có fallback `process.env.VERCEL_URL` khi thiếu `NEXT_PUBLIC_APP_URL`. Trên preview deploy, URL này có thể khác khiến unsubscribe link point sai domain — user click sẽ 404 trên domain prod. **Khuyến nghị:** hard-fail trong production nếu `NEXT_PUBLIC_APP_URL` thiếu.

### 6.3 Input validation

- Server actions validate length (vd `MAX_SHORT=200`, `MAX_TEXT=5000`).
- Date strict regex `^\d{4}-\d{2}-\d{2}$`.
- Email regex.
- Zod schema cho AI output (`outputSchema`).

> **Rủi ro (R-16 — LOW):** Nhiều action dùng validation **thủ công** thay vì Zod nhất quán. **Khuyến nghị:** migrate toàn bộ sang Zod schemas để dễ bảo trì và sinh type.

---

## 7. Tổng hợp Phát hiện & Khuyến nghị

### 7.1 Phát hiện tích cực (Findings — Positive)

| # | Nội dung |
|---|---|
| F-01 | Country risk engine là pure function, testable, shared client/server. |
| F-02 | `commission_amount` và `profit_margin_usd` là GENERATED COLUMN — không thể bị ghi đè từ app. |
| F-03 | Phân lớp disclosure (3 levels) có tài liệu hoá rõ trong code. |
| F-04 | Email dispatcher có idempotency key, dedup cứng ở DB. |
| F-05 | Mọi server action có role gate + audit log. |
| F-06 | AI email flow yêu cầu human-in-the-loop (không auto-send). |
| F-07 | Cron có `CRON_SECRET` + dedup marker. |
| F-08 | I18n (vi/en) áp dụng nhất quán cả UI lẫn email. |

### 7.2 Rủi ro & Khuyến nghị (Risks — Prioritized)

| # | Mức độ | Phát hiện | Khuyến nghị | Ưu tiên |
|---|---|---|---|---|
| **R-05** | **HIGH** | Cùng admin có thể upload Swift + verify Swift → vi phạm SoD | Ràng buộc `verifier_id != uploader_id` ở action và DB trigger | 🔴 **Ngay** |
| **R-07** | **HIGH** | Sensitive fields của lead vẫn được ship xuống client bundle ở level 1 | Tạo SQL VIEW masked, chuyển query client page sang view đó | 🔴 **Ngay** |
| **R-14** | **HIGH** | `activities` có thể bị UPDATE/DELETE bởi admin → audit trail không WORM | Thay policy thành INSERT/SELECT only; dùng compensating entry cho correction | 🔴 **Ngay** |
| **R-02** | MEDIUM | Không hard-gate tạo opportunity khi client FDA expired | Thêm check ở `commitBulkImport` & manual create flow | 🟠 Sớm |
| **R-04** | MEDIUM | Danh sách country risk hard-code | Chuyển sang bảng DB có `effective_date` | 🟠 Sớm |
| **R-06** | MEDIUM | `account_executive` có thể đổi giá ảnh hưởng margin mà không qua approval | Yêu cầu super_admin approve khi lệch >20% | 🟠 Sớm |
| **R-09** | MEDIUM | Không rate-limit `/share/[token]` | Upstash rate-limit | 🟠 Sớm |
| **R-12** | MEDIUM | RLS policies mới có thể tái phát recursion bug | Bắt buộc dùng function `get_user_role()` ở mọi policy mới | 🟠 Sớm |
| **R-03** | LOW | Bulk opportunity insert không handle UNIQUE conflict | `ON CONFLICT DO NOTHING` | 🟢 Khi thuận tiện |
| **R-08** | LOW | AI có thể hallucinate fact | Validator regex đối chiếu entity | 🟢 |
| **R-10** | LOW | Share link không OTP | Option OTP-by-email | 🟢 |
| **R-11** | LOW | Weekly report không dedup | Dùng email_log dedup_key `weekly_report:YYYY-WW:clientId` | 🟢 |
| **R-13** | LOW | RLS chưa che sensitive fields leads | Xem R-07 (gộp giải pháp) | 🟢 |
| **R-15** | LOW | Fallback `VERCEL_URL` có thể sai | Hard-fail nếu thiếu `NEXT_PUBLIC_APP_URL` ở prod | 🟢 |
| **R-16** | LOW | Validation không đồng bộ | Migrate sang Zod | 🟢 |

### 7.3 Ma trận tác động

```
     │ Tài chính │ Compliance │ Privacy │ Operational │
─────┼───────────┼────────────┼─────────┼─────────────┤
R-05 │    XX     │     XX     │         │      X      │ SoD — Swift
R-07 │     X     │            │   XX    │             │ PII leak
R-14 │           │     XX     │         │      X      │ Audit WORM
R-06 │    X      │            │         │      X      │ Margin control
R-02 │           │     X      │         │      X      │ FDA gate
─────┴───────────┴────────────┴─────────┴─────────────┘
XX = tác động mạnh, X = tác động trung bình
```

---

## 8. Kết luận Kiểm toán

**Đánh giá tổng thể:** Hệ thống ESH được thiết kế **có chiều sâu** với nhiều lớp kiểm soát thông minh: RLS toàn diện, generated column tài chính, country risk engine, buyer masking, human-in-the-loop cho AI, idempotent notifications. Tác giả code thể hiện ý thức rõ ràng về security (ghi chú `// SECURITY:` ở nhiều chỗ, pattern role-check-before-admin-client được tuân thủ nhất quán).

Tuy nhiên, kiểm toán phát hiện **3 rủi ro mức HIGH** cần xử lý trước khi go-live production quy mô lớn:

1. **Vi phạm Segregation of Duties ở luồng Swift verification** — cho phép fraud nội bộ.
2. **PII của buyer vẫn leak xuống client qua SELECT thô** — vi phạm moat nghiệp vụ cốt lõi của ESH (chính là lý do tồn tại của hệ thống).
3. **Audit trail có thể bị sửa đổi** — làm yếu tính bằng chứng trong tranh chấp thương mại.

Sau khi xử lý 3 rủi ro HIGH và 5 rủi ro MEDIUM theo lộ trình đề xuất, hệ thống đạt chuẩn vận hành cho mô hình B2B cross-border thương mại hoá quy mô trung bình (100–1000 deal/năm).

---

## 9. Phụ lục — Danh sách tài liệu tham chiếu đã kiểm tra

### 9.1 Migration / Schema
- `scripts/001_create_schema.sql` — Tables: profiles, leads, opportunities, activities
- `scripts/002_phase2_schema.sql` — Pipeline 10 stage, deals, email_drafts
- `scripts/003_fix_profiles_rls_recursion.sql` — RLS helper `get_user_role()`
- `scripts/004_client_protection_schema.sql` — Buyer code, commercial fields
- `scripts/005_notifications_schema.sql` — Notifications + preferences + email_log
- `scripts/006_notifications_schema_fix.sql`
- `scripts/007_sprint_a_risk_swift.sql` — Country + Swift verification
- `scripts/008_deals_uniqueness.sql`
- `scripts/009_sprint_b_compliance_financials.sql` — compliance_docs + margin
- `scripts/010_sprint_d_replies_reengagement.sql` — buyer_replies + reengage
- `scripts/011_sprint_d_view_security_fix.sql`
- `scripts/012_promote_user_to_admin.sql`

### 9.2 Server Actions (mutations)
- `app/admin/clients/actions.ts` — updateFdaRegistration
- `app/admin/clients/compliance-actions.ts` — upload/delete docs, tokenized links
- `app/admin/opportunities/actions.ts` — update details, update stage, notify
- `app/admin/opportunities/compliance-actions.ts` — upload PO/Swift/BL, verify Swift
- `app/admin/opportunities/financial-actions.ts` — deal financials
- `app/admin/opportunities/reply-actions.ts` — buyer replies + AI classify
- `app/admin/users/actions.ts` — updateUserRole
- `app/admin/leads/import/actions.ts` — bulk import 2-phase
- `app/notifications/actions.ts`, `app/settings/notifications/actions.ts`

### 9.3 Core Libraries
- `lib/pipeline/phases.ts` — client phase mapping
- `lib/protection/mask.ts` — disclosure levels
- `lib/risk/country-risk.ts` — risk engine
- `lib/fda/status.ts` — FDA status helper
- `lib/notifications/dispatcher.ts` — notification delivery
- `lib/ai/email-generator.ts`, `lib/ai/email-sender.ts`, `lib/ai/reply-classifier.ts`
- `lib/blob/client-docs.ts`, `lib/blob/deal-docs.ts`
- `lib/supabase/middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`

### 9.4 Cron / API Routes
- `app/api/cron/fda-expiry-check/route.ts`
- `app/api/cron/reengage-won/route.ts`
- `app/api/cron/weekly-report/route.ts`
- `app/api/ai/generate-email/route.ts`, `app/api/ai/send-email/route.ts`

---

*— Kết thúc báo cáo kiểm toán —*
