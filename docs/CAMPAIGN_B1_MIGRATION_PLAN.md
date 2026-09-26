# B1 MIGRATION PLAN — Vexim AI Outreach Engine (Campaign B1)

> **Ngày:** 25/09/2026 · **Trạng thái:** ĐÃ DUYỆT (theo quyết định của chủ hệ thống cùng ngày)
> **Nguyên tắc:** chỉ ADD — không sửa/KHÔNG xoá bất kỳ bảng/cột/ràng buộc hiện có nào; không đụng FDA/finance dashboard, client portal, matching inbox.

---

## 0. Các quyết định đã chốt (đầu vào của plan)

1. **Shadow Mode**: AI generate + QA → approval queue. AE review/edit/approve. Lưu AI draft + bản AE sửa + bản gửi thật. Auto-send đánh giá sau 2–4 tuần.
2. **Classifier**: 7 intent (INTERESTED, NOT_INTERESTED, NOT_NOW, OPT_OUT, OUT_OF_OFFICE, WRONG_CONTACT, UNKNOWN). Threshold 0.85 **+ rule/guardrail** (rule thắng AI khi xung đột với intent dừng). OUT_OF_OFFICE = PAUSE (không phải reply). `<0.85`/ambiguous → HUMAN_REVIEW.
3. **Pilot**: 50–100 buyer: food importer + đã sourcing từ VN + category khớp supplier coverage + contact hợp lệ. Shipment count = biến ưu tiên, không bắt buộc.
4. **Kiến trúc**: `campaign_enrollments` là lớp orchestration riêng. Giữ nguyên `buyer_engagements` + pipeline. KHÔNG có `crm_stage`. INTERESTED → `REPLIED_HANDOFF` → tạo `buyer_engagements` (stage `claimed`) + notify AE → campaign dừng.
5. **Idempotency**: bắt buộc — retry/restart không được gửi trùng.

## 1. State machine B1 (theo đề xuất đã duyệt)

```
ENROLLED ──(scheduler tạo email 1, vào approval queue)──▶ CONTACT_PENDING
CONTACT_PENDING ──(AE approve & send)──▶ CONTACTED
CONTACTED ──(qua grace 24h không thêm gì)──▶ WAITING_REPLY

WAITING_REPLY / FOLLOWUP_* ── nhận reply (webhook + classifier v2):
  INTERESTED        → REPLIED_HANDOFF   [TERMINAL] → tạo engagement + notify AE
  NOT_NOW           → PAUSED  (next_action_at = +30 ngày → NURTURE)
  OUT_OF_OFFICE     → PAUSED  (next_action_at = +7 ngày, KHÔNG tính là reply)
  NOT_INTERESTED    → STOPPED           [TERMINAL]
  OPT_OUT           → SUPPRESSED        [TERMINAL] + stamp leads.email_unsubscribed
  WRONG_CONTACT     → INVALID_CONTACT   [TERMINAL]
  UNKNOWN / conf<0.85 → giữ state + needs_human_review=true (follow-up bị HOLD đến khi AE xử lý)

WAITING_REPLY ──(đến hạn, không reply)──▶ FOLLOWUP_1 ──▶ FOLLOWUP_2 ──▶ NURTURE [TERMINAL]
(bước followup nào được sinh ra đều qua approval queue — shadow mode)

STOP checks chạy TRƯỚC mọi hành động của scheduler:
bounce cứng / complained / unsubscribed / mất contact_email → SUPPRESSED hoặc INVALID_CONTACT
```

Loại state: `ACTIVE = {ENROLLED, CONTACT_PENDING, CONTACTED, WAITING_REPLY, FOLLOWUP_1, FOLLOWUP_2, PAUSED}` · `TERMINAL = {REPLIED_HANDOFF, STOPPED, SUPPRESSED, INVALID_CONTACT, NURTURE}`.

## 2. Bảng mới (migration 089)

### `campaigns`
| cột | kiểu | ghi chú |
|---|---|---|
| id, created_at, updated_at | uuid/timestamptz | |
| name, description | text | NOT NULL name |
| target_segment | text | VD `us_food_importer_vietnam_sourced` |
| product_category | text | |
| status | text CHECK | `draft/active/paused/completed/archived` |
| start_date, end_date | date | |
| daily_send_limit | int DEFAULT 20 | cap §22 |
| created_by | uuid FK profiles | |

### `campaign_steps` (template sequence)
`id, campaign_id FK, step_number int, step_type CHECK('initial_outreach','follow_up','close_loop','nurture'), delay_days int (offset từ bước trước), objective text, ai_prompt_guidance text, max_attempts int DEFAULT 1, stop_conditions jsonb, created_at`. UNIQUE(campaign_id, step_number).

### `campaign_enrollments` (lớp orchestration — 1 dòng/buyer/campaign)
- `id, campaign_id FK, lead_id FK leads` — **UNIQUE(campaign_id, lead_id)**; partial unique **1 enrollment ACTIVE/lead** (`WHERE state NOT IN terminal`) — chặn enrollment chéo campaign cùng lúc.
- `state` TEXT CHECK 11 giá trị (mục 1) — **không đổi state ngoài state-machine module**.
- `owner_id` FK profiles (AE sở hữu; handoff dùng làm account_manager).
- `current_step_number int`, `followup_count int DEFAULT 0`.
- `last_contact_at, last_reply_at, next_action_at, next_action_type` — next_action_at NOT NULL cho state active trừ PAUSED/HUMAN_REVIEW HOLD (cron integrity check).
- `needs_human_review boolean`, `human_review_reason text`, `paused_until timestamptz`, `handoff_engagement_id uuid` (FK buyer_engagements, SET NULL), `stopped_reason text`.
- `enrolled_by, created_at, updated_at`.

### `campaign_step_firings` — **idempotency lõi**
- `id, enrollment_id FK, step_number int, firing_key text` — **UNIQUE(firing_key)** với `firing_key = enrollment_id:step_number:attempt` (đơn giản: `enrollment_id:step_number`).
- `status CHECK('claimed','draft_created','sent','failed','skipped')`, `claimed_at, resolved_at, draft_id FK email_drafts, error text`.
- **Cơ chế exactly-once-claim:** scheduler INSERT ... ON CONFLICT (firing_key) DO NOTHING → lỗi 23505 = đã có người lấy (skip). Claim treo (`claimed` > 30′ mà không có draft) → cron dọn: đánh dấu `failed` + xoá lock bằng cách retry với key mới? KHÔNG — giữ 1 hàng: reclaim chỉ khi status='claimed' AND claimed_at < now()-30′ → cho phép chính hàng đó được xử lý lại (status vẫn claimed, claimed_at reset). Draft creation xong → `draft_created`. AE send xong → `sent`.

### `buyer_interactions` — **append-only** (spec §5)
`id, buyer_id FK leads, campaign_id, enrollment_id, interaction_type CHECK('EMAIL','REPLY','CALL','NOTE','MEETING','SYSTEM_EVENT'), direction CHECK('OUTBOUND','INBOUND','INTERNAL'), subject, content, sender, recipient, timestamp, sequence_step, ai_generated bool, human_approved bool, reply_classification jsonb (intent/confidence/requires_human/rules), sentiment text, intent text, metadata jsonb, draft_id, created_at`.
- RLS: chỉ SELECT + INSERT cho staff-side roles. **KHÔNG có policy UPDATE/DELETE** → append-only ở tầng DB.
- Không overwrite: mọi event mới = hàng mới (kể cả "AE sửa draft": lưu phiên bản cạnh nhau, không sửa hàng cũ).

### Cột ADD vào bảng có sẵn (additive, không đụng semantic cũ)
- `email_drafts`: `campaign_enrollment_id uuid FK SET NULL`, `campaign_step_number int` — tái dùng toàn bộ pipeline gửi/duyệt/tracking hiện có (opportunity_id đã nullable).
- `buyer_replies`: `campaign_intent text`, `campaign_confidence numeric(4,3)`, `campaign_intent_source text ('ai'|'rules'|'ai+rules')`, `campaign_needs_human boolean DEFAULT false`, `campaign_enrollment_id uuid FK SET NULL` — tách hẳn khỏi `ai_intent` (5 giá trị cũ, không migrate CHECK cũ).

## 3. Seed pilot (migration 090)

- Campaign: **"US Food Buyer – Vietnam Sourcing – Pilot"** (status `draft`, daily_send_limit 20).
- 4 bước: S1 `initial_outreach` +0d · S2 `follow_up` +4d · S3 `follow_up` +7d (2 followup = max §19) · S4 `close_loop` +30d (cho buyer quyền từ chối) → hết bảng → NURTURE. Mọi step `auto_send=0` (cột `max_attempts`, guidance theo §12).
- KHÔNG seed enrollment — việc chọn 50–100 buyer làm qua UI với bộ lọc pilot (industry food + `purchase_history`/`top_suppliers` có VN + contact hợp lệ), export-preview trước khi enroll.

## 4. Code mới (mỗi file một trách nhiệm)

```
lib/campaign/
  constants.ts        States, events, config (threshold 0.85, grace 24h, reclaim 30′)
  state-machine.ts    TRANSITIONS thuần + canTransition()/nextState() — KHÔNG import AI, KHÔNG import supabase
  types.ts            Row shapes (boundary `as any` cho bảng mới, giống buyer_engagements hiện nay)
  interactions.ts     appendInteraction() — ghi buyer_interactions + activities (audit kép)
  suppression.ts      getStopReason(lead) → null | {state: SUPPRESSED|INVALID_CONTACT, reason}
  enrollments.ts      enrollLeads (validate pilot filter + suppression), pause/resume/stop, advance()
  context-builder.ts  buildBuyerContext(enrollment) → BuyerContext JSON (FACT/UNKNOWN labels)
  email-generator.ts  Cold email per step objective (§12), anti-invention prompt, fallback template
  email-qa.ts         QA 12 điểm: deterministic rules (tên/công ty/độ dài/spam words/trùng email trước/opt-out line) → {passed, risk_level, issues[]}
  reply-intent.ts     classifyCampaignReply(): RULES trước (opt-out/OOO/not-interested/wrong-contact keywords) → AI (7-intent zod) → merge (rule thắng khi xung đột stop-intent) → {intent, confidence, requires_human, source}
  handoff.ts          handoffToEngagement(): tạo buyer_engagements('claimed') + dispatchNotification + interactions SYSTEM_EVENT
  scheduler.ts        runCampaignSchedulerTick(): reclaim → stop-check → resume PAUSED → due followups (claim → context → generate → QA → draft pending_approval → state FOLLOWUP_n) → daily limits → integrity check
  approve.ts          approveCampaignDraft() (gọi sendEmailDraft + bookkeeping: state CONTACTED/WAITING_REPLY, last_contact_at, next_action_at, firings.sent, interactions EMAIL approved) / rejectCampaignDraft()
app/api/cron/campaign-scheduler/route.ts   GET, Bearer CRON_SECRET (vercel.json: hourly)
app/admin/campaigns/page.tsx               Danh sách campaign + tạo mới
app/admin/campaigns/[id]/page.tsx          Chi tiết: stats, approval queue (QA + edit + approve/reject), enrollments table, pilot enroll dialog
app/admin/campaigns/actions.ts             Server actions (RBAC: admin/super_admin; AE xem campaign mình)
```

**Sửa file có sẵn (tối thiểu, additive):**
- `app/api/webhooks/resend/route.ts`: sau khi match opportunity/engagement thất bại (hoặc song song) → thử match **campaign enrollment** (In-Reply-To → email_drafts.campaign_enrollment_id, hoặc sender email → lead có enrollment active). Chạy `classifyCampaignReply` → lưu buyer_replies (+cột campaign_*) + buyer_interactions REPLY → state machine → handoff/stop/hold + notify. Khi engagement cũ cũng match → engagement giữ nguyên luồng cũ; enrollment chỉ dừng sequence.
- `vercel.json`: thêm cron `campaign-scheduler` (lấy giờ `7 * * * *` tránh chồng 14 cron hiện có).

## 5. Idempotency & an toàn — tổng hợp

| Rủi ro | Chống bằng |
|---|---|
| Cron retry gửi trùng 1 step | UNIQUE(firing_key) + INSERT ON CONFLICT DO NOTHING (claim atomically) |
| Claim treo giữa chừng (crash) | reclaim khi `claimed` > 30′ không ra draft |
| AE bấm approve 2 lần | `email_drafts.status` guard sẵn trong sendEmailDraft (chỉ `pending_approval` gửi được) |
| 2 scheduler chạy chồng | claim insert race → 23505 skip |
| Gửi cho buyer bị suppress | getStopReason trước khi sinh draft + email-sender chặn lớp 2 |
| Giao dịch SQL nhiều bước không atomic | Mọi thứ đi qua state claim/resolve riêng lẻ có thể retry an toàn (không có bước "chỉ được chạy 1 lần" ngoài claim) |
| AI sửa state | state machine là pure function; AI chỉ được gọi SAU khi state đã chốt, output chỉ vào content |

## 6. Thứ tự triển khai

1. 089 + 090 migration → 2. `constants` + `state-machine` (pure, có test nhanh) → 3. `interactions` + `suppression` + `enrollments` → 4. `context-builder` + `email-generator` + `email-qa` → 5. `scheduler` + cron route + vercel.json → 6. `reply-intent` + webhook branch + `handoff` → 7. UI campaigns + actions → 8. typecheck + lint + docs cập nhật.

## 7. Rõ ràng KHÔNG làm trong B1

Supplier matching / RFQ / quotation / negotiation automation · progressive discovery agent · buyer_requirements có cấu trúc · auto-send thật (chỉ shadow) · dashboard funnel đầy đủ (chỉ metrics cơ bản trong trang campaign) · fine-tune · đụng CHECK constraint cũ của `ai_intent` hay `buyer_engagements.stage`.

---

## 8. TRIỂN KHAI — ĐÃ HOÀN THÀNH (25/09/2026)

### 8.1. Đã code (git branch `arena/01a0d8ef-vexim-bridge`)

| Nhóm | File |
|---|---|
| **Migration** | `scripts/089_campaign_engine_schema.sql` (5 bảng mới + cột additive), `scripts/090_campaign_pilot_seed.sql` (campaign pilot + 4 steps) |
| **State machine (pure)** | `lib/campaign/constants.ts`, `lib/campaign/state-machine.ts` — 25 transition, KHÔNG AI/DB |
| **DB layer** | `lib/campaign/enrollments.ts` (applyTransition + enroll + queries + daily-limit counts), `lib/campaign/interactions.ts` (append-only + audit kép `activities`), `lib/campaign/suppression.ts` (STOP checks) |
| **AI (HOW)** | `lib/campaign/context-builder.ts` (BuyerContext, UNKNOWN labels), `lib/campaign/email-generator.ts` (cold email theo §12, anti-invention §20), `lib/campaign/email-qa.ts` (12 điểm, deterministic), `lib/campaign/reply-intent.ts` (7 intent: rules-trước + AI, threshold 0.85) |
| **Engine (WHEN)** | `lib/campaign/scheduler.ts` (tick: reclaim → stop-check → resume → sinh draft → grace → follow-up → NURTURE → integrity), idempotency `campaign_step_firings` UNIQUE(firing_key) + claim/reclaim atomic |
| **Handoff** | `lib/campaign/handoff.ts` (INTERESTED → buyer_engagements 'claimed' + notify AE), `lib/campaign/approve.ts` (duyệt/từ chối draft, gửi qua `sendEmailDraft` hiện có) |
| **Webhook** | `app/api/webhooks/resend/route.ts` — 2 nhánh `maybeHandleCampaignReply` (lead chưa match → trước unmatched; đã match → trước classification); handled → return sớm, không double-insert; luồng cũ KHÔNG enroll thì chạy y nguyên |
| **Cron** | `app/api/cron/campaign-scheduler/route.ts` + `vercel.json` (`7 * * * *`) |
| **UI** | `/admin/campaigns` (danh sách + tạo), `/admin/campaigns/[id]` (stats, approval queue, enrollments, enroll pilot dialog, controls), `components/admin/campaign/*`, sidebar "Chiến dịch" + badge `campaignApprovals` |
| **RBAC** | `CAPS.CAMPAIGN_VIEW` / `CAMPAIGN_MANAGE` (admin, super_admin; AE có cả hai — action hạn chế AE theo enrollment sở hữu; tạo/activate campaign chỉ admin/super_admin) |
| **Tests (pure)** | `scripts/campaign-tests/run.sh` — **51/51 pass** (state machine 25, QA+suppression 14, reply rules 12) |

### 8.2. Idempotency — đáp ứng yêu cầu bổ sung

1. **1 bước = 1 email**: `campaign_step_firings.firing_key UNIQUE` (`enrollment:step`). Claim = UPDATE-where-status (re-claim failed) hoặc INSERT ON CONFLICT DO NOTHING → 2 cron chồng/retry chỉ 1 thắng.
2. **Claim treo** (crash giữa claim và draft): cron reclaim sau 30′ → `failed` → enrollment `step_retry`.
3. **Duyệt 2 lần**: `sendEmailDraft` chỉ chấp nhận `pending_approval` (guard sẵn của hệ cũ) — lần 2 fail không gửi.
4. **AI/QA fail**: firing `failed` + `step_retry` sau 1 giờ, không mất enrollment.
5. **Gửi chỉ qua đường ống cũ** (`lib/ai/email-sender`): suppression check lớp 2, delivery tracking, ref-code, work-email — không có đường tắt.

### 8.3. Runbook triển khai production

```bash
# 1. Chạy migration (idempotent, theo thứ tự)
psql "$SUPABASE_DB_URL" -f scripts/089_campaign_engine_schema.sql
psql "$SUPABASE_DB_URL" -f scripts/090_campaign_pilot_seed.sql

# 2. Chạy test pure
bash scripts/campaign-tests/run.sh     # → 51 passed

# 3. Deploy (cron campaign-scheduler tự đăng ký qua vercel.json)
vercel --prod
```

- **Env mới:** không bắt buộc. Tuỳ chọn: `CAMPAIGN_GLOBAL_DAILY_LIMIT` (mặc định 60), `CAMPAIGN_AUTO_SEND` (KHÔNG bật trong shadow mode).
- **Shadow mode:** mọi draft → `email_drafts` `pending_approval`; auto-send chưa được nối vào scheduler (`isAutoSendEnabled()` trả false). Sau 2–4 tuần, xem AI rejection rate trong `/admin/campaigns/[id]` + `buyer_interactions` (AI draft vs final-sent đã được lưu ngay từ bây giờ để learning loop).

### 8.4. Các bước vận hành pilot đầu tiên (theo cấp bậc 10 → 30 → 50–100)

> Chốt 25/09/2026: KHÔNG enroll 50–100 buyer ngay. Chạy theo 3 nấc: **10 buyer đầu** để kiểm tra toàn bộ flow thực tế → ổn thì **30 buyer** → sau đó mới lên **50–100**. Cap cứng đặt bằng env `CAMPAIGN_PILOT_MAX_ENROLLMENTS` (mặc định 100); enroll vượt cap bị chặn ở `enrollLeads` và UI báo rõ.

1. `/admin/campaigns` → mở campaign pilot → **Enroll buyer pilot** → preview bộ lọc (food importer + VN signal + contact hợp lệ, sort shipment count) → chọn **10 buyer đầu** → chọn AE owner → Enroll.
2. **Kích hoạt** campaign (admin) → scheduler tick kế tiếp sinh email 1 cho từng enrollment → AE duyệt tại approval queue (thấy bản dịch VI, sửa được subject/content, từ chối kèm lý do).
3. Buyer reply → webhook phân loại (rules + AI) → INTERESTED tự tin ≥ 0.85 → tự tạo `buyer_engagements` (stage `claimed`) + notify AE, sequence DỪNG; OPT_OUT → stamp `email_unsubscribed` vĩnh viễn; OUT_OF_OFFICE → PAUSE 7 ngày (không tính reply); UNKNOWN/<0.85 → HOLD + hàng đợi review.
4. Không reply → follow-up 1 (+4 ngày) → follow-up 2 (+7) → close-loop (+30) → NURTURE — toàn bộ qua approval queue.

### 8.5. Follow-up Gate — "có lý do hợp lý để liên hệ tiếp không?" (yêu cầu 25/09/2026)

Trước MỌI follow-up (step ≥ 2), sau khi claim firing (exactly-once), scheduler chạy `lib/campaign/followup-gate.ts`:

1. **Defensive rules** (không AI): buyer đã reply → không bao giờ follow-up; chưa từng gửi email → không có gì để follow-up.
2. **AI assessment**: đọc BuyerContext đầy đủ (buyer + import data + `buyer_analysis`/`buyer_strategy` từ migration 079 + TOÀN BỘ previous_emails/replies) → trả `{ proceed, reason_category, reason_summary, confidence }`. Các lý do hợp lệ: `new_angle_from_research`, `friction_reduction`, `close_loop_courtesy`, `seasonal_relevance`, `value_insight`. Grounded trong context — UNKNOWN không được dùng làm lý do.
3. **Quyết định** (`applyFollowupGateDecision`):
   - `proceed=true` + confidence ≥ 0.7 → sinh draft (shadow mode: vào approval queue như thường).
   - `proceed=true` nhưng confidence < 0.7 → **HOLD human review** (firing skipped, enrollment cờ review, AE resume/stop).
   - `proceed=false` (hoặc AI lỗi — fail-safe) → **SKIP step**: không gửi, firing `skipped` + SYSTEM_EVENT + audit log; sequence đẩy con trỏ sang step kế theo delay (hết bảng → NURTURE); followup_count KHÔNG tăng vì chưa gửi gì.
4. Mọi quyết định gate đều nhìn được ở interaction `SYSTEM_EVENT` (`followup_gate_skip` / `followup_gate_hold`) + audit `campaign_followup_gate_*`.

### 8.6. Chỉ số pilot (thẻ "Chỉ số pilot" trong trang campaign)

| Chỉ số | Nguồn | Ý nghĩa |
|---|---|---|
| AI rejection rate | `email_drafts` rejected/created | AI/QA tự loại bao nhiêu |
| Human edit rate | `buyer_interactions` EMAIL `metadata.edited` | AE sửa bản AI bao nhiêu (so AI draft vs final cho learning loop) |
| Reply rate | enrollments `last_reply_at` / contacted | Hiệu quả toàn sequence |
| Interested rate | replied_handoff / replied | Chất lượng handoff |
| Wrong contact | state `invalid_contact` | Chất lượng data contact |
| Opt-out | `suppressed` reason `buyer_opted_out` | Sức khoẻ deliverability/cam kết |
| Follow-up conversion | có reply sau follow-up / enrollment có follow-up | Hiệu quả riêng của follow-up (kèm gate skip count) |

Review định kỳ 2–4 tuần: nếu AI rejection rate thấp + human edit rate giảm dần + reply rate ổn → xem xét bật `CAMPAIGN_AUTO_SEND=true` cho follow-up low-risk (vẫn giữ QA + cap + gate).


### 8.7. Sending window theo giờ địa phương buyer (bổ sung 25/09/2026)

**Chính sách B1:** Mon–Fri, khung **08:00–11:30** và **13:00–16:30** giờ LOCAL của buyer. Ngoài khung → scheduler **reschedule sang window kế tiếp** (không bỏ step, chưa claim firing nên không tốn lock). AI không bao giờ quyết định giờ gửi — window là policy thuần backend (`lib/campaign/sending-window.ts`).

**Timezone resolution (độ ưu tiên):**
1. `leads.buyer_timezone` (migration 091 — admin đặt IANA override, VD `America/Chicago`) → confident.
2. US: parse state từ `import_address` (VD "Houston, TX 77002" → `America/Chicago`) → confident.
3. Country map (UK, DE, JP, VN, SG, … — quốc gia 1 mú giờ trội) → confident.
4. US/CA không parse được state → approximate ET/Toronto → **không confident**.
5. Không xác định được → null.

**Enforcement:**
- **Scheduler (mọi mode):** trước khi claim step 1 / follow-up → `checkSendingWindow` → ngoài khung thì `next_action_at` = mốc window kế (+audit `SYSTEM_EVENT`, counter `rescheduledWindow` trong tick). Lệch DST tối đa 1h tự chữa vì tick kế re-check.
- **CAMPAIGN_AUTO_SEND=true (approve path):** chặn CỨNG qua `checkAutoSendWindow` — lỗi `outside_sending_window` khi (a) ngoài window, (b) timezone không confident, (c) không có timezone. Đúng yêu cầu "timezone chưa đủ tin cậy → không auto-send".
- **Shadow mode (hiện tại):** AE vẫn gửi được bất cứ lúc nào (human decision) nhưng metadata email ghi `buyer_tz`, `buyer_tz_source`, `window_ok` để đo và để review.


### 8.8. Gmail / CAN-SPAM compliance — kiểm tra 25/09/2026 (đã vá)

**Đã có sẵn (prompt + QA):** plain text · không link/images/attachment · không ALL CAPS/exclamation · không spam words · subject < 50 ký tự sentence-case, honest · ≤ 200 từ · From cá nhân AE (`work_email` riêng từng người, migration 053 — Gmail/Outlook tin người thật hơn brand) · daily caps 20/campaign + 60 global · soft opt-out line từ step 2 (QA bắt) · X-Entity-Ref-ID chống thread nhầm, không X-Priority/X-Campaign (spam trigger).

**Vá hôm nay:**
1. **Signature cá nhân khớp From** — trước đây AI ký "Vexim" trong khi From là "AE Name <ae@veximtrade.com>" (mismatch = tín hiệu phishing). Giờ generator nhận tên AE owner, ký đúng khối: `Best regards / <AE> / VEXIM GLOBAL CO., LTD / 25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam / veximtrade.com`.
2. **Địa chỉ bưu chính thật trong signature** (CAN-SPAM §7704 bắt buộc) — QA mới chặn MEDIUM nếu thiếu (regex theo street/ward, không đếm "Vietnam" chung chung).
3. **`List-Unsubscribe` header** (RFC 2369, vô hình với buyer) — gửi kèm token `/unsubscribe/<token>` sẵn có; Gmail/Outlook hiển thị nút hủy đăng ký gốc thay vì nút "Report spam". Chỉ áp dụng cho campaign path (email-sender nhận `extraHeaders` tuỳ chọn — flow cũ không đổi).
4. **Stamp `email_drafts.lead_id`** cho campaign drafts — lỗ hổng: suppression guard của sendEmailDraft đọc `draft.lead_id`, campaign drafts không set → guard bị bỏ qua. Đã vá ở cả 2 insert.

**Việc admin cần kiểm tra DNS (ngoài code):**
- **DMARC record** cho veximtrade.com (`_dmarc` TXT). Gmail/Yahoo yêu cầu bulk sender ≥5k ngày/ngày có DMARC; Resend lo SPF/DKIM cho domain đã verify, DMARC là bản ghi DNS phía mình — pilot volume chưa tới ngưỡng nhưng nên có sớm.
- Warm-up tự nhiên: pilot 10→30→100 đúng thiết kế chính là warm-up; đừng nhảy vọt volume.

**Quy ước duyệt:** campaign draft nên do **AE owner** bấm duyệt (From = AE duyệt) để khớp signature owner. Admin duyệt hộ thì nên sửa signature lại khớp tên mình.

### 8.9. Feedback 26/09/2026 — 4 chỉnh trước pilot (đã implement)

**Nguyên tắc chỉ đạo (user chốt):** đừng sửa để email "trông giống người" bằng mẹo né spam — sửa để nó **thực sự là một người sales đã nghiên cứu đúng buyer và có lý do chính đáng để liên hệ**. Đó là nền tảng của cả deliverability lẫn conversion. Generator giờ có NORTH STAR line đúng nghĩa này.

1. **Cấm trend claim không dữ liệu.** Generator: prohibition `growing/increasing/expanding/rising/surging/booming...`, ưu tiên khung điều kiện ("if adding a Vietnamese origin is on your roadmap"). Guidance bước 2 cũng đã bỏ câu "many buyers are expanding..." (bản thân nó là claim). QA `trend_claim` HIGH — check **theo câu**: câu chứa trend-word mà KHÔNG có marker điều kiện (`if/whether/when/should/in case`) mới bị chặn → khung "if expanding... is on the radar" vẫn hợp lệ.
2. **Factuality check claim về Vexim/supplier/compliance/audit.** `APPROVED_VEXIM_CLAIMS` (constants.ts) = whitelist 5 fact (compliance partner; not marketplace/trading; audited before introduction; FDA/HACCP/traceability services; spec-match offer) — đưa thẳng vào prompt. QA `vexim_claim` HIGH chặn phần âm: superlative (leading/largest/premier/world-class...), số liệu bịa (`\d+ factories/years/buyers...`), chứng nhận ngoài whitelist (ISO xxxx/BRC/SQF/GFSI/SMETA/halal-kosher certified). Lưu ý QA chỉ push 1 issue/matches đầu — đủ để block.
3. **Close-loop thật sự đóng vòng.** Generator guidance: nói rõ đây là email cuối + không cần reply; CẤM kết bằng câu hỏi/ép chọn ("which would you prefer?", "let me know either way"); 3–5 câu, không dấu "?". QA `close_loop_pressure` MEDIUM bắt pattern ép chọn; `cta_missing` bỏ qua khi `stepType` là close_loop/nurture (runEmailQA nhận thêm param `stepType` tuỳ chọn — scheduler truyền `step.step_type`).
4. **Identity + X-Mailer.** Quy ước thống nhất: **prose trong email = "Vexim"**, pháp nhân **VEXIM GLOBAL CO., LTD chỉ nằm trong signature** (CAN-SPAM), cấm "Vexim Trade" trong body campaign. Fallback From display khi profile thiếu full_name: "Vexim Trade Team" → "Vexim". **Đã bỏ header `X-Mailer: Vexim-Trade/1.0`** (fingerprint tự động hoá, không value; Resend định danh ở tầng SMTP). **ĐÃ CHỐT (26/09/2026): MỘT domain duy nhất `veximtrade.com`.** SIGNATURE_WEBSITE = veximtrade.com; List-Unsubscribe build từ `siteConfig.domain` (không theo env url) — link unsub không bao giờ lệch domain; transactional From display (mailer.ts presets noreply/trade/hello) vẫn "Vexim Trade" (ngoài scope campaign). **Lưu ý deploy:** app phải phục vụ được tại veximtrade.com (hoặc DNS + Vercel domain mapping) để link `/unsubscribe/<token>` hoạt động.

**Verify:** 85/85 tests (state 25, qa 22, reply 12, followup 7, window 19); tsc baseline; samples docs/samples/campaign-email-samples.md regenerate với 2 email mẫu xấu (kiểu #1 spam cổ điển, kiểu #2 trend+fabricated Vexim) đều HIGH blocked.

### 8.10. Buyer im lặng — lifecycle đầy đủ (hỏi 26/09/2026)

Trả lời "buyer chưa có nhu cầu lúc đó, không phản hồi thì xử lý thế nào" theo code đang chạy:

1. **Trong sequence (≤ 3 chạm, rồi dừng hẳn):** email 1 → gate chấm điểm lý do từng follow-up. Buyer không có nhu cầu → không reply → gate chỉ cho gửi khi có lý do THẬT (friction_reduction, close_loop_courtesy…), conf ≥ 0.7, và shadow mode AE duyệt lại từng email — AE thấy gate reason, có quyền reject. Close-loop (đã sửa 8.9) đóng vòng lịch sự, không ép trả lời. Không bao giờ drip vô hạn.
2. **Hết sequence vẫn im lặng:** cron `onNurtureDue` (mặc định +14 ngày sau email cuối) → state **`nurture`** (terminal), `stopped_reason='sequence_exhausted_no_reply'`, SYSTEM_EVENT `nurtured`, `next_action_at=NULL` — scheduler không bao giờ đụng lại. Buyer **không bị suppress**: vẫn thuộc lead pool, AE vẫn có thể liên hệ thủ công.
3. **Ở nurture — lane mới được phép:** partial unique index chỉ cấm 1 enrollment ACTIVE/lead → buyer nurture có thể enroll campaign MỚI (lane mới, đúng "một lane tại một thời điểm").
4. **Reply muộn từ nurture (vá 26/09):** trước đây `findActiveEnrollmentForLead` chỉ tìm state active → reply "giờ tôi có nhu cầu" rơi im lặng vào `unmatched_inbound_emails`, AE không được báo. Đã vá: fallback `findNurtureEnrollmentForLead` → reply được classify 7-intent, ghi `buyer_replies` + interaction, **notify AE đầy đủ**; INTERESTED tự tin → handoff tạo engagement mới cho AE tiếp quản; state enrollment GIỮ NGUYÊN nurture (state machine cấm hồi sinh — đã có test); OPT_OUT vẫn stamp suppression vĩnh viễn như thường.
