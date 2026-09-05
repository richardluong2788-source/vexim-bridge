# Phân tích Luồng Vận Hành — Vexim Trade (`vexim-bridge`)

> **Ngày phân tích:** 05/09/2026
> **Phương pháp:** Đọc ngược từ code (`app/`, `lib/`, `scripts/*.sql`, `vercel.json`), **không** dựa vào các file `.md` có sẵn ở thư mục gốc — vì chúng đã lệch đáng kể so với code (xem §10).
> **Phạm vi:** 611 file, ~105.300 dòng TS/TSX, ~8.530 dòng SQL, 66 migration, 52 bảng, 10 view, ~40 trigger, 14 cron job.

---

## 1. Hệ thống này là gì

**Vexim Trade** (`veximtrade.com`) là **phòng kinh doanh xuất khẩu thuê ngoài** (outsourced export sales team) cho nhà sản xuất Việt Nam bán vào thị trường Mỹ, chuyên 4 ngành FDA quản lý: thực phẩm, thực phẩm chức năng (DSHEA), mỹ phẩm (MoCRA), thiết bị y tế (510(k)).

Bản chất phần mềm: **một CRM hai phía (two-sided) có kèm engine tự động hoá**:

```
   PHÍA CUNG (Supply)                PHÍA CẦU (Demand)
   Nhà máy / XK Việt Nam   ←──VXB──→   Buyer nhập khẩu Mỹ
   = "Client" (role=client)            = "Buyer" (bảng `leads`)
```

VXB đứng giữa, làm 4 việc và thu 3 loại phí:

| Việc | Thể hiện trong hệ thống |
|---|---|
| 1. Đăng ký & giám sát tuân thủ FDA cho client | `profiles.fda_*`, `compliance_docs`, trigger `enforce_fda_*` |
| 2. Tìm buyer Mỹ | ImportYeti API, Apollo, `leads`, `buyer_contacts`, `buyer_embeddings` |
| 3. Ghép buyer ↔ nhà cung cấp rồi đàm phán | AI matching (`ae_match_*`), engagement pipeline (`buyer_engagements`), shortlist (`/shortlist/[token]`) |
| 4. Chốt deal, xác thực tiền về, thu USD | `opportunities` (10 stage), `deals`, SWIFT SoD, `invoices`, VietQR |

**Mô hình doanh thu:** `Setup Fee (1 lần) + Monthly Retainer + Success Fee (% profit margin, được offset 50% bằng retainer credit)`.

---

## 2. Stack & 4 bề mặt vận hành

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions), React 19.2, TypeScript 5.7 |
| UI | shadcn/ui + Radix + Tailwind v4, Recharts, @dnd-kit (kanban) |
| DB / Auth | Supabase PostgreSQL + RLS + Auth (cookie SSR qua `@supabase/ssr`) |
| Storage | Vercel Blob (`access: "private"`) |
| Email | Resend (gửi **và nhận** — inbound webhook), nodemailer/Zoho SMTP fallback |
| AI | Vercel AI SDK 6 qua AI Gateway (sinh email, phân loại reply, extract intel, shortlist, embeddings) |
| Dữ liệu ngoài | ImportYeti (bill-of-lading Mỹ), Apollo.io (enrichment) |
| Automation | Vercel Cron (14 job), Telegram Bot (kênh thông báo thứ 3) |

### 4 bề mặt (surface) — đây là cách hệ thống "tiếp xúc" với thế giới

```
┌─ A. PUBLIC / MARKETING (không auth) ────────────────────────────────────────┐
│  /                    Landing (hero, features, FAQ, JSON-LD SEO)            │
│  /legal/*             Terms, Privacy, Cookies                               │
│  /profile/[slug]      Hồ sơ công khai nhà cung cấp (từ `client_profiles`)    │
│  /product/[id] , /products/[id]   Trang sản phẩm công khai + "Request quote" │
│  /auth/*              login, forgot/reset password, accept-invite, callback │
│  /api/products/search API công khai tìm sản phẩm active (⚠ không rate-limit)│
│  /api/consultation    Form landing → tạo lead                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ B. TOKEN-BASED (không cần login, token = giấy thông hành) ─────────────────┐
│  /client-intake/[token]  Prospect tự khai hồ sơ năng lực (AE gửi link)       │
│  /shortlist/[token]      Buyer xem 2-5 supplier AI chọn + bấm "quan tâm"     │
│  /invoice/[token]        Client xem/in hoá đơn + mã VietQR                   │
│  /share/[token]          Chia sẻ chứng từ (PO/Swift/BL/FDA/COA), có bundle   │
│  /unsubscribe/[token]    One-click opt-out email                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ C. ADMIN SHELL  /admin  (5 role nội bộ) ───────────────────────────────────┐
│  Dashboard · My KPI · Buyer của tôi (AE Inbox) · Đang xử lý (Engagements)    │
│  Clients · Hồ sơ chờ duyệt (Intake) · Pipeline (Kanban) · Buyers             │
│  Activities · Unmatched Emails · Analytics · SLA · Country Risk · Finance    │
│  Users                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ D. CLIENT PORTAL  /client  (role=client) ──────────────────────────────────┐
│  Dashboard (5-phase + FDA + hoa hồng) · Leads · Hồ sơ (documents)            │
│  Analytics · SLA & Yêu cầu · Settings/Notifications                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Lưu ý quan trọng:** `/client/products` và `/client/requests` **vẫn tồn tại dưới dạng route nhưng không còn được link từ sidebar client** (`components/client/client-sidebar.tsx`). Toàn bộ cụm tài liệu `PRODUCT_DISCOVERY_*.md` / `EXACT_WORKFLOW.md` / `ARCHITECTURE_OVERVIEW.md` ở thư mục gốc mô tả luồng "client tự vào `/client/products` nhập sản phẩm" — luồng đó hiện là **route mồ côi**. Việc khai báo sản phẩm/năng lực đã dịch chuyển sang (a) form intake công khai và (b) admin quản lý hộ qua `app/admin/clients/products-actions.ts` + `components/admin/admin-client-products-manager.tsx`.

---

## 3. Luồng vận hành tổng thể (end-to-end)

```
                        ┌──────────────────────────────────────┐
                        │   TUYẾN CUNG — onboard nhà cung cấp   │
                        └──────────────────────────────────────┘
  AE tạo link intake ──► /client-intake/[token] ──► client_intake_submissions
  (1 lần, hết hạn 14d)      prospect tự điền          status: pending→submitted
                                                            │
                            badge "Hồ sơ chờ duyệt" ◄───────┘
                                                            │
                        AE duyệt: approveIntakeSubmission ──┤
                                                            ▼
                            profiles(role=client) + client_profiles + FDA fields
                            → gửi invite → /auth/accept-invite → client login /client
                                                            │
                            client_products ◄── admin/AE khai hoặc client tự khai ──┘
                                                            │
                            cron sync-embeddings (03:00) → product_embeddings
                                                            │
                                                            │  (nguồn cung sẵn sàng)
                        ┌───────────────────────────────────┼──────────────────────┐
                        │   TUYẾN CẦU — tìm & nuôi buyer     ▼                      │
                        └──────────────────────────────────────────────────────────┘
  ImportYeti API ─┐                                          │
  Apollo enrich  ─┤                                          │
  Form manual    ─┼──►  leads  (+ buyer_contacts, buyer_embeddings)
  CSV bulk       ─┤            │
  /api/consult.  ─┘            ▼
                     runMatchingPipeline()  ── lib/matching/orchestrator.ts
                     ├─ HARD GATE: chỉ AE có `profiles.industries` ∋ industry buyer
                     ├─ Hybrid score = semantic(embedding) + rules
                     │    HS code 40 · product 25 · country 20 · logistics 10 · priority 5
                     ├─ score ≥ 75          → AUTO-ASSIGN (notify AE)
                     ├─ 50 ≤ score < 75     → ae_match_inbox (pending, expires 7 ngày)
                     └─ không AE nào cover  → SHARED INBOX: 1 row cho MỌI AE,
                                              ai claim trước thắng (first-come-first-served)
                                 │
                                 ▼
        ╔═══════════════════════════════════════════════════════════════════╗
        ║  ENGAGEMENT PIPELINE — vùng làm việc TRƯỚC khi có opportunity      ║
        ║  (đây là luồng vận hành trung tâm hiện nay, migration 051→062)     ║
        ╚═══════════════════════════════════════════════════════════════════╝
                                 │
   claimed ──────────────────────┤ AE bấm "Nhận buyer" (chưa cần chọn client)
        │                        │   UNIQUE partial index: 1 engagement active/lead
        ▼                        │   → 2 AE không thể cùng làm 1 buyer
   requirement_email_sent ───────┤ AI viết email hỏi nhu cầu (VI prompt → EN + VI)
        │                        │   email_drafts → pending_approval → AE duyệt → Resend
        │   ◄─── Resend inbound webhook ──── buyer reply
        │        match 4 tầng → classifyBuyerReply (AI) → buyer_replies
        │        không match  → unmatched_inbound_emails (badge, admin triage tay)
        ▼
   requirements_received ────────┤ AE ghi: sản phẩm, khoảng giá, MOQ,
        │                        │   payment terms, packaging, yêu cầu khác
        ▼
   shortlist_ready ──────────────┤ buildShortlist(): AI chọn 2-5 supplier
        │                        │   + match_score + ai_reasoning
        │                        │   → FROZEN SNAPSHOT (_versions/_items)
        ▼
   shortlist_sent ───────────────┤ approveAndSendShortlist() → shortlist_share_links
        │                        │   → email link /shortlist/[token] cho buyer
        ▼
   buyer_viewed ─────────────────┤ Buyer mở link (không cần login)
        │                        │   dwell-tracker ghi ms xem từng card (RPC có clamp)
        ▼
   qualified_interest ───────────┤ Buyer bấm: requested_info / requested_sample /
        │                        │   requested_meeting / requested_order_discussion
        ▼
   converted ────────────────────┤ AE chọn primary + alternative supplier
        │                        │   → tạo opportunities (stage=new)
        │                        │   → copy yêu cầu buyer vào notes
        │                        │   → re-point buyer_replies về primary opp
   dropped ──────────────────────┘ (có dropped_reason)

   Song song: cron engagement-stale-check (07:00) — im lặng 14 ngày ở
              requirement_email_sent/shortlist_sent → CHỈ cảnh báo AE,
              không tự thu hồi, không tự reassign.
              cron rematch-unassigned (06:00) — quét lại shared inbox.
                                 │
                                 ▼
        ╔═══════════════════════════════════════════════════════════════════╗
        ║  DEAL PIPELINE — 10 stage (Kanban /admin/pipeline, drag & drop)    ║
        ╚═══════════════════════════════════════════════════════════════════╝
   new → contacted → sample_requested → sample_sent → negotiation → price_agreed
       → production → shipped → won / lost

   Client chỉ thấy 5 PHASE (lib/pipeline/phases.ts):
   prospecting → sampling → negotiation → fulfillment → closed_won / closed_lost

   ⛔ GATE 1 (DB trigger): FDA — stage ∉ {new, contacted} mà client thiếu/hết hạn
                            FDA → RAISE EXCEPTION 'FDA_REQUIRED' / 'FDA_EXPIRED'
   ⛔ GATE 2 (app):         SWIFT — nước medium/high risk muốn lên
                            production/shipped/won → bắt buộc deals.swift_verified
   ⛔ GATE 3 (DB CHECK):    SoD — swift_uploaded_by ≠ swift_verified_by
                            (+ trigger: upload lại Swift sẽ RESET verification)
   ⛔ GATE 4 (RBAC):        R-06 — AE KHÔNG được sửa cost_price_supplier
   🔒 MASK:                 buyer_code US-XXXX thay tên thật; view
                            `client_leads_masked` che PII tới tận stage shipped/won
                                 │
                                 ▼
        ╔═══════════════════════════════════════════════════════════════════╗
        ║  TIỀN — finance engine                                             ║
        ╚═══════════════════════════════════════════════════════════════════╝
   billing_plans (per client: setup fee, retainer, success fee %, credit %, anchor day)
   deals.profit_margin_usd  = GENERATED  (selling − cost) × qty
   deals.commission_amount  = GENERATED  invoice_value × rate / 100
                                 │
     cron monthly-retainer  01:00 ─► invoice DRAFT (retainer) nếu đúng anchor day
     cron auto-success-fee  02:30 ─► invoice DRAFT (success fee) khi shipped/won,
                                     trừ 50% retainer credit đã trả
     ── Nguyên tắc: cron chỉ tạo DRAFT, người thật review & bấm Send ──
                                 │
     Admin send → Resend email → /invoice/[token] (public + VietQR Napas 247)
     cron invoice-overdue   04:00 ─► sent + quá due_date → 'overdue' + reminder
                                     (re-reminder theo bucket 7 ngày, chống spam)
                                 │
     markInvoicePaid → retainer_credits ledger (earned/applied/expired)
                                 │
                                 ▼
        ╔═══════════════════════════════════════════════════════════════════╗
        ║  TRÁCH NHIỆM GIẢI TRÌNH — SLA & Analytics                          ║
        ╚═══════════════════════════════════════════════════════════════════╝
   cron sla-monthly-evaluation 02:00 ngày 1 ─► đánh giá 7 chỉ tiêu M1-M7 tháng trước
        M1 pipeline_update_response   M2 monthly_qualified_leads
        M3 monthly_email_outreach     M4 client_request_response
        M5 swift_verification_lag     M6 fda_renewal_alert
        M7 monthly_status_report
   → sla_violations (unique index chống trùng) + sla_evaluation_runs (idempotency lock)
   → tier green/yellow/red/untracked → /admin/sla (nội bộ) + /client/sla (client thấy)

   /admin/my-kpi  → AE: win rate vs team avg, revenue MoM, commission, rank
                  → LR: buyers imported vs target 40/tháng, top country/industry
   /admin/analytics → 5 tab: Overview / By client / Bottleneck / Lost / Buyer perf
   cron monthly-digest 08:00 ngày 1 → email tổng kết tháng cho từng client
   cron weekly-report  09:00 thứ 2  → báo cáo tuần nội bộ

        ╔═══════════════════════════════════════════════════════════════════╗
        ║  VÒNG LẶP SAU KHI THẮNG                                            ║
        ╚═══════════════════════════════════════════════════════════════════╝
   cron reengage-won (03:00) — won ≥ 90 ngày → nhắc client re-engage buyer
   cron archive-lost-opportunities (06:00) — lost ≥ 7 ngày → set archived_at
        (chỉ ẨN khỏi Kanban, KHÔNG xoá — analytics/audit giữ nguyên)
   cron fda-expiry-check (02:00) — FDA còn ≤ 90 ngày → nag client (dedup 14 ngày)
   cron document-expiry-check (05:00) — COA / chứng từ khác sắp hết hạn
```

---

## 4. Bảy luồng con, chi tiết

### 4.1 Onboard nhà cung cấp (tuyến cung)

**Hai cửa vào:**

| Cửa | Dành cho | Cơ chế |
|---|---|---|
| **Intake công khai** (chính) | Prospect chưa có tài khoản | AE sinh link token 1 lần (`client_intake_submissions.token`, mặc định hết hạn 14 ngày). Prospect điền không cần login: thông tin đăng ký (tên, email, phone, công ty, `industries[]`), thông tin công ty (quốc gia, địa chỉ, website, MST) và **hồ sơ năng lực** (tagline, mô tả, sản phẩm chính, công suất, MOQ, lead time, USP points, logo, ảnh bìa, ảnh nhà máy[], video, chứng chỉ). |
| **Admin tạo tay** | Client đã biết | `/admin/clients/new` → `createClientAccount` → gửi invite → `/auth/accept-invite` |

Submission nằm **tách biệt hoàn toàn** khỏi `profiles`/`client_profiles` cho tới khi AE duyệt (`approveIntakeSubmission`) — lúc đó code mới provision tài khoản và mirror các trường năng lực sang `client_profiles`. Có nhánh `rejectIntakeSubmission` + `review_notes`. Cron `client-intake-expiry` (06:00) dọn link chưa dùng quá hạn.

**FDA là điều kiện tiên quyết, cưỡng chế ở tầng DB:**
- `lib/fda/status.ts` → `missing` / `expired` / `expiring_soon (≤90d)` / `valid` (dùng UTC midnight, tránh off-by-one)
- Trigger `enforce_fda_on_opportunity_insert` và `enforce_fda_on_opportunity_stage` (`SECURITY DEFINER`) **raise exception** nếu client không có số FDA hoặc đã hết hạn — không thể lách từ application layer.
- Khi admin sửa cửa sổ hiệu lực → reset `fda_renewal_notified_at = NULL` để reminder không bị "nuốt".

### 4.2 Sourcing buyer (tuyến cầu)

| Nguồn | Đường dẫn | Ghi chú |
|---|---|---|
| **ImportYeti** (chính) | `/admin/buyers/import-importyeti` → `previewImportYeti` → `commitImportYetiPreview` | API bill-of-lading Hải quan Mỹ. `lib/importyeti/api-transformer.ts` + `lib/ai/importyeti-parser.ts` (zod schema) map dữ liệu thô → `leads`: `hs_code`, `secondary_hs_codes`, `main_product`, `total_shipments`, `avg_teu_per_month`, `top_suppliers[]`, `main_import_countries`, `origin_ports`, `destination_ports`, time_series → đỉnh/đáy mùa vụ |
| **AI phân tích buyer** | `lib/ai/buyer-analyzer.ts` | `calculateBuyerHealthScore`, `analyzeSupplierLoyalty` (buyer có đang trung thành với supplier TQ/VN nào không), `calculateVietnamReadiness` (đã từng nhập VN chưa) |
| Form tay | `/admin/leads/new` (`smart-lead-form.tsx`) | **Chỉ `lead_researcher` + `super_admin`** (cap `BUYER_MANUAL_INTAKE`). AE **cố ý bị chặn** — bắt buộc đi qua AI inbox |
| Bulk CSV | `/admin/leads/import` | Đã bị **comment khỏi sidebar**; route + actions vẫn còn (dead surface) |
| Apollo.io | `lib/enrich/apollo.ts` | Optional, chỉ chạy khi có `APOLLO_API_KEY`, không block flow nếu lỗi |
| Landing form | `POST /api/consultation` | Public → tạo lead |

Dedup: theo **email** (lowercase) VÀ **company_name** (chuẩn hoá khoảng trắng), kể cả dedup trong cùng một batch.

### 4.3 AI Matching — phân bổ buyer cho AE

`lib/matching/orchestrator.ts` → `runMatchingPipeline()`:

```
1. loadMatchingConfig()      đọc `matching_config` (weights + thresholds), có normalise
                             format legacy → new
2. loadBuyerContext()        ưu tiên cột chuyên biệt (migration 043), fallback enriched_data
3. loadAllAEContexts()       profiles(role=account_executive) + 3 view:
                             ae_workload_summary, ae_win_rate_by_industry, ae_client_products
3b. HARD GATE theo industry  CHỈ AE có `profiles.industries[]` chứa industry của buyer
                             mới được chấm điểm. Đây là gate cứng, KHÔNG phải factor.
                             (dùng mảng `industries`, fallback `industry` cho row legacy)
4. calculateHybridScoresForBuyer()   semantic (embedding cosine) + rule-based
5. storeScores()             delete-then-insert `ae_match_scores` (kèm breakdown JSON)
6. processResults()          rẽ nhánh theo ngưỡng
```

**Công thức điểm (mặc định, đổi được qua `matching_config`):**

| Factor | Trọng số | Nguồn dữ liệu |
|---|---:|---|
| HS Code Match | 40 | `leads.hs_code` + `secondary_hs_codes` ↔ sản phẩm của client AE phụ trách |
| Product Match | 25 | `main_product` / `product_keywords` ↔ `client_products` (+ semantic) |
| Country Match | 20 | Quốc gia buyer ↔ năng lực/thị trường |
| Logistics Match | 10 | `origin_ports` / `destination_ports` |
| Priority Bonus | 5 | Cờ ưu tiên |
| VN Supplier Bonus | (cộng thêm) | Buyer đã từng nhập từ VN |

> Bốn factor legacy (`industry_match`, `workload`, `win_rate`, `fda_compliance`) vẫn còn trong schema nhưng trọng số mặc định = **0** — công thức đã được viết lại. `industry` giờ là gate cứng chứ không còn là điểm.

**Ngưỡng và 3 kết cục:**

| Điểm | Kết cục | Hiệu ứng |
|---|---|---|
| ≥ 75 (`auto_assign`) | **Auto-assign** | Đánh dấu `ae_match_scores.assignment_source='auto'`, notify `new_assignment`, log activity |
| 50 – 75 (`inbox_min`…`inbox_max`) | **Vào inbox** | 1 row `ae_match_inbox` cho mỗi AE đạt ngưỡng, `priority` high/medium/low, `expires_at` = +7 ngày |
| Không AE nào cover industry | **Shared inbox** | Không chấm điểm, không auto-assign. Tạo 1 row pending cho **MỌI** AE — ai claim trước thắng. Chấp nhận một bản sẽ expire các bản anh em. |

Cron `rematch-unassigned` (06:00) quét lại shared inbox; ngoài ra `rematchOpenSharedInboxLeads()` còn được gọi **đồng bộ ngay** khi onboard client mới hoặc khi AE đổi industry (`app/admin/clients/new/actions.ts`, `app/admin/users/actions.ts`). Cron `sync-embeddings` (03:00) giữ `product_embeddings` / `buyer_embeddings` tươi.

### 4.4 Engagement pipeline — phần "lõi" của vận hành hiện tại

Đây là module mới nhất và là nơi AE spęd phần lớn thời gian. Nó lấp khoảng trống giữa *"AE nhận buyer"* và *"AE gán buyer cho một client"* — trước đây AE buộc phải chọn client ngay lập tức.

**Máy trạng thái (9 stage, DB CHECK constraint):**

```
claimed → requirement_email_sent → requirements_received → shortlist_ready
        → shortlist_sent → buyer_viewed → qualified_interest → converted
                                                             └→ dropped
```

**Ràng buộc then chốt:** `UNIQUE INDEX ... ON buyer_engagements(lead_id) WHERE stage NOT IN ('converted','dropped')` — chỉ **một** engagement active cho mỗi buyer tại một thời điểm → hai AE không thể cùng làm một buyer.

**Các bước, ánh xạ vào code (`app/admin/ae-inbox/engagement-actions.ts`, 964 dòng):**

| # | Hàm | Nghiệp vụ |
|---|---|---|
| 1 | `claimBuyer` | AE nhận buyer **không cần chọn client**. Đóng các inbox row anh em. |
| 2 | `generateRequirementInquiryEmailAction` → `markRequirementEmailSent` | AI (`lib/ai/requirement-email.ts`) sinh email hỏi nhu cầu: prompt tiếng Việt → **email tiếng Anh** + bản dịch tiếng Việt tham khảo → `email_drafts` (`pending_approval`) → AE duyệt → gửi Resend → lưu `smtp_message_id`/`resend_message_id` để nối thread về sau, reset `stale_reminder_sent_at`. |
| 3 | `saveBuyerRequirements` | AE chép lại câu trả lời của buyer (từ email/điện thoại/WhatsApp): `requested_products`, `target_price_range`, `moq`, `payment_terms`, `packaging_requirements`, `other_requirements`. |
| 4 | `buildShortlist` | AI chọn 2–5 supplier khớp, ghi `match_score` + `ai_reasoning` vào `buyer_engagement_shortlist_versions` / `_items`. **Snapshot đóng băng**: supplier sửa profile sau đó **không** làm thay đổi nội dung buyer đã nhận — muốn cập nhật phải tạo version mới (`createNewShortlistVersion`, link mới). |
| 5 | `approveAndSendShortlist` | Sinh `shortlist_share_links` (token) → email link cho buyer. |
| 6 | `markBuyerAction` | Ghi nhận hành vi buyer từ trang công khai. |
| 7 | `convertEngagementToOpportunities` | AE chọn **1 primary + N alternative** supplier → `assignBuyerToClients` tạo opportunities (`stage=new`), ghi `source_engagement_id` + `source_role`, chép khối yêu cầu buyer vào `notes`, **re-point** `buyer_replies` về primary opportunity (FK đơn — một reply chỉ "sống" trên một opp). |
| 8 | `dropEngagement` / `transferEngagement` | Bỏ (có `dropped_reason`) hoặc chuyển AE khác (migration 056). |

**Trang buyer công khai `/shortlist/[token]`** — điểm tinh vi nhất về mặt sản phẩm:
- Không cần login; token là bearer.
- **Dwell-time tracking** (`dwell-tracker.tsx`): đo số ms mỗi card supplier hiện ≥60% trong viewport → `increment_shortlist_item_dwell` (RPC `SECURITY DEFINER`, re-validate item thuộc đúng version, **clamp delta** để payload bị chỉnh sửa không thổi phồng số liệu). Lý do có cột này: `view_count`/`last_viewed_at` chỉ nói buyer **mở link**, không nói họ **đọc option nào** — và rất nhiều buyer không bao giờ bấm nút.
- **Interest button**: buyer chỉ set được `viewed_only`, `interested_no_details`, `requested_info`, `requested_sample`, `requested_meeting`, `requested_order_discussion`. Ba giá trị `selected_primary`, `sent_price_volume`, `sent_po` là **phân loại nội bộ AE-only** — migration 054 siết CHECK constraint để buyer không thể tự kích hoạt chúng bằng một cú click.

### 4.5 Inbound email — vòng phản hồi (và chỗ từng rò rỉ dữ liệu)

`app/api/webhooks/resend/route.ts` (862 dòng) là điểm vào của mọi email buyer gửi tới `trade@veximtrade.com`:

```
Resend 'email.received' (chỉ có metadata)
   │
   ├─ fetchEmailContent() qua GET /emails/receiving/:id  (KHÔNG phải /emails/:id)
   ├─ extractReplyBody(): cắt chữ ký & phần quote (--, ___, "On ... wrote:", "From:",
   │                      "Sent from my", "Get Outlook for", "> ")
   │
   ├─ findOpportunityByEmail()  ← thử TRƯỚC (match cụ thể hơn thì thắng)
   │    M1 In-Reply-To ↔ email_drafts.smtp_message_id|resend_message_id   conf 0.95
   │    M2 from ↔ buyer_contacts.email (mọi contact, không chỉ contact chính)  0.75
   │    M3 from ↔ email_drafts.recipient_email của draft đã SENT          conf 0.80
   │    M4 from domain ↔ buyer_contacts cùng domain                       conf 0.50
   │       (KHÔNG áp dụng cho free webmail — gmail/yahoo/… — để tránh gắn nhầm)
   │
   ├─ findEngagementByEmail()  ← chỉ khi không tìm ra opportunity
   │    (cùng 3 phương pháp nhưng khớp theo engagement_id)
   │
   ├─ classifyBuyerReply() (AI) → intent (price_request / sample_request /
   │    objection / closing_signal / general), summary, confidence,
   │    suggested_next_step  → INSERT buyer_replies
   │
   ├─ isUnrecognizedSender → nhắc AE thêm người này vào buyer_contacts
   │    (trường hợp được giới thiệu/chuyển tiếp trong cùng công ty)
   │
   └─ KHÔNG match được gì → INSERT unmatched_inbound_emails
        (trước đây webhook trả 200 OK rồi vứt email đi — migration 063 ghi rõ
         đây là "nguyên nhân số 1 của việc buyer đã trả lời mà AE không bao giờ
         nhìn thấy"). Admin triage tay ở /admin/unmatched-emails, có badge.
```

Idempotency email toàn hệ thống: `notification_email_log.dedup_key` UNIQUE, quy ước `<event>:<id>:<discriminator>` (ví dụ `opp_stage:{oppId}:{before}->{after}`).

### 4.6 Deal pipeline & các chốt kiểm soát

**10 stage admin → 5 phase client** (`lib/pipeline/phases.ts`) — client cố ý bị ẩn chi tiết vận hành để giảm nhiễu.

**Bảng các chốt kiểm soát (control gate):**

| Gate | Tầng | Nội dung | Nguồn |
|---|---|---|---|
| **FDA** | DB trigger `SECURITY DEFINER` | Stage ∉ {new, contacted} mà client thiếu/hết hạn FDA → `RAISE EXCEPTION` | `scripts/014`, `015` |
| **SWIFT theo rủi ro quốc gia** | App (server action) | Nước medium/high risk muốn lên `production`/`shipped`/`won` → phải `deals.swift_verified = TRUE` | `lib/risk/country-risk.ts`, `app/admin/opportunities/actions.ts` |
| **Segregation of Duties** | DB CHECK | `swift_uploaded_by <> swift_verified_by` | `scripts/019` |
| **Reset khi re-upload** | DB trigger | Upload lại Swift → tự xoá trạng thái verified (`deals_swift_reupload_resets_verification`) | `scripts/019`+ |
| **R-06 cost price** | App (RBAC) | `account_executive` **không** có `DEAL_COST_PRICE_WRITE` | `lib/auth/permissions.ts` |
| **Deal uniqueness** | DB UNIQUE | `(client_id, lead_id)` trên opportunities; `opportunity_id` UNIQUE trên deals → 1 opp tối đa 1 deal | `scripts/008` |
| **Buyer identity protection** | DB view | `client_leads_masked` che `contact_email/phone/person/website/linkedin` tới khi stage ∈ {shipped, won} — che **ở tầng query**, không chỉ ở render | `scripts/011`+ |
| **Integrity số liệu tài chính** | DB GENERATED | `deals.profit_margin_usd` và `commission_amount` là GENERATED STORED → application **không thể ghi đè** | `scripts/009`, `016` |
| **Audit bất biến** | DB trigger | `activities_block_delete` + `activities_block_update`; `stage_transitions` append-only | `scripts/013`, `029` |

**Country risk engine** (`lib/risk/country-risk.ts`) — pure function, không dependency, dùng chung cho cả preview phía client và gate phía server:
- **High risk (17 nước):** PK, NG, IR, KP, SY, AF, YE, SD, SS, MM, VE, CU, IQ, LY, SO, BY, RU → yêu cầu Sight L/C hoặc 100% T/T trả trước + Swift verified.
- **Medium (23 nước):** BD, IN, ID, PH, EG, TR, KE, GH, … → T/T cọc 30–50% + Swift verified.
- **Low (35 nước):** US, CA, GB, AU, DE, JP, SG, … → không bắt buộc.
- **Country null/unknown → mặc định medium** (fail-safe).
- Bảng DB `country_risk` cho phép admin override/register tại `/admin/country-risk`.

**Chứng từ & công cụ hỗ trợ chốt deal:**
- `compliance_docs` (`fda_certificate` | `coa` | `price_floor` | `factory_video` | `factory_photo` | `other`) + `compliance_doc_history` (audit mỗi lần đổi) → upload Vercel Blob `access:"private"`, MIME whitelist, giới hạn 15 MB.
- `tokenized_share_links` + `_docs` — chia sẻ đơn lẻ hoặc **bundle** nhiều chứng từ, có `expires_at`, `revoked_at`, `view_count`, `last_viewed_at`.
- `lc_verifications` + `bank_directory` — kiểm tra L/C: `normalizeBic()` → `lookupBank()` (BIC/SWIFT → ngân hàng, tier 1-4).
- `commercial_intelligence` — CI ghi tay/AI per opportunity.
- `opportunity_pricing_suggestions` + `/api/pricing/{status,suggestions}` — gợi ý giá.
- `lib/ai/document-advisor.ts` (961 dòng) — `analyzeDocumentsForOpportunity`, `quickDocumentCheck`.
- `buyer_intel_notes` + `lib/ai/buyer-intel-extractor.ts` (zod) — bóc thông tin cấu trúc từ note thô, rồi `applyBuyerIntelToOpportunity`.

### 4.7 Finance engine

```
finance_settings (singleton)  ── FX rate, invoice prefix, company info, bank (Napas BIN)
billing_plans (per client)    ── setup_fee, monthly_retainer_usd, success_fee_%,
                                 retainer_credit_% (mặc định 50), billing_anchor_day
        │
        ▼
invoices ── 4 kind: setup_fee | retainer | success_fee | manual
         ── 7 status: draft → sent → paid | partial | overdue | void | ...
         ── public_token → /invoice/[token] (in được + mã VietQR)
         ── snapshot issuer/bank tại thời điểm phát hành (không đổi theo settings)
         ── đánh số qua `invoice_counters` (bộ đếm đơn điệu theo năm, an toàn
            dưới concurrency) + trigger `on_invoices_before_insert`
        │
        ▼
retainer_credits ── ledger append-only: earned | applied | expired | adjustment
operating_expenses ── chi ra: salary, tools, marketing, office, legal, travel, other
```

**Nguyên tắc thiết kế đáng chú ý:** mọi cron tài chính chỉ tạo invoice ở trạng thái **`draft`**, không bao giờ tự gửi. Người thật mở `/admin/finance/invoices`, review rồi bấm Send. Đây là chủ đích (ghi rõ trong `monthly-retainer/route.ts`) để giữ human-in-the-loop ở chỗ tiền thật.

**VietQR** (`lib/finance/vietqr.ts`): sinh ảnh QR Napas 247 cho phần thanh toán VND, `usdToVnd()` theo FX trong `finance_settings`, 4 template (`compact`/`compact2`/`qr_only`/`print`). `VN_BANKS` là danh mục BIN ngân hàng VN nội bộ.

### 4.8 SLA — cơ chế tự chấm điểm chính mình

7 chỉ tiêu theo §7.3 hợp đồng dịch vụ, đánh giá **hàng tháng** cho **từng client**:

| Metric | Đo cái gì | Nguồn dữ liệu |
|---|---|---|
| M1 `pipeline_update_response` | Pipeline được cập nhật trong 1 ngày làm việc | `stage_transitions`, `activities` |
| M2 `monthly_qualified_leads` | Số opportunity vượt ngưỡng "qualified" / tháng | `opportunities.qualified_at` (trigger bắt lần đầu rời `new`) |
| M3 `monthly_email_outreach` | Số email buyer đã gửi / tháng | `email_drafts` (status=sent) |
| M4 `client_request_response` | Thời gian phản hồi yêu cầu client | `client_requests` + `client_request_replies` |
| M5 `swift_verification_lag` | Verify Swift trong Y ngày làm việc | `deals.swift_*` |
| M6 `fda_renewal_alert` | Cảnh báo FDA ≥ 90 ngày trước hết hạn | `profiles.fda_renewal_notified_at` |
| M7 `monthly_status_report` | Digest tháng đã gửi client | `notification_email_log` |

- `sla_targets` — ngưỡng per-plan + global default (`/admin/sla/targets`)
- `sla_holidays` — lịch nghỉ lễ; `lib/sla/business-hours.ts` tính theo **timezone Việt Nam** (`businessDaysBetween`, `businessHoursBetween`, `isWeekend`, `isHoliday`)
- `sla_violations` — unique index `(client_id, metric_key, period_month, occurrence_in_month)` → re-run sau crash không nhân bản
- `sla_evaluation_runs` — `INSERT ... ON CONFLICT DO NOTHING` để **claim quyền sở hữu kỳ đánh giá**; lời gọi đồng thời nhận NULL và rút lui
- `lib/sla/scoring.ts` — `tierForViolations()` → green/yellow/red/untracked; `sla_monthly_summary` view
- **Client thấy SLA của chính mình** tại `/client/sla` — đây là cam kết công khai, không phải số liệu nội bộ. Cũng tại đó client gửi `client_requests` (chính là nguồn đo M4).

### 4.9 Notifications — 3 kênh, 1 dispatcher

`lib/notifications/dispatcher.ts` → `dispatchNotification()`:

```
                       ┌──► in-app  `notifications` (realtime, category, link_path, read_at)
dispatchNotification ──┼──► email   Resend / nodemailer → `notification_email_log`
                       │            (dedup_key UNIQUE → gửi tối đa 1 lần kể cả khi retry)
                       └──► Telegram `notification_telegram_log`
```

- **5 category:** `action_required`, `status_update`, `deal_closed`, `new_assignment`, `system`
- **Per-user, per-channel, per-category toggles** trong `notification_preferences` (`email_*` và `telegram_*` là **hai map tách rời** — chủ đích để hai kênh có thể phân kỳ sau này). `system` không cấu hình được theo category, chỉ theo master switch.
- **Song ngữ:** mọi notification truyền `{vi, en}`; dispatcher chọn theo `profiles.preferred_language` **tại thời điểm gửi**.
- **Telegram binding:** user bấm deep link `t.me/<bot>?start=<token>` → webhook `/api/telegram/webhook` (xác thực bằng header `X-Telegram-Bot-Api-Secret-Token`, tái dùng `CRON_SECRET`) → resolve token → lưu `chat_id`.
- **Sidebar badges** (`lib/nav/sidebar-badges.ts`) — điểm thiết kế tốt: mỗi badge được tính bằng **đúng định nghĩa & đúng scope** mà trang đích của nó dùng, nên badge không bao giờ "nói dối" khi click vào: `myBuyers`, `inProgress` (stage=claimed **hoặc** có reply chưa đọc), `pipeline` (opp có reply chưa đọc), `buyers` (tổng), `unmatchedEmails`, `pendingIntake`.

---

## 5. RBAC & ownership scoping

**7 role**, capability map flat (`lib/auth/permissions.ts`), **default deny**, hai lớp phòng thủ (capability ở app + RLS ở DB). DB là source of truth — `user_metadata` không bao giờ được tin (có thể spoof); không xác định được role thì fallback `/client` (least-privilege).

| Role | Vào shell | Điểm đặc trưng |
|---|---|---|
| `super_admin` | `/admin` | Toàn quyền + **độc quyền** promote/demote super_admin khác (enforce ở `app/admin/users/actions.ts`, không qua capability) |
| `admin` | `/admin` | = super_admin **trừ** `BUYER_MANUAL_INTAKE` |
| `account_executive` | `/admin` | Sales. **Không** `DEAL_COST_PRICE_WRITE` (R-06). Không `OWNERSHIP_BYPASS`. `MATCH_INBOX_VIEW` là luồng chính hằng ngày |
| `lead_researcher` | `/admin` | Role hẹp, chỉ buyer. Có `BUYER_MANUAL_INTAKE`. **Không** `BUYER_PII_VIEW` → UI phải mask. Không thấy clients/pipeline/SLA |
| `finance` | `/admin` | Full finance + `ANALYTICS_VIEW_ALL` + `SLA_VIEW_ALL` + `OWNERSHIP_BYPASS` (cần thấy mọi deal để xuất hoá đơn) |
| `staff` (legacy) | `/admin` | Xử lý như AE |
| `client` | `/client` | Không enforce qua capability |

**Ownership scoping** (`lib/auth/scope.ts` → `ownershipScopeFor()`):
- Có `OWNERSHIP_BYPASS` (super_admin, admin, finance) → thấy/sửa **mọi** bản ghi.
- Không có (AE, LR, staff) → chỉ bản ghi mình own, dựa trên `profiles.account_manager_id` (live) và `opportunities.account_manager_id` (snapshot). Đây là thứ làm cho **kế toán doanh thu theo từng AE** đáng tin: AE không thể vô ý chạm vào deal của AE khác.
- `ANALYTICS_VIEW_ALL` vs `ANALYTICS_VIEW_OWN`, `SLA_VIEW_ALL` vs `SLA_VIEW_OWN` — cùng một nguyên tắc.

**Một ngoại lệ cố ý:** `COUNTRY_RISK_READ` **không** cấp cho AE/LR — sổ đăng ký rủi ro quốc gia do super_admin/admin quản để phân loại nhất quán toàn tổ chức; AE/LR vẫn *thấy* mức rủi ro từng nước trên trang buyer/client (read-through DB) nhưng không mở được sổ.

---

## 6. Toàn bộ 14 cron job (`vercel.json`)

| # | Path | Schedule (UTC) | Việc | Ghi chú vận hành |
|---|---|---|---|---|
| 1 | `/api/cron/monthly-retainer` | `0 1 * * *` (01:00 hằng ngày) | Kiểm tra `billing_anchor_day` của từng plan (clamp vào ngày cuối tháng ngắn) → tạo invoice **draft** retainer | Bỏ qua nếu tháng đó đã có |
| 2 | `/api/cron/fda-expiry-check` | `0 2 * * *` (02:00) | Quét client có `fda_expires_at`, notify `action_required` khi sắp hết hạn/đã hết hạn | Re-notify mỗi ~14 ngày trong cửa sổ 90 ngày, không nag hằng ngày |
| 3 | `/api/cron/sla-monthly-evaluation` | `0 2 1 * *` (02:00 ngày 1) | Đánh giá SLA **tháng trước** cho mọi client | Idempotent 2 tầng (run-lock + unique violation index) |
| 4 | `/api/cron/auto-success-fee` | `30 2 * * *` (02:30) | Deal `shipped`/`won` + `commission_amount > 0` + chưa có invoice → tạo **draft** success_fee, đã trừ 50% retainer credit | Cố ý tạo draft, không tự gửi |
| 5 | `/api/cron/sync-embeddings` | `0 3 * * *` (03:00) | Sync `product_embeddings` + sinh `buyer_embeddings` cho lead mới/active | Giữ semantic matching tươi |
| 6 | `/api/cron/reengage-won` | `0 3 * * *` (03:00) | Opp `won` + `last_updated` ≥ 90 ngày + `reengagement_task_created_at IS NULL` → activity + notify client | Stamp marker để lần sau không trùng |
| 7 | `/api/cron/invoice-overdue` | `0 4 * * *` (04:00) | Invoice `sent` + `due_date < today` → status `overdue` + notify nội bộ + email nhắc client | Re-reminder theo bucket 7 ngày |
| 8 | `/api/cron/document-expiry-check` | `0 5 * * *` (05:00) | Cảnh báo chứng từ (COA, v.v.) sắp hết hạn theo nhiều ngưỡng | Có khoảng chống spam |
| 9 | `/api/cron/rematch-unassigned` | `0 6 * * *` (06:00) | Re-run AI matching cho buyer còn nằm shared inbox | Lưới an toàn; đường chính là gọi đồng bộ khi onboard client / AE đổi industry |
| 10 | `/api/cron/client-intake-expiry` | `0 6 * * *` (06:00) | Xoá link intake chưa dùng đã quá hạn | |
| 11 | `/api/cron/archive-lost-opportunities` | `0 6 * * *` (06:00) | Opp ở `lost` ≥ 7 ngày → set `archived_at` | Đồng hồ tính từ `stage_transitions.transitioned_at` của lần vào `lost` gần nhất, **không** từ `last_updated`. Chỉ ẩn khỏi Kanban, **không xoá** |
| 12 | `/api/cron/engagement-stale-check` | `0 7 * * *` (07:00) | Engagement ở `requirement_email_sent`/`shortlist_sent` im lặng 14 ngày → **chỉ cảnh báo AE** | Cố ý không tự thu hồi buyer, không tự reassign — AE vẫn là owner và tự quyết |
| 13 | `/api/cron/monthly-digest` | `0 8 1 * *` (08:00 ngày 1) | Email digest tháng trước (+ tháng trước nữa để có mũi tên delta) cho từng client | Bỏ qua nếu: client không có email / không có hoạt động / `email_enabled=false` |
| 14 | `/api/cron/weekly-report` | `0 9 * * 1` (09:00 thứ 2) | Báo cáo pipeline tuần nội bộ | |

**Bảo mật cron:** cả 14 route đều validate `Authorization: Bearer ${CRON_SECRET}` — đây là điểm mà `SYSTEM_AUDIT.md` liệt kê là rủi ro "Medium" (#6) nhưng thực tế **đã được làm đồng nhất**. Telegram webhook cũng tái dùng chính secret này qua header riêng.

---

## 7. Biến môi trường cần có

| Biến | Dùng cho | Bắt buộc? |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | DB + Auth. `next.config.mjs` re-expose thành `NEXT_PUBLIC_SUPABASE_*` để inline vào bundle trình duyệt | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` — bypass RLS, chỉ server-side (`import "server-only"`) | ✅ |
| `CRON_SECRET` | 14 cron + Telegram webhook secret | ✅ |
| `RESEND_API_KEY`, `MAIL_FROM` / `RESEND_FROM` | Gửi **và nhận** email (Receiving API) | ✅ |
| `ZOHO_SMTP_USER` (+ pass) | Fallback nodemailer | Optional |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob private | ✅ |
| `IMPORTYETI_API_KEY` | Sourcing buyer | ✅ cho luồng chính |
| `APOLLO_API_KEY` | Enrichment | Optional |
| `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Kênh Telegram | Optional |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` / `VERCEL_PROJECT_PRODUCTION_URL` | URL canonical trong email, link công khai | ✅ |
| AI Gateway key (OpenAI/Anthropic/Google) | Vercel AI SDK 6 | ✅ |

> `lib/site-config.ts` có một quyết định đáng ghi nhận: **cố ý không** fallback về `VERCEL_URL`/`NEXT_PUBLIC_VERCEL_URL` vì đó là URL hash theo deployment, nằm sau Deployment Protection SSO → sẽ **làm gãy mọi link gửi cho người dùng cuối** (email, invoice, shortlist).

---

## 8. Mô hình dữ liệu (52 bảng, 10 view)

```
NHÂN DẠNH & QUYỀN          profiles · notification_preferences · country_risk
BUYER (CẦU)                leads · buyer_contacts · buyer_replies · buyer_email_log
                           buyer_intel_notes · buyer_embeddings · unmatched_inbound_emails
GHÉP NỐI (AI)              matching_config · ae_match_scores · ae_match_inbox
                           semantic_match_logs · product_embeddings
                           [view] ae_workload_summary · ae_win_rate_by_industry
                                  ae_client_products · buyer_pool
ENGAGEMENT (pre-opp)       buyer_engagements · buyer_engagement_shortlist_versions
                           buyer_engagement_shortlist_items · shortlist_share_links
CLIENT (CUNG)              client_profiles · client_products · product_categories
                           client_intake_submissions · client_factory_assessments
                           client_requests · client_request_replies
                           [view] client_leads_masked · client_opportunities_with_products
DEAL                       opportunities · deals · stage_transitions · activities
                           commercial_intelligence · lc_verifications · bank_directory
                           opportunity_pricing_suggestions
                           [view] opportunity_metrics_v · client_pipeline_metrics_v
COMPLIANCE                 compliance_docs · compliance_doc_history
                           tokenized_share_links · tokenized_share_link_docs
TÀI CHÍNH                  finance_settings · billing_plans · invoices · invoice_counters
                           retainer_credits · operating_expenses
                           [view] client_commission_timeline
SLA                        sla_targets · sla_holidays · sla_violations · sla_evaluation_runs
                           [view] sla_monthly_summary
EMAIL AI                   email_drafts
NOTIFICATION               notifications · notification_email_log · notification_telegram_log
```

**Đặc điểm thiết kế DB đáng chú ý:**
- **RLS bật trên mọi bảng nghiệp vụ**, policy role-aware đọc từ `profiles.role`.
- **Append-only có cưỡng chế:** `activities_block_delete` + `activities_block_update` trigger; `stage_transitions` và `retainer_credits` là ledger.
- **GENERATED STORED** cho `profit_margin_usd` và `commission_amount` → số liệu tài chính không thể bị app ghi đè.
- **SECURITY DEFINER RPC** cho các đường ghi nhạy cảm từ trang công khai (`increment_shortlist_item_dwell`, `markShortlistInterest`) — luôn re-validate quyền và clamp input.
- **Partial unique index** để diễn đạt ràng buộc nghiệp vụ mềm: `buyer_engagements(lead_id) WHERE stage NOT IN ('converted','dropped')`.
- Migration **đánh số 3 chữ số, idempotent** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`), comment giải thích *tại sao* chứ không chỉ *cái gì*.

---

## 9. Điểm mạnh kiến trúc (đã kiểm chứng trong code)

1. **Chốt kiểm soát đặt đúng tầng.** Những gì không được phép sai (FDA, SoD Swift, profit margin, commission, audit log) đều cưỡng chế ở **DB trigger / CHECK / GENERATED**, không dựa vào validation phía app. App có bug cũng không phá được bất biến.
2. **Bài học từ sự cố được mã hoá thành migration.** `063_unmatched_inbound_emails` ghi thẳng trong comment: trước đây webhook trả 200 OK rồi vứt email không match đi — "nguyên nhân số 1 của việc buyer đã trả lời mà AE không bao giờ thấy". `054` siết `buyer_action` sau khi nhận ra buyer có thể tự kích hoạt phân loại nội bộ. `019` thêm SoD sau khi phát hiện cùng một admin vừa upload vừa verify Swift. `client_leads_masked` ra đời để vá việc mask chỉ làm ở tầng render (F12 là đọc được PII thô). Đây là dấu hiệu của một hệ thống **được vận hành thật và được sửa từ vận hành thật**.
3. **Human-in-the-loop ở đúng chỗ.** AI sinh, người duyệt: email draft ở `pending_approval`, shortlist phải `approveAndSendShortlist`, invoice tài chính chỉ là `draft`. Cron không bao giờ tự gửi thứ gì liên quan tới tiền hoặc quan hệ khách hàng.
4. **Idempotency có hệ thống.** `dedup_key` UNIQUE cho email, run-lock cho SLA, marker `reengagement_task_created_at` / `fda_renewal_notified_at` / `stale_reminder_sent_at`, re-reminder theo bucket 7 ngày, migration idempotent.
5. **Snapshot đóng băng** cho shortlist: buyer luôn thấy đúng những gì đã được gửi, không bị profile supplier thay đổi về sau — kèm versioning để chủ động tạo bản mới.
6. **Ownership scoping nhất quán** từ DB → capability → view → badge sidebar. Badge dùng đúng định nghĩa của trang đích nên không bao giờ lệch.
7. **Cố ý không làm một số thứ:** `engagement-stale-check` **không** tự thu hồi buyer; shared inbox **không** fallback sang chấm điểm mọi AE (sẽ vô hiệu hoá gate industry). Cả hai đều có comment giải thích lý do nghiệp vụ.

---

## 10. Vấn đề phát hiện được — xếp theo mức độ

### 🔴 Cao

| # | Vấn đề | Bằng chứng | Đề xuất |
|---|---|---|---|
| 1 | **Tài liệu gốc lệch nghiêm trọng so với code** — và lệch đúng vào phần quan trọng nhất | `SYSTEM_AUDIT.md` (26/04/2026): ghi **7** cron (thực tế **14**), danh sách migration dừng ở **030** (thực tế **066**), không hề nhắc `buyer_engagements` / AE Inbox / shortlist / ImportYeti / SLA / client-intake / Telegram — tức **toàn bộ luồng vận hành trung tâm hiện nay**. `docs/BUSINESS_FLOW_AUDIT.md` (19/04): ghi "3 cron job", vẫn mô tả R-05 (SoD Swift) và R-07 (mask PII ở UI) như rủi ro **đang mở** trong khi code đã fix cả hai. 11 file `.md` nằm rời ở thư mục gốc, nhiều file trùng nội dung. | Coi tài liệu này là **không đáng tin** khi onboarding người mới. Viết lại một tài liệu duy nhất (file này) làm source of truth, xoá/gộp 11 file gốc vào `docs/`, và thêm quy ước "sửa luồng thì sửa doc trong cùng PR". |
| 2 | **`lib/supabase/types.ts` chỉ khai báo 18/52 bảng, 0/10 view** | `ae_match_scores`, `ae_match_inbox`, `matching_config`, `buyer_engagements`, `buyer_engagement_shortlist_*`, `sla_*`, `invoices`, `billing_plans`, `client_intake_submissions`, `unmatched_inbound_emails`… đều **không có type**. Orchestrator thậm chí phải cast chéo kiểu client để tránh overload sụp về `never`. | Chạy `supabase gen types typescript` và đưa vào CI. Đây là lỗ hổng type-safety lớn nhất hiện nay vì rơi đúng vào các module mới & phức tạp nhất. |
| 3 | **`typescript.ignoreBuildErrors: true`** trong `next.config.mjs` | Kết hợp với #2 → lỗi kiểu ở các module mới **không bao giờ chặn được build**. | Bỏ cờ này sau khi regenerate types; nếu chưa thể, ít least bật `eslint` gate trong CI. |
| 4 | **Không có test tự động nào** | `package.json` chỉ có `dev`/`build`/`start`/`lint`. Không Vitest, không Playwright. Trong khi hệ thống có rất nhiều pure function dễ test: `lib/pipeline/phases.ts`, `lib/fda/status.ts`, `lib/risk/country-risk.ts`, `lib/sla/business-hours.ts`, `lib/auth/permissions.ts`, `lib/matching/scorer.ts`, `lib/protection/mask.ts`. | Thêm Vitest cho 6 module pure trên trước (giá trị/rủi ro cao nhất, chi phí thấp nhất), rồi Playwright cho 5 đường critical: login → claim buyer → gửi shortlist → advance stage → send invoice. |

### 🟡 Trung bình

| # | Vấn đề | Bằng chứng | Đề xuất |
|---|---|---|---|
| 5 | **Lịch sử git chỉ có 1 commit** (`b6478fe`, 03/09/2026, "thêm bổ sung vào bộ lọc") | Toàn bộ ~105k dòng được nạp một lần. Không có audit trail ở tầng code, không thể `git blame` để hiểu tại sao một quyết định được đưa ra — trong khi chính codebase này rất coi trọng audit trail ở tầng dữ liệu. | Nếu repo gốc có lịch sử, hãy giữ nó. Nếu không, chấp nhận và bù bằng convention commit chặt chẽ từ nay. |
| 6 | **File build & archive bị commit** | `tsconfig.tsbuildinfo` (1,4 MB), `Vexim-bridge.zip` (1,6 MB), `scripts-test-db-tmp.mjs` (file test tạm) — đều nằm trong git. `.gitignore` không có `*.tsbuildinfo`. | Thêm `*.tsbuildinfo` vào `.gitignore`, `git rm --cached` ba file trên. |
| 7 | **`scripts/xoa_du_lieu.txt` — script TRUNCATE toàn bộ dữ liệu nằm trong repo** | `TRUNCATE TABLE ... CASCADE` cho gần như mọi bảng nghiệp vụ. Không có guard, không có xác nhận, đặt tên tiếng Việt ("xoá dữ liệu"). | Di chuyển ra khỏi repo hoặc đổi thành script có guard rõ ràng (`--i-really-mean-it`, check `app.env != 'production'`). Rủi ro vận hành thực tế nếu ai đó copy-paste nhầm vào Supabase SQL Editor của production. |
| 8 | **`/api/products/search` công khai, không auth, không rate-limit** | Không có bất kỳ check `auth`/`getUser`/`role`/secret nào trong route. RLS chỉ lọc `status='active'`. | Thêm rate limit (Upstash) và cân nhắc yêu cầu API key. Hiện tại đây là bề mặt scrape mở. |
| 9 | **Route mồ côi ở client portal** | `/client/products` và `/client/requests` tồn tại đầy đủ (page + actions) nhưng **không được link** từ `client-sidebar.tsx`; toàn bộ cụm doc PRODUCT_DISCOVERY mô tả chúng như luồng chính. | Quyết định rõ: hoặc đưa vào sidebar (nếu client vẫn tự khai sản phẩm), hoặc xoá route + xoá doc (nếu đã chuyển sang intake + admin quản lý hộ). Trạng thái lưng chừng hiện nay là nguồn gây nhầm lẫn. |
| 10 | **`/admin/leads/import` bị comment khỏi sidebar nhưng code vẫn còn** | Dòng comment trong `admin-sidebar.tsx`. | Xoá hẳn hoặc bật lại có chủ đích. |
| 11 | **Component phình to** | `app/admin/ae-inbox/engagement-list.tsx` **2.613 dòng / 108 KB**, `components/admin/buyer-detail-view.tsx` 2.170 dòng, `client-compliance-workspace.tsx` 1.423 dòng. | Tách theo tab/section. `engagement-list.tsx` là nơi chứa toàn bộ luồng lõi nên khó bảo trì và khó review nhất. |

### 🟢 Thấp

| # | Vấn đề | Đề xuất |
|---|---|---|
| 12 | Country risk high/medium/low hard-code trong TS (`lib/risk/country-risk.ts`), dù đã có bảng DB `country_risk` | Thống nhất: đọc từ DB với `effective_date`, giữ hard-code làm seed/fallback |
| 13 | Role `staff` legacy vẫn còn | Lên kế hoạch migrate sang `account_executive` rồi remove khỏi enum |
| 14 | `email_drafts` không có TTL cleanup | Cron xoá draft `pending_approval` > 30 ngày |
| 15 | Không có monitoring/alerting (Sentry/PostHog) | Đặc biệt cần cho webhook Resend và 14 cron — hiện lỗi chỉ hiện trong log Vercel |
| 16 | Tên package trong `package.json` vẫn là `"my-project"` | Đổi thành `vexim-trade` |

---

## 11. Đọc nhanh: ai làm gì, ở đâu, mỗi ngày

| Vai trò | Màn hình chính | Chu kỳ | Hành động |
|---|---|---|---|
| **Lead Researcher** | `/admin/leads/new`, `/admin/buyers`, `/admin/buyers/import-importyeti` | Hằng ngày | Kéo buyer từ ImportYeti, enrich, làm sạch dữ liệu. KPI: **40 buyer/tháng** (`LR_MONTHLY_BUYER_TARGET`). PII bị mask. Không thấy client/pipeline. |
| **Account Executive** | `/admin/ae-inbox` → `/admin/engagements` → `/admin/pipeline` | Hằng ngày | Nhận buyer từ inbox AI → hỏi nhu cầu → gửi shortlist → theo dõi dwell/interest → gán client → đẩy stage trên Kanban → upload chứng từ → chốt deal. KPI: win rate vs team avg, revenue, commission, rank. **Không sửa được cost price.** |
| **Admin / Super Admin** | `/admin`, `/admin/users`, `/admin/country-risk`, `/admin/unmatched-emails`, `/admin/clients/intake` | Hằng ngày | Duyệt hồ sơ intake, triage email không match, quản trị user & role, giữ sổ rủi ro quốc gia nhất quán, giám sát toàn pipeline. |
| **Finance** | `/admin/finance/*` | Hằng ngày + đầu tháng | Review & gửi các invoice **draft** do cron tạo, đối chiếu retainer credit, ghi nhận chi phí, theo dõi overdue, xem revenue theo từng AE (`/admin/finance/by-ae`). |
| **Client** | `/client`, `/client/sla` | Khi được notify | Xem 5-phase progress, xem FDA của mình còn hạn không, xem SLA VXB đang cam kết, gửi yêu cầu (`client_requests`), nhận digest tháng, xem hoá đơn + quét VietQR, điền form intake lúc đầu. |
| **Buyer Mỹ** | `/shortlist/[token]` (không login) | Khi nhận email | Xem 2–5 option supplier, đọc, bấm "quan tâm"/"xin mẫu"/"muốn họp"/"muốn bàn đơn hàng". Hệ thống đo cả thời gian họ đọc từng card. |
| **Hệ thống (tự động)** | 14 cron | 01:00–09:00 UTC | Retainer → FDA → SLA → success fee → embeddings → re-engage → overdue → doc expiry → rematch → intake expiry → archive lost → stale engagement → digest → weekly report. |

---

## 12. Kết luận một câu

Đây là một hệ thống **CRM hai phía trưởng thành hơn nhiều so với tài liệu của chính nó**: luồng vận hành thực tế hiện nay chạy qua *ImportYeti → AI matching → AE Inbox → Engagement pipeline → Shortlist công khai có đo hành vi → Opportunity 10 stage → Deal có 4 lớp gate → Invoice draft do cron sinh → SLA tự chấm hằng tháng*, với các bất biến quan trọng nhất được cưỡng chế ở tầng Postgres chứ không phải ở tầng UI. Rủi ro lớn nhất **không nằm ở logic nghiệp vụ** mà nằm ở **chất lượng tài liệu, type-safety của các module mới, và việc hoàn toàn không có test**.
