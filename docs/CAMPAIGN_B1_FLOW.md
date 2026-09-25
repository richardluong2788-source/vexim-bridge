# B1 CAMPAIGN ENGINE — LUỒNG HOẠT ĐỘNG (end-to-end)

> Cập nhật 25/09/2026 — phản ánh đúng code đã merge: shadow mode + follow-up gate + sending window + handoff.
> Code tham chiếu: `lib/campaign/*`, `app/api/cron/campaign-scheduler`, `app/api/webhooks/resend`, `app/admin/campaigns`.

---

## 0. Hai luồng chạy song song

Hệ thống có đúng **2 cỗ máy**, không phụ thuộc nhau:

| | Cỗ máy | Nhịp | Việc |
|---|---|---|---|
| **OUT** | Scheduler cron (`/api/cron/campaign-scheduler`) | Mỗi giờ (:07) | Quyết WHEN gửi/reschedule/skip/nurture |
| **IN** | Resend webhook (`/api/webhooks/resend`) | Realtime (buyer reply / bounce) | Phân loại + định tuyến reply |

Con người (AE/admin) đứng ở giữa: duyệt mọi email OUT, xử lý mọi trường hợp IN không chắc chắn.

---

## 1. Chuẩn bị (1 lần — đã xong phần deploy, còn migration)

```
psql -f scripts/089_campaign_engine_schema.sql   # 5 bảng + cột additive
psql -f scripts/090_campaign_pilot_seed.sql      # campaign pilot + 4 steps
psql -f scripts/091_buyer_timezone.sql           # leads.buyer_timezone
deploy (cron tự đăng ký qua vercel.json)
```

UI: `/admin/campaigns` → campaign pilot → **Enroll buyer pilot** (bộ lọc food importer
+ tín hiệu VN + contact hợp lệ; shipment count chỉ sort ưu tiên) → chọn **10 buyer đầu**
→ chọn AE owner → admin bấm **Kích hoạt**.

---

## 2. Luồng OUT — một enrollment đi qua state machine

```
                        ┌──────────────────────────────────────────────┐
                        │  TICK MỖI GIỜ (scheduler)                    │
                        │  1. Reclaim firing treo >30′                 │
                        │  2. Với từng enrollment đến hạn:             │
                        │     STOP-check  →  HOLD-check  →  switch     │
                        └──────────────┬───────────────────────────────┘
                                       ▼
  ENROLLED ──đến hạn──▶ [WINDOW CHECK] ──ngoài khung──▶ reschedule next_action_at
      │                  Mon–Fri                     (không bỏ step, chưa claim)
      │                  08:00–11:30                          │
      │                  13:00–16:30   ◀──────────────────────┘
      │                  giờ LOCAL buyer
      ▼ trong khung
  [DAILY LIMIT check] ──vượt──▶ dời 1 giờ
      ▼
  [CLAIM firing] ──trùng──▶ skip (tick khác đang giữ)
      ▼ exactly-once
  [STOP-check lần cuối] ──unsub/bounce/complaint──▶ SUPPRESSED / INVALID_CONTACT
      ▼
  buildBuyerContext()  ← buyer + import data + research + TOÀN BỘ email/reply lịch sử
      ▼                (không có dữ liệu → "UNKNOWN")
  AI generate Email 1  (§12: intro + relevance, KHÔNG bán supplier, cấm bịa §20)
      ▼
  QA 12 điểm ──HIGH──▶ draft bị CHẶN (status draft, KHÔNG gửi được) + notify AE
      ▼ LOW/MEDIUM
  email_drafts = pending_approval   →  state = CONTACT_PENDING  →  notify AE
      ▼
  ┌─────────────────────────── SHADOW MODE ───────────────────────────┐
  │  AE mở approval queue: xem EN + bản dịch VI + QA result + số từ   │
  │  • Duyệt & gửi (sửa subject/content tuỳ ý)                        │
  │  • Từ chối + lý do → firing failed → AI thử lại sau 1 giờ         │
  └──────────────┬────────────────────────────────────────────────────┘
                 ▼ gửi (chỉ qua sendEmailDraft — suppression guard + tracking)
           state = CONTACTED (grace 24h, stamp last_contact_at)
                 ▼ 24h không có gì
           state = WAITING_REPLY, mở countdown follow-up (+4 ngày)
```

### Follow-up (step 2 → 3 → 4) — khác Email 1 ở chỗ có GATE

```
  countdown hết ─▶ [WINDOW CHECK] ─▶ [LIMIT] ─▶ [CLAIM]
                                                        ▼
                                   ┌──── FOLLOW-UP GATE (step ≥ 2) ────────────┐
                                   │ Defensive rules (không AI):               │
                                   │   đã reply?  → KHÔNG BAO GIỜ follow-up    │
                                   │   chưa gửi gì? → không có gì để follow    │
                                   │        ▼                                  │
                                   │ AI đọc TOÀN BỘ context + research +       │
                                   │ import data + mọi email đã gửi:           │
                                   │   "Có lý do HỢP LÝ để liên hệ tiếp?"      │
                                   └──────┬───────────┬───────────┬────────────┘
                                          ▼           ▼           ▼
                                    có, conf ≥0.7   không chắc   KHÔNG / AI lỗi
                                          ▼           ▼           ▼
                                     sinh draft    HOLD human   SKIP step:
                                     → approval    review (AE   firing=skipped +
                                       queue       resume/stop)  đẩy sang step kế
                                                                (hết bảng→NURTURE)
```

Skip step **không tăng followup_count** (chưa gửi gì), có SYSTEM_EVENT + audit
log lý do (`followup_gate_skip` / `followup_gate_hold`) — sau này nhìn lại được
AI đã từ chối gửi vì lý do gì.

### Hết sequence

```
  Email 1 → FU1 (+4d) → FU2 (+7d) → Close-loop (+30d) → hết bảng, vẫn im lặng
      ▼
  NURTURE (terminal) — dừng tự động, AE có thể tự chủ động sau
```

Mỗi follow-up gửi xong: `state = FOLLOWUP_1/2`, `followup_count +1`,
countdown theo `delay_days` của step kế.

---

## 3. Luồng IN — buyer reply (webhook, realtime)

```
  Buyer reply → Resend email.received → dedup theo message_id
      ▼
  MATCH enrollment:
    • In-Reply-To → campaign draft (mạnh nhất)
    • sender email → lead có enrollment ACTIVE
    • KHÔNG có enrollment → flow CŨ chạy y nguyên (không ảnh hưởng pipeline)
      ▼
  CLASSIFY 7 intent  (rules TRƯỚC → AI nếu rules không chắc → rule-dừng thắng AI)
      ▼
  Lưu buyer_replies (cột campaign_*) + interaction REPLY (append-only)
      ▼
  ĐỊNH TUYẾN theo intent:
```

| Intent | Điều kiện | Hành động |
|---|---|---|
| **INTERESTED** | conf ≥ 0.85 | `REPLIED_HANDOFF` → **tạo `buyer_engagements` stage `claimed`** + notify AE → **campaign DỪNG, CRM hiện tại tiếp quản** |
| **NOT_INTERESTED** | conf ≥ 0.85 | `STOPPED` (terminal) |
| **OPT_OUT** | conf ≥ 0.85 | `SUPPRESSED` + stamp `leads.email_unsubscribed` (vĩnh viễn, chỉ admin gỡ) |
| **WRONG_CONTACT** | conf ≥ 0.85 | `INVALID_CONTACT` |
| **NOT_NOW** | conf ≥ 0.85 | `PAUSED` 30 ngày → hết hạn quay lại luồng |
| **OUT_OF_OFFICE** | — | `PAUSED` 7 ngày, **KHÔNG tính là reply** (không đếm FU, không dừng) |
| **UNKNOWN / conf < 0.85** | — | **HOLD human review** — follow-up đứng lại đến khi AE resume/stop |

Ghi chú: nếu buyer cũ cũng match `buyer_engagements` (đang ở pipeline hiện có),
stage transition cũ vẫn chạy song song — campaign chỉ dừng sequence của mình.

## 4. Luồng IN — delivery events (bounce / spam complaint)

```
  Resend email.bounced (hard) / email.complained
      ▼  (delivery-events hiện có)
  stamp leads.email_hard_bounced_at / email_complained_at
      ▼  tick scheduler kế tiếp
  STOP-check bắt được → enrollment = SUPPRESSED (không bao giờ email nữa)
```

---

## 5. Con người chạm vào đâu?

| Ai | Làm gì | Ở đâu |
|---|---|---|
| Admin | Tạo/activate campaign, enroll, đặt `buyer_timezone` override, chạy scheduler tay, gỡ suppression | `/admin/campaigns` |
| AE | Duyệt/sửa/từ chối mọi email; resolve reply-review & gate-hold; pause/resume/stop enrollment của mình | Approval queue + bảng enrollment |
| AE | Xử lý buyer sau handoff (record requirements → shortlist → …) | Inbox engagement hiện có (không đổi) |
| Không ai | — AI tự gửi · AI tự sửa state · AI tự chọn giờ gửi · overwrite lịch sử | — |

---

## 6. Tám lớp an toàn (theo thứ tự chặn)

1. **Campaign phải `active`** + có steps — cron bỏ qua campaign draft.
2. **STOP-check** (unsub/bounce/complaint/missing email) — trước mọi hành động.
3. **Human-review HOLD** — enrollment bị khoá khỏi cron khi có cờ.
4. **Sending window** Mon–Fri 08:00–11:30 / 13:00–16:30 local — ngoài khung chỉ reschedule.
5. **Daily limits** (20/campaign + 60 toàn hệ thống) — sau window, trước claim.
6. **Idempotency** — `campaign_step_firings` UNIQUE(firing_key): retry/restart không gửi trùng.
7. **Follow-up gate** — step ≥ 2 phải có lý do hợp lý do AI xác nhận trên context; không có → skip/hold.
8. **QA 12 điểm** — HIGH chặn gửi; **shadow mode** — mọi email qua AE; auto-send bị chặn kép (window confident + chưa bật env).

---

## 7. Vòng đời ngắn gọn nhất (1 câu mỗi stage)

**Enroll** (admin, 10 buyer) → scheduler **sinh draft** (window + limit + QA) → **AE duyệt & gửi**
→ **đợi 24h** → **đợi reply +4 ngày** → đến hạn **AI tự hỏi "có lý do không?"** → có thì draft tiếp,
không thì skip → hết sequence → **NURTURE**. Trong lúc đó buyer **reply** → **classify ngay**
→ quan tâm thì **handoff sang inbox hiện có** cho AE, từ chối/opt-out thì **dừng vĩnh viễn**,
không chắc thì **đứng ra hỏi AE**.
