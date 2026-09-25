# VEXIM AI SALES CAMPAIGN ENGINE — Phân tích hệ thống & đặc tả v1.0

> **Ngày phân tích:** 25/09/2026
> **Phạm vi:** Toàn bộ codebase `vexim-bridge` (Next.js 16 + Supabase) đối chiếu với Đặc tả kỹ thuật "AI Sales Campaign Engine" v1.0
> **Trạng thái:** PHÂN TÍCH — chưa viết code. Chờ chốt 3 quyết định kiến trúc ở mục G.

---

## A. Tóm tắt điều hành

Spec này **không phải xây từ đầu** — khoảng **55–60% năng lực đã có sẵn** trong `vexim-bridge` dưới các tên gọi khác. Phần còn thiếu tập trung vào đúng một lõi: **Campaign Engine (WHEN)** — tức state machine + scheduler tự chạy follow-up, thứ mà hệ thống hiện tại cố ý **không có** (mọi email đều do AE bấm duyệt).

| Nhóm năng lực theo spec | Hiện trạng |
|---|---|
| Buyer record, import data, PII, suppressions | ✅ ~85% đã có (`leads` + 7 migration mở rộng) |
| AI email generator, human approval, email sending, tracking bounce/open | ✅ ~80% đã có (`lib/ai/email-generator`, `email-sender`, migration 077) |
| Inbound reply + AI classify + tự chuyển stage | ✅ ~70% đã có (Resend webhook + `reply-classifier`, 5 intents — spec cần 12) |
| Supplier matching + shortlist + human approve | ✅ ~75% đã có (`lib/matching`, shortlist v2) |
| Cron/scheduler infrastructure | ✅ 14 cron jobs sẵn sàng (`vercel.json`) |
| **Campaign + sequence + state machine + auto follow-up** | ❌ **Chưa có gì** — đây là phần phải xây mới |
| BuyerContext builder chuẩn hoá, Email QA checker, guardrail FACT/UNKNOWN | ⚠️ ~30% (n principles nằm trong prompt, chưa có lớp kiểm tra độc lập) |
| `buyer_interactions` append-only, learning loop, campaign dashboard | ❌ Chưa có |

**Kết luận khả thi:** Làm được, additive hoàn toàn, không phải rewrite CRM, không đụng FDA/finance dashboard. Rủi ro lớn nhất không nằm ở AI mà ở **(1) xung đột giữa pipeline 15 stage của spec với 2 pipeline đã tồn tại**, và **(2) chính sách auto-send** — hệ thống hiện nay 100% human-in-the-loop.

---

## B. Hiện trạng hệ thống (kết quả audit code)

### B.1 Stack

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, Server Actions | |
| DB | Supabase PostgreSQL + RLS | **89 migration** trong `scripts/` (001→088 + fix) |
| Auth/RBAC | Supabase Auth + 6 roles (`super_admin`, `admin`, `account_executive`, `lead_researcher`, `supplier_researcher`, `finance`, + `client`) | Capability map: `lib/auth/permissions.ts` |
| AI | Vercel AI SDK 6 qua AI Gateway (`openai/gpt-4o-mini`), zod structured output | |
| Email | Resend (out + in) + nodemailer fallback; mỗi AE có `work_email` riêng | Webhook `email.received` đã hoạt động |
| Cron | Vercel Cron — **14 jobs** | `vercel.json` |
| Storage | Vercel Blob | |

### B.2 Những "tài sản" liên quan trực tiếp đến spec

**1. Buyer record = bảng `leads`** (đáp ứng ~85% spec §4):
- Căn bản (001): `company_name, contact_person, contact_email, contact_phone, website, industry, country`
- Extended (036): `contact_title, hs_code, purchase_history, competitors, peak_months`
- ImportYeti (032/045): `hs_codes TEXT[], import_ports TEXT[], product_keywords TEXT[], customs_shipment_count, top_suppliers JSONB, customs_data_updated_at, import_trend, peak_months_data_year`
- AI research persistence (079): `buyer_analysis JSONB, buyer_strategy JSONB` (health score, supplier loyalty, Vietnam readiness — `lib/ai/buyer-analyzer.ts`)
- Inquiry (068): `has_active_inquiry, inquiry_products, inquiry_quantity, inquiry_target_price…`
- Liên hệ (047): `buyer_contacts` — nhiều contact/lead
- **Chưa có:** `buyer_priority`, `buyer_score` (cột riêng), `crm_stage`, `campaign_id`, `current_sequence_step`, `last_contact_at`, `last_reply_at`, `next_action_at`, `followup_count`

**2. Pre-opportunity engagement pipeline — `buyer_engagements`** (051 + 055 + 061 + 079):
- 9 stages: `claimed → requirement_email_sent → requirements_received → shortlist_ready → shortlist_sent → buyer_viewed → buyer_responded → converted / dropped`
- Requirement dạng text tự do: `requested_products, target_price_range, moq, payment_terms, packaging_requirements, other_requirements`
- Stage→Action map dùng chung: `lib/buyers/engagement-stages.ts` (đã là "single source of truth" cho cả inbox và buyer profile — đúng tinh thần §25 của spec nhưng **chưa có `next_action_at`/owner bắt buộc**)
- Stage transition tự động khi buyer reply: `lib/buyers/engagement-stage-transitions.ts` (gọi từ webhook)
- Stale reminder 14 ngày: cron `engagement-stale-check` — **chỉ WARN AE, không tự gửi follow-up** (quyết định business đã confirm từ trước)

**3. AI email + gửi + duyệt:**
- `lib/ai/email-generator.ts` — prompt V4 "60/40 compliance + product/seasonality", đã có nguyên tắc anti-fabrication, anti-surveillance; email type: `introduction, follow_up, quotation, sample_offer, negotiation, custom`
- `email_drafts` (002): status `draft → pending_approval → approved → sent / rejected` — **mọi email phải qua người duyệt**, lưu `approved_by/approved_at`, `resend_message_id`
- `lib/ai/email-sender.ts` — approve & send, thread In-Reply-To, **tự chặn khi lead bị suppress**
- Delivery tracking (077): `delivery_status, delivered_at, opened_count, clicked_count, bounced_at, complained_at…`
- Suppression: `email_hard_bounced_at, email_complained_at, email_unsubscribed, unsubscribe_token` + trang `/unsubscribe/[token]` + admin lift suppression (chỉ admin)
- `lib/email/work-email.ts` — mỗi AE một địa chỉ `tên@veximtrade.com` (deliverability)

**4. Inbound reply pipeline:**
- Webhook Resend (`app/api/webhooks/resend`): `email.received` → fetch body → match qua In-Reply-To hoặc sender email → tạo `buyer_replies` + gọi `classifyBuyerReply` + notification + **tự chuyển stage engagement**
- `buyer_replies` (010 + 052): `ai_intent` hiện **5 giá trị** (`price_request, sample_request, objection, closing_signal, general`), `ai_confidence, ai_summary, ai_suggested_next_step, translated_vi`, ambiguous-match confirmation (`needs_ae_confirmation`)
- ⚠️ `buyer_replies.opportunity_id` hiện **NOT NULL** — reply lúc chưa có opportunity được xử lý qua engagement tracking (052) nhưng cần soát kỹ khi campaign chạy ở giai đoạn pre-opportunity

**5. Supplier matching:** `lib/matching` (orchestrator, scorer, semantic-scorer, client-scorer), `ae_match_inbox`, shortlist versions/items + tokenized share link + dwell tracking. Buyer không thấy score — khớp spec §17/§18.

**6. Audit & analytics:** `activities` (append log, có trigger audit cả việc đổi role), BI dashboard 4 tab, FDA expiry dashboard, finance/revenue (setup fee + retainer + success fee) — **vùng cấm xâm phạm theo §28**.

**7. Docs nội bộ liên quan:** `SYSTEM_AUDIT.md` (audit 04/2026), `EXACT_WORKFLOW.md`, bộ `PRODUCT_DISCOVERY_*`, `docs/email-quality-v2/v3/v4` (lịch sử tiến hoá prompt — chính là "learning loop" thủ công mà §24 muốn tự động hoá).

---

## C. Đối chiếu 30 mục của spec với hệ thống

| § Spec | Yêu cầu | Hiện trạng | Khoảng trống |
|---|---|---|---|
| 1 | Mục tiêu tổng | — | — |
| 2 | Workflow=WHEN, AI=HOW, CRM=SSoT | ✅ Nguyên tắc đã đúng sẵn (email_drafts phải duyệt; classifier không bịa số) | Thiếu lớp **thực thi** nguyên tắc FACT/OBSERVATION/INFERENCE/UNKNOWN trong context |
| 3 | Pipeline 15 stage + 6 terminal | ⚠️ Có 2 pipeline thật: engagement 9 stage + opportunity kanban | **Xung đột đặt tên — cần mapping**, xem D.1 |
| 4 | Buyer record 24 trường | ✅ ~85% | ADD COLUMN: priority, score, crm_stage, campaign linkage, timestamps follow-up |
| 5 | `buyer_interactions` append-only | ⚠️ Dữ liệu nằm rải: `email_drafts` (out), `buyer_replies` (in), `activities` (audit) | Bảng mới + backfill; RLS **không có policy UPDATE/DELETE** |
| 6 | `campaigns` | ❌ | Bảng mới |
| 7 | `campaign_steps` | ❌ | Bảng mới (sequence template) |
| 8 | Campaign state machine (không dùng AI) | ⚠️ engagement-stage-transitions là state machine đơn giản; stale-check warn-only | **Xây mới `lib/campaign/`** — state machine thuần code, có test |
| 9 | Trigger engine (5 triggers) | ⚠️ 14 cron có sẵn làm mẫu | Cron mới `campaign-scheduler` + các trigger event-driven |
| 10 | BuyerContext builder | ⚠️ email-generator tự build context rải rác | Module `buildBuyerContext()` chuẩn, gắn nhãn FACT/INFERENCE/UNKNOWN |
| 11 | Follow-up generator | ⚠️ `follow_up` type có sẵn nhưng cho pipeline opportunity | Thêm prompt cho cold follow-up theo §12 + anti-repeat email trước |
| 12 | Chiến lược 4 email | ❌ | Templateobjective per step trong `campaign_steps` |
| 13 | Điều kiện STOP follow-up | ✅ Vật liệu đủ: suppression, unsub, bounce, reply-detection | Ràng buộc vào state machine + scheduler query |
| 14 | Reply classifier 12 intents | ⚠️ Có 5 intents + confidence + next step | Mở rộng CHECK constraint + output `requires_human, stage, suggested_next_action` enum hoá |
| 15 | Discovery agent hỏi progressive | ⚠️ requirement-email có sẵn; chưa có logic "thiếu gì hỏi nấy" | Module detect missing fields + question selection |
| 16 | `buyer_requirements` có cấu trúc | ⚠️ Flat text trên engagement | Bảng mới + `status: PARTIAL/SUFFICIENT/CONFIRMED` + `unknown_fields` |
| 17 | Supplier matching (gate SUFFICIENT) | ✅ Orchestrator + scorer có sẵn | Thêm gate + log rationale + fit score internal |
| 18 | Presentation 1 supplier mặc định | ⚠️ Shortlist hiện 3–5 supplier | Cấu hình số lượng + điều kiện mở alternatives |
| 19 | Approval matrix (auto-send follow-up 1,2 + close-loop) | ❌ Hiện **100% phải duyệt** | Policy engine + **quyết định business**, xem D.3 |
| 20 | Guardrails không bịa data | ⚠️ Có trong prompt (chưa phải cơ chế) | Context labeling + QA check + cấm trường UNKNOWN |
| 21 | Email QA checker 12 điểm | ⚠️ doc email-quality v2–v4 là kinh nghiệm prompt | Module `email-qa.ts` (rule-based + AI) output `{passed, risk_level, issues}` |
| 22 | Sending limits (daily/domain/campaign/buyer) | ❌ | Config + check trước send trong scheduler |
| 23 | Campaign dashboard + funnel + AI metrics | ⚠️ Analytics có sẵn; chưa có metrics AI | Dashboard mới `/admin/campaigns` |
| 24 | Learning loop (AI draft vs final) | ⚠️ override lúc send hiện **không lưu diff** | Lưu draft/edit/final + reply + outcome vào 1 chỗ |
| 25 | Next Action Engine (bắt buộc non-null) | ⚠️ Có stage→actions, thiếu next_action_at + ràng buộc NOT NULL về logic | Cột + cron kiểm tra "orphan buyer" |
| 26 | 4 AI Agents | ⚠️ Từng mảnh đã có dưới module riêng | Refactor thành 4 agent có interface thống nhất + orchestrator |
| 27 | Ví dụ end-to-end (Jayone Foods) | — | Sẽ là **kịch bản test E2E** cho Phase 1–5 |
| 28 | Không rewrite CRM, migration, audit log | ✅ Đúng điều kiện: mọi thay đổi additive | Tuân thủ: chỉ ADD COLUMN/bảng mới |
| 29 | 6 phase triển khai | — | Map ở mục F |
| 30 | Definition of Done 14 điểm | — | Checklist ở mục F.7 |

---

## D. Xung đột & rủi ro chính (cần chốt trước khi code)

### D.1. Pipeline 15 stage của spec vs 2 pipeline đã tồn tại — QUYẾT ĐỊNH LỚN NHẤT

Spec §3 đưa ra 15 stage tuyến tính. Thực tế hệ thống đang có **2 pipeline song song đã vận hành**:

```
leads (pool/matching inbox)
   └─ buyer_engagements: claimed → requirement_email_sent → requirements_received
        → shortlist_ready → shortlist_sent → buyer_viewed → buyer_responded
        → converted ──────────────┐
                                  ▼
        opportunities (kanban deal: quoting → sampling → negotiation → won/lost…)
```

Mapping tự nhiên gần như 1-1:

| Spec | Hệ hiện tại |
|---|---|
| RESEARCH / READY_TO_CONTACT | lead trong pool, chưa ai claim |
| CONTACTED | `requirement_email_sent` |
| WAITING_REPLY | sau khi gửi, chưa có reply |
| CONVERSATION | `buyer_responded` |
| DISCOVERY | đang ghi requirement |
| QUALIFIED_REQUIREMENT | `requirements_received` |
| SUPPLIER_MATCHING | `shortlist_ready` |
| SUPPLIER_SELECTED / PRESENTED | `shortlist_sent` / `buyer_viewed` |
| RFQ → SAMPLE → NEGOTIATION → TRIAL_ORDER → ACTIVE_BUYER | các stage deal trên `opportunities` |

**3 phương án:**
- **(A) — KHUYẾN NGHỊ — Thêm lớp `crm_stage` chuẩn hoá**: một cột/bảng state riêng trên buyer, được **ghi từ cùng các code path hiện tại** (write-through: webhook, engagement actions, opportunity transitions). Inbox, kanban, mọi UI cũ **không đổi**. Campaign state machine chỉ đọc `crm_stage`. Ưu: không đụng code đang chạy, spec đạt 100%, có thể backfill. Nhược: 2 nơi lưu stage → cần trigger/ disciplined write-through để không lệch.
- **(B) Mở rộng CHECK constraint `buyer_engagements.stage`** thêm các stage trung gian (`waiting_reply`, `discovery`, `rfq`…). Nhược: phải sửa `engagement-stages.ts`, inbox card, transitions, các index partial — rủi ro hồi quy cao hơn cho đúng spec, vi phạm tinh thần "không đụng phần đang chạy".
- **(C) Campaign chỉ phủ pre-opportunity** (RESEARCH→SUPPLIER_PRESENTED), từ RFQ để nguyên kanban cũ. Nhược: funnel dashboard §23 bị đứt gãy giữa dòng.

### D.2. `buyer_replies` gắn `opportunity_id NOT NULL`

Campaign chạy từ giai đoạn **chưa có opportunity**. Webhook hiện match reply → opportunity; với campaign cần match → **lead/engagement** trước. Cần: cho phép nullable + thêm `lead_id`/`campaign_enrollment_id`, hoặc route qua engagement path đã có (052). Phải soát kỹ `engagement-stage-transitions` để reply campaign không nhảy nhót stage cũ ngoài ý muốn.

### D.3. Auto-send là thay đổi chính sách, không chỉ kỹ thuật

Hiện tại: **100% email cần người duyệt** (có lý do deliverability + pháp lý đã khắc KSA trong code). Spec cho phép auto-send follow-up #1/#2 + close-loop khi buyer chưa từng reply và QA pass. Rủi ro: 1 prompt lỗi = hàng trăm email xấu đi ra thị trường trong 1 đêm.
- Đề xuất: **Shadow mode 2–4 tuần** (AI sinh + QA + ghi interaction `SYSTEM_EVENT` nhưng KHÔNG gửi, AE duyệt như cũ, đo AI rejection rate) → rồi mới bật auto-send thật với **daily cap thấp** (VD 20 email/ngày/campaign).

### D.4. Mở rộng intent enum — phải backward-compatible

`ai_intent` có CHECK constraint + UI render + logic `objection → buyerDeclined` ở stage-action map. Thêm 7 intent mới (INTERESTED, NOT_NOW, OPT_OUT, OUT_OF_OFFICE, WRONG_CONTACT, REFER_TO_OTHER_PERSON, NEEDS_MORE_INFO/ASK_SUPPLIER_INFO/REQUEST_QUOTE/REQUEST_SAMPLE mapping từ 3 intent cũ) phải: migrate constraint (ADD value, không DROP cũ), map intent mới → hành vi stop/continue, và thêm `requires_human` + ngưỡng confidence → human review (hiện chưa có nhánh này).

### D.5. Volume & deliverability

Domain `veximtrade.com` đang gửi quy mô nhỏ, uy tín cao (mỗi AE 1 địa chỉ, không attachment, không link rác). Campaign tự động làm tăng volume đột biến → cần `daily_limit/domain_limit/per_campaign_limit/per_buyer_limit` **ngay từ ngày đầu**, không phải phase sau. Warm-up chưa được cấu hình ở đâu.

### D.6. Vùng cấm §28

FDA expiry dashboard, finance/revenue dashboard, client portal, SLA, matching inbox — **không sửa schema cũ** ngoài ADD COLUMN; không thay đổi semantic dữ liệu `leads` hiện có; mọi bảng mới có RLS + audit.

---

## E. Kiến trúc đề xuất

```
┌────────────────────────────────────────────────────────────────────┐
│                     WORKFLOW ENGINE (WHEN — code thuần)             │
│  lib/campaign/state-machine.ts   — chuyển stage, STOP conditions   │
│  lib/campaign/scheduler.ts       — query buyer đến hạn, limits     │
│  /api/cron/campaign-scheduler    — Vercel Cron 15 phút             │
│  Triggers: cron | reply-webhook | delivery-event | manual          │
└──────────────┬─────────────────────────────────────────────────────┘
               │ điều phối
┌──────────────▼─────────────────────────────────────────────────────┐
│                       4 AI AGENTS (HOW)                             │
│  BuyerResearchAgent   ← buyer-analyzer + importyeti-parser         │
│  SalesConversationAgent ← reply-classifier (mở rộng 12 intent)     │
│  EmailAgent           ← email-generator + email-qa (MỚI)           │
│  SupplierMatchingAgent ← lib/matching orchestrator                 │
├────────────────────────────────────────────────────────────────────┤
│  lib/ai/context-builder.ts — BuyerContext chuẩn, nhãn              │
│  FACT / OBSERVATION / INFERENCE / UNKNOWN (§2.3, §10, §20)         │
└──────────────┬─────────────────────────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────────────────────────┐
│  DATA (mới — additive, không sửa bảng cũ)                           │
│  campaigns, campaign_steps                                          │
│  campaign_enrollments  (buyer × campaign: step, stage, timestamps)  │
│  buyer_interactions    (append-only, RLS không có UPDATE/DELETE)    │
│  buyer_requirements    (structured + PARTIAL/SUFFICIENT/CONFIRMED)  │
│  email_qa_results, ai_draft_versions (learning loop §24)            │
│  + ADD COLUMN trên leads: crm_stage, buyer_priority/score,          │
│    last_contact_at, last_reply_at, next_action_at, followup_count   │
├─────────────────────────────────────────────────────────────────────┤
│  UI: /admin/campaigns (list, sequence, approval queue, dashboard)   │
│  RBAC: AE thấy campaign của mình; admin/super_admin full            │
└─────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc bất di bất dịch khi code:**
1. State machine là **hàm thuần** (`transition(state, event) → state`), viết test trước — AI không bao giờ được gọi trong file này.
2. Mọi email đi qua **cổng duy nhất** `lib/ai/email-sender.ts` (đã có sẵn chặn suppression) — scheduler không tự gửi bằng đường tắt.
3. Mỗi action của AI ghi `buyer_interactions` + `activities` (audit) — append-only, không overwrite.
4. AI chỉ nhận context từ `buildBuyerContext()` — không query DB trong agent.
5. Bất kỳ trường nào không có dữ liệu → `UNKNOWN`, prompt cấm điền.

---

## F. Lộ trình triển khai (map §29 → repo này)

| Phase | Nội dung | Deliverable cụ thể | Migration |
|---|---|---|---|
| **1 — Foundation** | campaigns, campaign_steps, enrollments, crm_stage + mapping (D.1), buyer_interactions, next-action engine, cron scheduler (chế độ **chỉ ghi kế hoạch, chưa gửi**) | `lib/campaign/*`, `/admin/campaigns` (list + detail), `/api/cron/campaign-scheduler` | 089–092 |
| **2 — AI Email** | BuyerContext builder, EmailAgent cold follow-up theo §12, email-qa, approval queue, shadow-mode auto-send (D.3), sending limits | `lib/ai/context-builder.ts`, `lib/ai/email-qa.ts`, queue UI, config limits | 093 |
| **3 — Reply Intelligence** | Mở rộng 12 intents + requires_human, ingest reply cho pre-opportunity (D.2), stage transition qua crm_stage, stop-sequence | sửa webhook + classifier + constraint | 094 |
| **4 — Discovery** | buyer_requirements + missing-field detection + progressive questions | `lib/ai/discovery.ts` + UI requirement | 095 |
| **5 — Supplier Matching** | Gate SUFFICIENT, match log + rationale, presentation 1 supplier mặc định | SupplierMatchingAgent wrapper + UI | 096 |
| **6 — Intelligence** | Funnel dashboard, AI metrics, learning loop report (draft vs final) | `/admin/campaigns/analytics` | 097 |

Mỗi phase có Definition of Done riêng, chốt bằng đúng 14 điểm §30 (đã đối chiếu khả thi 100% — không điểm nào mâu thuẫn hệ hiện tại).

---

## G. Câu hỏi cần chốt trước khi bắt tay code

1. **Kiến trúc stage (D.1):** chọn A (crm_stage song song + mapping — khuyến nghị), B (mở rộng engagement stage), hay C (campaign chỉ phủ pre-opportunity)?
2. **Auto-send (D.3):** bật ngay theo spec hay chạy shadow mode 2–4 tuần trước (khuyến nghị)?
3. **Phạm vi lần này:** code hết Phase 1–6 hay dừng ở Phase 1–2 (Foundation + AI Email) để chạy thử với 1 campaign thật?

---

## H. CẬP NHẬT PHẠM VI (chốt ngày 25/09/2026): "Cold Outreach Engine" — dừng ở buyer phản hồi

### H.1. Quyết định

Campaign engine chỉ chạy từ **RESEARCH → CONTACTED → WAITING_REPLY → (buyer reply)**. Ngay khi buyer phản hồi, sequence dừng, AI phân loại reply, và **bàn giao cho pipeline engagement hiện có** (`buyer_engagements`) — mọi thứ sau phản hồi (discovery, requirement, shortlist, matching, RFQ…) vẫn là quy trình AE-in-the-loop đang chạy tốt hôm nay.

### H.2. Vì sao đây là lựa chọn đúng

1. **Giải quyết tận gốc xung đột D.1.** Vòng đời outreach sống trên `campaign_enrollments` (bảng mới), không đụng `buyer_engagements.stage` hay kanban. Pipeline 15 stage của spec trở thành **mapping tài liệu**, không phải cột mới: RESEARCH/READY = lead trong pool · CONTACTED/WAITING_REPLY = state của enrollment · CONVERSATION trở đi = pipeline engagement/opportunity đã có. Không cần `crm_stage` trên `leads` nữa (hoặc chỉ là cột derived để hiển thị).
2. **Trúng đúng chỗ đau nhất.** Việc tốn công nhất của AE hiện nay là đoán *khi nào* gửi, *theo dõi* ai chưa trả lời, *tự nhớ* follow-up lần 2/3 — đúng phần hệ thống hiện tại chỉ biết WARN (cron stale-check). Sau khi buyer trả lời, công việc vốn dĩ đã bắt buộc có con người (ghi requirement, chọn supplier, duyệt shortlist) — tự động hoá thêm ở đó là trùng lặp với `buyer_engagements`.
3. **Công sức ≈ 45–50% của full spec nhưng giữ ~80% giá trị vận hành** (tính trên khối lượng xây mới, vì Phase 4–5 vốn tận dụng hệ thống sẵn có nhiều hơn).
4. **Rủi ro suy giảm thấp nhất cho vùng cấm §28:** không sửa CHECK constraint cũ, không đụng webhook match-reply→opportunity (D.2 chỉ áp dụng cho enrollment của campaign), không đụng matching orchestrator.

### H.3. Phạm vi IN (phải có — không được cắt)

| Thành phần | Ghi chú |
|---|---|
| `campaigns`, `campaign_steps`, `campaign_enrollments` + **state machine thuần** + cron scheduler | Lõi WHEN. States: `ENROLLED → READY_TO_CONTACT → CONTACTED → WAITING_REPLY → REPLIED_HANDOFF` + terminal: `STOPPED_NOT_INTERESTED / STOPPED_OPTED_OUT / STOPPED_BOUNCED / STOPPED_INVALID_CONTACT / NURTURE / MAX_ATTEMPTS_REACHED` |
| `buyer_interactions` append-only + audit | Definition of Done §30 bắt buộc, độc lập với phạm vi |
| BuyerContext builder + EmailAgent cold (4 email theo §12) + **Email QA** + approval matrix | Shadow mode trước khi auto-send (D.3) — vẫn giữ nguyên |
| Sending limits (daily/domain/campaign/buyer) | Deliverability — phải có ngay từ ngày đầu |
| Mở rộng reply classifier — **bộ tối thiểu mở rộng** | Thêm: `INTERESTED, NOT_INTERESTED, NOT_NOW, OPT_OUT, OUT_OF_OFFICE, WRONG_CONTACT, UNKNOWN` (map từ 5 intent cũ, backward-compat). Đây là **ranh giới an toàn**, không phải tính năng |
| Điều kiện STOP §13 đầy đủ | Reply / no / not-interested / opt-out / bounced / invalid → stop hoặc pause (OUT_OF_OFFICE = pause + reschedule `next_action_at`) |
| Next Action Engine (`next_action_at`, `followup_count` trên lead/enrollment) | §25 — cron kiểm tra enrollment nào không có next action |
| Campaign dashboard **lite**: contact→reply funnel + AI generated/sent/approval/rejection | Phần §23 phục vụ đúng phạm vi này |

### H.4. Phạm vi DEFER (làm sau, không làm lần này)

- DISCOVERY progressive questioning + `buyer_requirements` có cấu trúc (Phase 4) — AE vẫn ghi requirement thủ công như hiện tại, không tệ hơn status quo.
- Gate SUFFICIENT + SupplierMatchingAgent + presentation 1-supplier (Phase 5) — shortlist 3–5 hiện có vẫn chạy.
- Full funnel analytics §23 (Discovery→Qualified→…→Active) + learning loop phân tích (Phase 6) — nhưng **vẫn lưu** AI draft vs final-sent từ ngay bây giờ vì `email_drafts` đã lưu sẵn, chỉ cần ghi chú linking, để sau này phân tích được.

### H.5. Thiết kế bàn giao (handoff) — điểm nối duy nhất cần chuẩn

```
Webhook nhận reply (đã có) → match enrollment theo email/lead → AI classify
  ├─ INTERESTED (confidence ≥ ngưỡng)
  │     → enrollment = REPLIED_HANDOFF, STOP sequence
  │     → tạo buyer_engagement (stage 'claimed') nếu chưa có + notify AE
  │     → AE xử lý như flow hiện tại (record requirements → shortlist…)
  ├─ NOT_INTERESTED / NOT_NOW → terminal STOPPED_* hoặc NURTURE theo nội dung
  ├─ OPT_OUT → STOP PERMANENT + stamp suppression (mãi mãi, chỉ admin gỡ)
  ├─ OUT_OF_OFFICE → PAUSE + next_action_at = +7 ngày, KHÔNG tính là reply
  ├─ WRONG_CONTACT → STOPPED_INVALID_CONTACT + suggest đúng người (nếu reply chỉ rõ)
  └─ UNKNOWN / confidence < ngưỡng → hàng đợi human review, sequence giữ nguyên
        (không tự hành động — đúng §14)
```

Reply của campaignbuyer khi **đã có** `buyer_engagements` mở (hiếm, nhưng có thể) → ưu tiên route vào engagement path cũ, campaign chỉ dừng sequence, không tạo trùng.

### H.6. Lộ trình theo phạm vi mới

| Giai đoạn | Nội dung | Migration |
|---|---|---|
| **B1 — Foundation** | campaigns/steps/enrollments, state machine + test, scheduler cron (plan-only), buyer_interactions, next-action engine | 089–091 |
| **B2 — AI Email** | BuyerContext, EmailAgent cold + QA, approval queue + shadow mode, sending limits | 092 |
| **B3 — Reply → Handoff** | Classifier mở rộng (bộ tối thiểu), webhook route enrollment, handoff tạo engagement + notify, stop/pause conditions | 093 |
| **B4 — Kính đo** | Dashboard lite + shadow-mode report (AI rejection rate) → quyết định bật auto-send | 094 |

Mỗi giai đoạn đều có thể dừng mà không phá vỡ gì: B1 tự hữu ích (không AI, chỉ đúng thời điểm + nhắc việc), B2 thêm draft quality, B3 đóng vòng tự động, B4 mở khoá auto-send.

### H.7. Câu hỏi còn lại cần chốt (thu gọn từ G)

1. ~~Kiến trúc stage~~ → **tự giải quyết** theo H.2 (enrollment-level states).
2. **Auto-send:** shadow mode 2–4 tuần trước khi bật (khuyến nghị) hay không bao giờ auto-send?
3. **Ngưỡng handoff:** confidence tối thiểu để tự coi là INTERESTED (đề xuất 0.85; dưới ngưỡng → human review)?
4. **Buyer nguồn vào campaign đầu tiên:** toàn bộ lead `has_active_inquiry = false` chưa được claim, hay chủ tay một segment nhỏ (VD: food importers có `customs_shipment_count ≥ N` và `vietnam_supplier_exists`)?

