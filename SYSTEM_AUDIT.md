# Vexim Bridge — Tài liệu Mô tả Hệ thống (System Audit)

> **Phiên bản:** 1.0
> **Ngày kiểm toán:** 26/04/2026
> **Phạm vi:** Toàn bộ codebase, schema, RLS, business logic, integrations

---

## 1. Tổng quan hệ thống

### 1.1 Mục đích kinh doanh

**Vexim Bridge** (`veximbridge.com`) là **phòng kinh doanh xuất khẩu thuê ngoài** (outsourced export sales team) cho các nhà sản xuất Việt Nam bán hàng vào thị trường Mỹ. Hệ thống chuyên sâu vào **4 ngành được FDA quản lý**:

1. **Thực phẩm** (Food Facility Registration)
2. **Thực phẩm chức năng** (Dietary Supplement DSHEA)
3. **Mỹ phẩm** (Cosmetic Listing — MoCRA)
4. **Thiết bị y tế** (Medical Device 510(k))

Các nghiệp vụ cốt lõi mà hệ thống hỗ trợ:

- Đăng ký & theo dõi tuân thủ FDA cho client
- Tìm kiếm buyer Mỹ (lead generation) và quản lý outreach
- Quản lý pipeline 10 stage từ `new` → `won/lost`
- Xác thực chuyển tiền SWIFT 2 bước (Segregation of Duties)
- Thu USD và tính hoa hồng theo mô hình **setup fee + retainer + success fee**
- Phát hành hóa đơn với mã VietQR (Napas 247) cho phần thanh toán VND
- Báo cáo & analytics đa lớp cho founder/admin/sales/finance

### 1.2 Mô hình kinh doanh tài chính

```
Doanh thu Vexim Bridge = Setup Fee (1 lần) + Monthly Retainer + Success Fee (% lợi nhuận)
                                                                  └── Trừ 50% retainer credit
```

- **Setup fee** — phí khởi tạo hợp đồng, một lần
- **Retainer** — phí giữ chỗ hàng tháng (tự động phát hành ngày anchor)
- **Success fee** — % `profit_margin_usd` của deal đã ship, được offset 50% bằng retainer credit đã trả

### 1.3 Stack công nghệ

| Layer | Công nghệ |
|---|---|
| **Framework** | Next.js 16 (App Router, RSC, Server Actions) |
| **Runtime** | React 19.2, TypeScript 5.7 |
| **UI** | shadcn/ui + Radix UI + Tailwind CSS v4 |
| **Database** | Supabase PostgreSQL + Row Level Security |
| **Auth** | Supabase Auth (cookie-based SSR via `@supabase/ssr`) |
| **Storage** | Vercel Blob (private access) |
| **Email** | Resend SDK + nodemailer fallback |
| **AI** | Vercel AI SDK 6 (AI Gateway) |
| **Charts** | Recharts |
| **Drag & Drop** | @dnd-kit |
| **Forms** | react-hook-form + zod |
| **i18n** | Custom dictionary (vi/en) |
| **Cron** | Vercel Cron (`vercel.json`) |

---

## 2. Kiến trúc hệ thống

### 2.1 Cấu trúc thư mục cấp cao

```
/app
  /admin              → Admin shell (super_admin, admin, AE, researcher, finance)
    /clients          → Quản lý khách hàng + FDA + sản phẩm + compliance
    /buyers           → Buyer database (PII có mask theo role)
    /pipeline         → Kanban 10-stage drag & drop
    /opportunities    → Server actions cho opportunity CRUD
    /leads/new        → AI-assisted lead form
    /leads/import     → Bulk CSV import
    /activities       → Audit log
    /analytics        → BI dashboard 4 tab
    /finance          → Invoices / billing plans / expenses / settings
    /country-risk     → Country risk register
    /products         → Product search widget cho admin
    /users            → RBAC user management
  /client             → Customer portal (role = client)
    /leads            → Pipeline 5-phase đơn giản hóa
    /products         → Client tự khai sản phẩm
    /analytics        → Báo cáo của riêng client
  /api
    /ai               → Generate / send email với AI
    /cron             → 7 cron job (FDA expiry, retainer, success fee, …)
    /export           → CSV export endpoints
    /products/search  → Public API (chưa auth)
    /opportunities    → Find by ref code
    /consultation     → Public consultation form từ landing
  /auth               → Login, signup, callback, accept-invite, reset
  /invoice/[token]    → Public invoice viewer (token-protected)
  /share/[token]      → Public document/bundle viewer (token-protected)
  /unsubscribe/[token]→ One-click email unsubscribe
  /settings           → User settings
  /(landing)          → / page = marketing landing

/components
  /admin              → Admin-side UI (kanban, tables, dialogs, analytics)
  /client             → Client portal UI
  /landing            → Marketing landing components
  /finance            → Invoice printable + print button
  /notifications      → Notification bell + dropdown
  /ui                 → shadcn/ui primitives

/lib
  /auth               → guard.ts (current role), permissions.ts (CAPS)
  /supabase           → server.ts, client.ts, admin.ts, middleware.ts, types.ts
  /pipeline           → Stage ↔ ClientPhase mapping
  /finance            → Invoice numbering, VietQR, settings, types
  /risk               → Country risk DB
  /ai                 → Email generator, sender, reply classifier
  /email              → Mailer (Resend), templates, weekly report
  /notifications      → Dispatcher + email template
  /blob               → Deal/client doc upload với Vercel Blob
  /buyers             → PII masking
  /protection         → Generic mask helpers
  /fda                → FDA expiry status calculator
  /analytics          → Queries cho 4 tab + client tabs
  /export             → CSV builders
  /i18n               → Dictionaries vi/en + server helper
  /constants          → Industries enum

/scripts              → 30+ SQL migration files (idempotent)
/middleware.ts        → Auth session refresh (Supabase SSR)
/vercel.json          → 7 cron schedules
```

### 2.2 Layering & boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (Client Components, "use client")                       │
│   - shadcn/ui dialogs, kanban, forms, charts                    │
└──────────────┬──────────────────────────────────────────────────┘
               │ Server Actions / fetch
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server Components & Route Handlers (Next.js App Router)         │
│   - app/admin/.../actions.ts            (Server Actions)        │
│   - app/api/.../route.ts                (Route Handlers)        │
│   - app/admin/clients/[id]/page.tsx     (RSC, async)            │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ lib/auth/guard + permissions    (RBAC enforcement)              │
│ lib/supabase/server             (cookie-bound SSR client)       │
│ lib/supabase/admin              (service-role, bypasses RLS)    │
│ lib/notifications/dispatcher    (in-app + email)                │
│ lib/blob/*                      (Vercel Blob private)           │
│ lib/ai/*                        (AI SDK 6 via gateway)          │
└──────────────┬──────────────────────────────────────────────────┘
               │ pg-bouncer / Realtime
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase PostgreSQL                                             │
│   - 25+ tables                                                  │
│   - RLS policies (role-aware via profiles.role)                 │
│   - Triggers (stage_transitions, opportunity_updated, …)        │
│   - Views (opportunity_metrics_v, client_pipeline_metrics_v)    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Auth & session flow

1. **Middleware** (`middleware.ts`) chạy trên mọi request không phải static asset, gọi `updateSession()` của Supabase SSR để refresh cookie.
2. **`createClient()` (lib/supabase/server.ts)** — đọc cookie, dùng anon key, RLS được áp dụng tự động.
3. **`createAdminClient()` (lib/supabase/admin.ts)** — dùng `SUPABASE_SERVICE_ROLE_KEY`, BYPASS RLS, chỉ dùng trong server actions cho thao tác admin (tạo user, gửi invite, cron job).
4. **Admin layout** (`app/admin/layout.tsx`) chặn user không có role hợp lệ → redirect `/client`. **DB là single source of truth** — không bao giờ trust `user_metadata`.

---

## 3. Mô hình phân quyền (RBAC)

### 3.1 7 vai trò (Role)

| Role | Mô tả | Vào shell |
|---|---|---|
| `super_admin` | Founder, có toàn quyền + độc quyền promote/demote super_admin khác | `/admin` |
| `admin` | Operations lead, capability set giống super_admin trừ promote super_admin | `/admin` |
| `account_executive` | Sales rep — KHÔNG được sửa `cost_price` (R-06) | `/admin` |
| `lead_researcher` | Researcher — buyer PII bị mask trong UI | `/admin` |
| `finance` | Bookkeeper — invoices, expenses, billing plans | `/admin` |
| `staff` | **Legacy** — được xử lý như account_executive | `/admin` |
| `client` | Customer portal user | `/client` |

### 3.2 Capability catalog (`lib/auth/permissions.ts`)

Mọi action được gắn 1 capability từ `CAPS`. Đây là **single source of truth** cho RBAC ở tầng app (RLS ở tầng DB là lớp phòng thủ thứ 2).

| Domain | Capability | super_admin | admin | AE | Researcher | finance |
|---|---|:-:|:-:|:-:|:-:|:-:|
| **Finance** | `FINANCE_READ` | ✓ | ✓ | ✓ | | ✓ |
| | `INVOICE_WRITE` | ✓ | ✓ | | | ✓ |
| | `INVOICE_VOID` | ✓ | ✓ | | | ✓ |
| | `EXPENSE_WRITE` | ✓ | ✓ | | | ✓ |
| | `BILLING_PLAN_WRITE` | ✓ | ✓ | | | ✓ |
| | `FINANCE_SETTINGS_WRITE` | ✓ | ✓ | | | ✓ |
| **Deals** | `DEAL_VIEW` | ✓ | ✓ | ✓ | ✓ | ✓ |
| | `DEAL_COST_PRICE_WRITE` | ✓ | ✓ | **✗ (R-06)** | | |
| | `DEAL_SELLING_PRICE_WRITE` | ✓ | ✓ | ✓ | | |
| | `DEAL_QUANTITY_WRITE` | ✓ | ✓ | ✓ | | |
| | `DEAL_COMPLIANCE_WRITE` | ✓ | ✓ | ✓ | | |
| **Buyers** | `BUYER_VIEW` | ✓ | ✓ | ✓ | ✓ | ✓ |
| | `BUYER_PII_VIEW` | ✓ | ✓ | ✓ | **✗ (mask)** | |
| | `BUYER_WRITE` | ✓ | ✓ | ✓ | ✓ | |
| **Clients** | `CLIENT_VIEW` | ✓ | ✓ | ✓ | ✓ | ✓ |
| | `CLIENT_WRITE` | ✓ | ✓ | ✓ | | |
| | `CLIENT_COMPLIANCE_WRITE` | ✓ | ✓ | ✓ | | |
| **Country Risk** | `COUNTRY_RISK_READ` | ✓ | ✓ | ✓ | ✓ | |
| | `COUNTRY_RISK_WRITE` | ✓ | ✓ | | | |
| **Users** | `USERS_VIEW` | ✓ | ✓ | | | |
| | `USERS_MANAGE` | ✓ | ✓ | | | |
| | `USERS_ASSIGN_ROLE` | ✓ | ✓ | | | |
| **System** | `ACTIVITY_LOG_VIEW` | ✓ | ✓ | | | |
| | `NOTIFICATIONS_MANAGE` | ✓ | ✓ | | | |
| **Analytics** | `ANALYTICS_VIEW_ALL` | ✓ | ✓ | | | ✓ |
| | `ANALYTICS_VIEW_OWN` | | | ✓ | ✓ | |

**Quy tắc nghiệp vụ then chốt:**
- **R-06 (Segregation):** AE không được sửa `cost_price_supplier` của deal
- **R-05 (SWIFT SoD):** `swift_uploaded_by` ≠ `swift_verified_by` (DB CHECK constraint)
- **PII mask:** Researcher thấy buyer email/phone bị che (handled by `lib/buyers/mask.ts` + `lib/protection/mask.ts`)
- **Analytics scope:** AE/Researcher chỉ thấy client mà `profiles.account_manager_id = current.userId`

---

## 4. Database schema (25+ bảng)

### 4.1 Core entities

#### `profiles` (mở rộng từ `auth.users`)
- Cột chính: `id`, `email`, `full_name`, `role`, `company_name`, `industry`, `industries[]`, `phone`, `avatar_url`
- **FDA fields:** `fda_registration_number`, `fda_registered_at`, `fda_expires_at`, `fda_renewal_notified_at`
- **i18n:** `preferred_language` (`vi` | `en`)
- **Account ownership:** `account_manager_id` → khoá `ANALYTICS_VIEW_OWN`
- **Trigger:** `handle_new_user()` tự tạo profile khi auth user signup

#### `leads` (potential buyers)
- `company_name`, `contact_person`, `contact_email`, `contact_phone`, `linkedin_url`
- `industry`, `website`, `country`, `region`, `notes`, `source`
- `enriched_data` (JSONB từ Apollo)

#### `opportunities` (deal pipeline)
- `client_id`, `lead_id` (UNIQUE pair — không cho duplicate deal)
- `stage` (10 trạng thái — xem §5.1)
- `potential_value`, `notes`
- **Buyer-facing:** `buyer_code`, `products_interested`, `quantity_required`, `target_price_usd`, `incoterms`, `payment_terms`, `destination_port`
- **Action tracking:** `next_step`, `client_action_required`, `client_action_due_date`, `target_close_date`

#### `activities` (audit log)
- Append-only, FK `opportunity_id` (nullable cho system events)
- `action_type`, `description`, `performed_by`

### 4.2 Closing & compliance (Sprint A — `scripts/007`)

#### `deals` (financial close-out)
- 1-1 với `opportunities` (FK `opportunity_id`)
- `po_number`, `invoice_value`, `commission_rate`, `commission_amount`, `payment_status`
- **Documents (Vercel Blob private URLs):** `po_doc_url`, `swift_doc_url`, `bl_doc_url`
- **SWIFT verification 2-step:** `swift_uploaded_by` + `swift_verified_by` (DB CHECK ≠), `swift_verified`, `transaction_reference`
- **Risk:** `risk_level` (low/medium/high)
- **Financials (Sprint B):** `cost_price_supplier`, `suggested_selling_price`, `quantity_units`, `unit_label`, `profit_margin_usd` (GENERATED column)

#### `compliance_docs`
- `owner_id`, `kind` (`fda_certificate` | `coa` | `price_floor` | `factory_video` | `factory_photo` | `other`)
- `url`, `mime_type`, `size_bytes`, `issued_at`, `expires_at`, `notes`

#### `tokenized_share_links` + `tokenized_share_link_docs`
- Public share token với `expires_at`, `revoked_at`, `view_count`, `last_viewed_at`
- Bundle (multi-doc) link: `doc_id` NULL, list docs ở junction table

### 4.3 Notifications (Migration 005-006)

| Bảng | Mô tả |
|---|---|
| `notifications` | In-app inbox, `category`, `link_path`, `read_at` |
| `notification_preferences` | Per-user toggles + `unsubscribe_token` |
| `notification_email_log` | Idempotent ledger với `dedup_key` UNIQUE |

**5 categories:** `action_required`, `status_update`, `deal_closed`, `new_assignment`, `system`

### 4.4 Email AI (Sprint D — `scripts/010`)

- `email_drafts` — VI prompt → AI generates EN subject/body → translated VI → `pending_approval` → `approved` → `sent`
- `buyer_replies` — incoming buyer email với AI classification: `intent` (price_request / sample_request / objection / closing_signal / general), `summary`, `confidence`, `suggested_next_step`

### 4.5 Finance (Migration 016)

| Bảng | Mô tả |
|---|---|
| `finance_settings` (singleton) | FX rate, invoice prefix, company info, bank info (Napas BIN) |
| `billing_plans` | Per-client contract: setup fee, retainer, success fee %, retainer credit % (default 50%) |
| `invoices` | 4 kinds (`setup_fee`, `retainer`, `success_fee`, `manual`), 7 statuses, public_token, snapshots issuer/bank |
| `retainer_credits` | Append-only ledger: earned / applied / expired / adjustment |
| `operating_expenses` | Outbound cash flow (salary/tools/marketing/office/legal/travel/other) |
| `invoice_counters` | Per-year monotonic counter cho invoice number safe under concurrency |

### 4.6 Country risk (Sprint A — `scripts/007`)

- `country_risk` — bảng tham chiếu, `iso2`, `risk_level`, `notes`, `updated_by`

### 4.7 Analytics (Migration 029)

- `stage_transitions` — append-only ledger, populated by trigger
- View `opportunity_metrics_v` — opportunity + time-in-current-stage + total lifetime
- View `client_pipeline_metrics_v` — per-client win/lost/in-progress counts

### 4.8 Client products (Migration 023-024-028)

- `client_products` — sản phẩm do client tự khai (tên, category, capacity, prices)
- `product_categories` — danh mục có thể quản lý
- FK `opportunities.client_product_id` và `deals.product_id`

### 4.9 Misc

- `client_protection_metadata` (Migration 004) — quyết định mask buyer info dựa trên `protection_state`
- `buyer_confirmation_emails` (Migration 025) — log email confirm gửi tới buyer

---

## 5. Pipeline & business rules

### 5.1 10 stage admin → 5 phase client

```
Admin (Stage)            Client (Phase)
─────────────────────────────────────────
new                  ┐
contacted            ┴──→  prospecting
sample_requested     ┐
sample_sent          ┴──→  sampling
negotiation          ┐
price_agreed         ┴──→  negotiation
production           ┐
shipped              ┴──→  fulfillment
won                  ───→  closed_won
lost                 ───→  closed_lost
```

Map ở `lib/pipeline/phases.ts`. Client portal cố tình ẩn chi tiết operational để giảm nhiễu.

### 5.2 Compliance gate (`COMPLIANCE_REQUIRED_STAGES`)

Từ stage `sample_requested` trở đi (tới `won`), client **bắt buộc** phải có FDA registration hợp lệ và chưa hết hạn. UI sẽ block stage advance nếu không pass `getFdaStatus()` (`lib/fda/status.ts`).

### 5.3 Deal uniqueness (Migration 008)

- `(client_id, lead_id)` UNIQUE trên `opportunities` — không tạo được 2 deal trùng cặp client + buyer
- `(opportunity_id)` UNIQUE trên `deals` — 1 opportunity tối đa 1 deal

### 5.4 Workflow tóm tắt từ A → Z

```
1. Admin/AE tạo lead (form thường hoặc bulk import) → leads
2. Admin link lead với client → opportunity (stage = new)
3. Admin viết email → AI generate EN draft → admin approve → send
4. Buyer phản hồi → AI classify intent → suggested next_step
5. Stage tiến tới sample_requested (yêu cầu FDA hợp lệ)
6. Quá trình thương lượng → price_agreed → production → shipped
7. Khi shipped:
   - Upload PO doc (Vercel Blob)
   - Upload Swift doc (uploader != verifier)
   - Verifier kiểm tra & set swift_verified = true
   - Upload B/L
   - Set cost_price + selling_price + quantity → profit_margin_usd auto
8. Stage = won → cron job /api/cron/auto-success-fee phát hành success_fee invoice
9. Invoice gửi public link với VietQR + bank info
10. Cron /api/cron/invoice-overdue đánh dấu overdue
11. Cron /api/cron/reengage-won gợi ý re-engagement sau X ngày
12. Monthly digest gửi email tổng kết cho từng client
```

---

## 6. Tính năng theo module

### 6.1 Admin shell (`/admin`)

| Trang | Mô tả | Cap yêu cầu |
|---|---|---|
| `/admin` | Dashboard tổng quan | Mọi role admin shell |
| `/admin/clients` | Danh sách khách hàng + filter + invite | `CLIENT_VIEW` |
| `/admin/clients/[id]` | **Tab UI**: Hiệu suất / Sản phẩm / Tuân thủ | `CLIENT_VIEW` |
| `/admin/clients/new` | Onboard client mới (gửi invite email) | `CLIENT_WRITE` |
| `/admin/buyers` | Buyer DB với mask PII theo role | `BUYER_VIEW` |
| `/admin/pipeline` | Kanban 10-stage (drag & drop dnd-kit) | `DEAL_VIEW` |
| `/admin/leads/new` | Smart lead form (AI autocomplete + Apollo enrich) | `BUYER_WRITE` |
| `/admin/leads/import` | Bulk CSV import với preview | `BUYER_WRITE` |
| `/admin/activities` | Audit log feed | `ACTIVITY_LOG_VIEW` |
| `/admin/analytics` | 5 tab: Overview / By client / Bottleneck / Lost / Buyer perf | `ANALYTICS_VIEW_ALL` hoặc `_OWN` |
| `/admin/country-risk` | CRUD country risk register | `COUNTRY_RISK_READ`/`WRITE` |
| `/admin/finance` | Cashflow trend + KPIs | `FINANCE_READ` |
| `/admin/finance/invoices` | List + filter + new + detail/print | `INVOICE_WRITE` |
| `/admin/finance/billing-plans` | CRUD billing plans | `BILLING_PLAN_WRITE` |
| `/admin/finance/expenses` | Operating expenses ledger | `EXPENSE_WRITE` |
| `/admin/finance/settings` | Singleton: FX, prefix, bank, company | `FINANCE_SETTINGS_WRITE` |
| `/admin/products` | Search across tất cả client products | `CLIENT_VIEW` |
| `/admin/users` | User management + role assignment | `USERS_VIEW`/`MANAGE` |

### 6.2 Client portal (`/client`)

| Trang | Mô tả |
|---|---|
| `/client` | Dashboard với 5-phase progress, FDA status, hoa hồng tích luỹ |
| `/client/leads` | Danh sách opportunity của riêng client + lead card |
| `/client/products` | Client tự khai sản phẩm (CRUD) |
| `/client/analytics` | 4 tab: Overview / Pipeline / Win-loss / Financial |

### 6.3 Public pages

| URL | Auth | Mô tả |
|---|---|---|
| `/` | None | Landing page (hero, features, audiences, FAQ, CTA, JSON-LD SEO) |
| `/auth/login` `/auth/signup` `/auth/...` | None | Auth flow |
| `/invoice/[token]` | Token | Public invoice viewer + print + VietQR |
| `/share/[token]` | Token | Public share doc / bundle viewer |
| `/unsubscribe/[token]` | Token | One-click email opt-out |

### 6.4 API routes

| Path | Method | Mô tả |
|---|---|---|
| `/api/ai/generate-email` | POST | AI tạo email draft |
| `/api/ai/send-email` | POST | Approve & send draft |
| `/api/send-email` | POST | Generic transactional |
| `/api/consultation` | POST | Form từ landing → tạo lead |
| `/api/files` | POST | Upload file generic |
| `/api/products/search` | GET | **Public** (chưa auth) — tìm client products active |
| `/api/opportunities/find-by-ref` | GET | Lookup opportunity theo ref code (cho email reply ingress) |
| `/api/export/clients` | GET | CSV export |
| `/api/export/analytics/by-client` | GET | CSV export analytics |
| `/api/export/analytics/stuck` | GET | CSV export bottleneck |

### 6.5 Cron jobs (`vercel.json`)

| Path | Schedule | Mô tả |
|---|---|---|
| `/api/cron/weekly-report` | `0 9 * * 1` (T2 09:00) | Báo cáo tuần qua email |
| `/api/cron/fda-expiry-check` | `0 2 * * *` | Kiểm tra FDA sắp hết hạn → notify |
| `/api/cron/reengage-won` | `0 3 * * *` | Gợi ý re-engagement cho deal won cũ |
| `/api/cron/monthly-retainer` | `0 1 * * *` | Phát hành retainer invoice theo billing anchor |
| `/api/cron/auto-success-fee` | `30 2 * * *` | Phát hành success fee khi deal shipped |
| `/api/cron/invoice-overdue` | `0 4 * * *` | Đánh dấu invoice overdue + gửi reminder |
| `/api/cron/monthly-digest` | `0 8 1 * *` | Digest đầu tháng cho từng client |

---

## 7. Security checklist

| Lĩnh vực | Trạng thái | Ghi chú |
|---|---|---|
| RLS bật trên mọi bảng | ✓ | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| Profiles RLS recursion fix | ✓ | Migration 003 |
| Service role chỉ dùng server-side | ✓ | `lib/supabase/admin.ts` import `server-only` |
| SoD trên SWIFT verification | ✓ | DB CHECK + UI guard |
| Cost price gated cho AE | ✓ | `DEAL_COST_PRICE_WRITE` không trong AE caps |
| Buyer PII mask cho researcher | ✓ | `lib/buyers/mask.ts` |
| Token-protected public pages | ✓ | Invoice / share / unsubscribe |
| Vercel Blob = `access: "private"` | ✓ | Buộc đi qua server action |
| MIME whitelist + size limit (15 MB) | ✓ | `lib/blob/deal-docs.ts` |
| CSRF | ✓ (mặc định) | Server Actions có CSRF token tự động |
| Email idempotency | ✓ | `notification_email_log.dedup_key` UNIQUE |
| Super admin promote chỉ super admin | ✓ | Enforced ở `app/admin/users/actions.ts` |
| Activity audit log | ✓ | Append-only `activities` |

---

## 8. Integrations

| Integration | Purpose | Env vars |
|---|---|---|
| **Supabase** | DB + Auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Vercel Blob** | File storage (private) | `BLOB_READ_WRITE_TOKEN` |
| **Vercel AI Gateway** | LLM cho email draft + reply classifier | (zero config OpenAI/Anthropic/Google) |
| **Resend** | Transactional email | `RESEND_API_KEY`, `RESEND_FROM` |
| **Apollo.io** (optional) | Lead enrichment | `APOLLO_API_KEY` |
| **Vercel Cron** | 7 cron jobs | `CRON_SECRET` (validate header) |
| **Vercel Analytics** | Web analytics | (zero config) |

---

## 9. i18n (vi / en)

- **Mặc định:** `vi`
- **Storage:** cookie + `profiles.preferred_language`
- **Switcher:** `components/i18n/language-switcher.tsx` ở topbar
- **Dictionaries:** `lib/i18n/dictionaries/{vi,en}.ts` — fully typed
- **Server-side translation:** `lib/i18n/server.ts` → `getDictionary(locale)`
- **Client-side hook:** `useTranslation()` từ `language-provider`

Mọi UI string đều phải đi qua dictionary — không hard-code (trừ landing JSON-LD và một số chỗ marketing copy).

---

## 10. Đánh giá hiện trạng & khuyến nghị

### 10.1 Điểm mạnh

- ✅ **RBAC nhất quán** — capability map flat, grep-able, default deny
- ✅ **2 lớp bảo vệ** — RLS ở DB + capability check ở app
- ✅ **Idempotent migrations** — 30+ file SQL đều có `IF NOT EXISTS`
- ✅ **Audit-friendly** — activity log, stage_transitions, notification email log
- ✅ **i18n đầy đủ** — toàn bộ UI vi/en
- ✅ **SEO** — landing có JSON-LD, sitemap.ts, robots.ts, OG image
- ✅ **Idempotent emails** — dedup_key tránh gửi đôi
- ✅ **Type safety** — `Database` type đầy đủ ở `lib/supabase/types.ts`

### 10.2 Rủi ro & nợ kỹ thuật

| # | Vấn đề | Mức độ | Khuyến nghị |
|---|---|---|---|
| 1 | `/api/products/search` chưa có rate limit | Medium | Thêm Upstash Redis rate limit theo IP |
| 2 | `staff` role legacy còn tồn tại | Low | Lên kế hoạch migrate hết sang `account_executive` rồi remove |
| 3 | Một số file doc ở root (`PRODUCT_DISCOVERY_*.md`) trùng lặp | Low | Gộp vào `/docs` và dedupe |
| 4 | Service role được dùng trong vài action không đáng | Medium | Audit lại các call `createAdminClient()`, ưu tiên RLS-aware client |
| 5 | Không có test tự động (unit / e2e) | High | Thêm Vitest cho `lib/*` (permissions, phases, fda/status) + Playwright cho critical flow |
| 6 | Cron `CRON_SECRET` không thấy validate ở mọi route | Medium | Đảm bảo mọi `/api/cron/*` check header `Authorization: Bearer ${CRON_SECRET}` |
| 7 | `email_drafts` không có TTL cleanup | Low | Cron xoá draft `pending_approval` cũ > 30 ngày |
| 8 | Buyer PII mask phụ thuộc UI — nếu API rò rỉ JSON sẽ leak | High | Mask ở tầng query/server action, không chỉ ở UI render |
| 9 | Public invoice token không expire | Medium | Thêm `expires_at` (mặc định 90 ngày) hoặc revoke khi `paid` |
| 10 | Không có monitoring/alerting | High | Tích hợp Sentry hoặc PostHog cho error tracking |

### 10.3 Roadmap đề xuất (ngắn hạn)

1. **Test foundation** — Vitest + Playwright với 5 critical paths (login, create lead, advance stage, upload swift, send invoice)
2. **Rate limiting** — Upstash Redis cho public API
3. **Server-side PII mask** — refactor để mask ở query layer
4. **Sentry integration** — error + performance monitoring
5. **Dedupe markdown docs** — consolidate vào `/docs`
6. **Cron secret validation** — uniform middleware cho `/api/cron/*`

---

## 11. Phụ lục

### 11.1 Danh sách migration

```
001_create_schema.sql                    Core: profiles, leads, opportunities, activities
002_phase2_schema.sql                    Email drafts + AI fields
003_fix_profiles_rls_recursion.sql       Fix RLS infinite recursion
004_client_protection_schema.sql         Buyer info mask state machine
005_notifications_schema.sql             Notifications + preferences
006_notifications_schema_fix.sql         Hot-fix
007_sprint_a_risk_swift.sql              Country risk + SWIFT 2-step verify
008_deals_uniqueness.sql                 UNIQUE (client_id, lead_id), 1 deal/opp
009_sprint_b_compliance_financials.sql   Compliance docs + cost/selling price + profit margin
010_sprint_d_replies_reengagement.sql    Buyer replies + AI classifier
011_sprint_d_view_security_fix.sql       Hot-fix
012_promote_user_to_admin.sql            Manual admin seed
013_security_hardening.sql               Lock-down
014_fda_enforcement_fix.sql              Compliance gate
015_fda_enforcement_v2.sql               v2
016_finance_schema.sql                   Full finance: invoices, billing plans, retainer credits, expenses
017_profiles_phone_fda_expiry.sql        Profile augment
018_profiles_multi_industry.sql          industries[]
019_swift_segregation_of_duties.sql      DB CHECK swift uploader != verifier
020_rbac_five_roles.sql                  super_admin / admin / AE / researcher / finance
021_fix_role_audit_trigger.sql           Hot-fix
022_bundle_share_links.sql               Multi-doc share bundle
023_client_products_schema.sql           Client product catalog
024_integrate_client_products_to_opportunities.sql
025_buyer_confirmation_emails.sql        Buyer confirm log
027_email_ref_code_lookup.sql            Email ref code → opportunity
028_product_categories.sql               Manage categories
029_analytics_schema.sql                 stage_transitions + views + account_manager_id
030_client_analytics_rls.sql             Scope client analytics
20260422_fix_super_admin_rls.sql         Hot-fix
```

### 11.2 Convention reference

- **File path:** absolute, `kebab-case.tsx`
- **Component:** PascalCase named export, server-by-default, opt-in `"use client"`
- **Server action:** suffix `Action`, return `{ ok: boolean, error?: string, data?: T }`
- **Env variable:** scream-case, `NEXT_PUBLIC_*` cho cái client cần thấy
- **SQL migration:** số thứ tự 3 chữ số, idempotent, comment đầy đủ
- **Capability:** flat string `domain:action[:scope]` ở `CAPS`
- **Notification dedup_key:** `<event>:<id>:<discriminator>`

### 11.3 Lệnh thường dùng

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm lint         # ESLint
```

---

**Tài liệu này được tạo tự động từ phân tích codebase ngày 26/04/2026. Khi schema/permission/route thay đổi, cần cập nhật document tương ứng.**
