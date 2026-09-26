# Mẫu email AI Campaign Engine — bố cục nội dung thật qua pipeline thật

Cách tạo: chạy **code thật** của repo — generateCampaignEmail (parser + append signature), runEmailQA (toàn bộ check), assessFollowupJustification + applyFollowupGateDecision (gate), render header theo logic approve.ts → sendEmailDraft. Sandbox không có API key model nên **phần chữ trong email** được viết tay theo đúng system prompt của generator (đó chính là việc của model khi chạy production). Còn From/Reply-To/List-Unsubscribe là format thật của pipeline.

**Kịch bản demo** (đúng segment pilot: food importer + tín hiệu sourcing VN):

| # | Campaign | Buyer | Bước |
|---|----------|-------|------|
| 1 | US Specialty Coffee Roasters — Vietnam Robusta | Sarah Mitchell — Atlantic Coffee Traders (Newark, US) | Email đầu tiên (initial_outreach) |
| 2 | ↑ cùng sequence | ↑ không reply sau 6 ngày | Follow-up (gate CHẤP THUẬN) |
| 3 | ↑ cùng sequence | ↑ không reply sau 13 ngày | Close-loop cuối sequence |
| 4 | Northeast Seafood Importers — Vietnam Pangasius & Shrimp | Mark Donovan — Harborline Seafood LLC (Boston, US) | Email đầu tiên — campaign khác, positioning khác |
| 5 | (minh hoạ) | — | Email VI PHẠM rule → bị QA chặn |

---

## 1 · Email đầu tiên — coffee

**Campaign:** US Specialty Coffee Roasters — Vietnam Robusta  
**To buyer:** sarah.mitchell@atlanticcoffeetraders.com  
**Step:** 1 · initial_outreach · guidance: _Angle: robusta for espresso blends. Tone: peer-to-peer, zero pressure. No supplier pitch yet._

**Như buyer nhận được** (headers mô phỏng theo `approve.ts` → `sendEmailDraft`):

```text
From: "Linda Nguyen" <linda.nguyen@veximtrade.com>          ← buildPersonalizedSender: tên người thật, không phải brand
Reply-To: linda.nguyen@veximtrade.com          ← work_email của AE (fallback trade@)
To: sarah.mitchell@atlanticcoffeetraders.com
Subject: Vietnamese robusta for your espresso blends

# ── headers vô hình với buyer ──
List-Unsubscribe: <https://veximbridge.com/unsubscribe/9f2ce8a1d74b4c0f8e21ab77>   ← RFC 2369; Gmail hiện nút hủy đăng ký gốc thay vì Report spam
X-Entity-Ref-ID: <c4f19e02-7b31-4a8e-9f2d-6b5c8e1a90d4@veximtrade.com>   ← chống Gmail thread nhầm (chỉ khi KHÔNG phải reply-thread)
X-Mailer: Vexim-Trade/1.0
```

```text
Hi Sarah,

Green coffee clearly keeps the team at Atlantic Coffee Traders busy, and robusta for espresso blends looks like a growing part of that picture.

I'm Linda Nguyen with VEXIM GLOBAL CO., LTD in Hanoi. We are not a marketplace or a trading company — we prepare Vietnamese coffee factories for US-market expectations such as FDA registration, HACCP and lot-level traceability, and every factory is audited before it can reach a buyer.

If adding a US-ready Vietnamese robusta origin alongside your current sources is on this year's roadmap, would a short conversation be worth your time?

Best regards,
Linda Nguyen
VEXIM GLOBAL CO., LTD
25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam
veximbridge.com
```

**QA:** 117 từ · risk **LOW** · PASSED (được vào approval queue)
&nbsp;&nbsp;── 0 issue

<details><summary><b>Bản VI cho AE review</b> (approval queue hiển thị song ngữ)</summary>

> Chào chị Sarah,
> 
> Em thấy đội ngũ Atlantic Coffee Traders đang rất tích cực trong mảng green coffee, và robusta cho espresso blends dường như đang là phần tăng trưởng.
> 
> Em là Linda Nguyen, thuộc VEXIM GLOBAL CO., LTD tại Hà Nội. Chúng em không phải marketplace hay công ty môi giới — chúng em chuẩn bị các nhà máy cà phê Việt Nam cho yêu cầu thị trường Mỹ như đăng ký FDA, HACCP và truy xuất lô, mỗi nhà máy đều được audit trước khi tiếp xúc buyer.
> 
> Nếu việc thêm một nguồn robusta Việt Nam đạt chuẩn Mỹ vào lộ trình năm nay của chị khả thi, chị có thể dành ít phút trao đổi không ạ?

</details>

---

## 2 · Follow-up — ngắn hơn, khác opening, có đường lùi

**Campaign:** ↑ cùng sequence  
**To buyer:** sarah.mitchell@atlanticcoffeetraders.com  
**Step:** 2 · follow_up · guidance: _Under 110 words. Offer the spec-match shortcut. One soft opt-out line, plain and dignified._

**Follow-up gate (AI đánh giá lại trước khi cho gửi):** proceed=**true** · confidence **0.82** ≥ 0.7 · category `friction_reduction`
> No reply after the first email; a much shorter note that lowers the effort to respond (spec-match offer, easy out) adds a new, low-friction entry point.
→ Quyết định scheduler: **GENERATE**

**Như buyer nhận được** (headers mô phỏng theo `approve.ts` → `sendEmailDraft`):

```text
From: "Linda Nguyen" <linda.nguyen@veximtrade.com>          ← buildPersonalizedSender: tên người thật, không phải brand
Reply-To: linda.nguyen@veximtrade.com          ← work_email của AE (fallback trade@)
To: sarah.mitchell@atlanticcoffeetraders.com
Subject: One easier way to compare robusta origins

# ── headers vô hình với buyer ──
List-Unsubscribe: <https://veximbridge.com/unsubscribe/9f2ce8a1d74b4c0f8e21ab77>   ← RFC 2369; Gmail hiện nút hủy đăng ký gốc thay vì Report spam
X-Entity-Ref-ID: <c4f19e02-7b31-4a8e-9f2d-6b5c8e1a90d4@veximtrade.com>   ← chống Gmail thread nhầm (chỉ khi KHÔNG phải reply-thread)
X-Mailer: Vexim-Trade/1.0
```

```text
Hi Sarah,

Quick follow-up, much lighter than my first note.

Two ways I can make this easy. If you're weighing a new robusta origin, I can shortlist Vietnamese factories that already document to US import standards, so comparing them costs you no extra homework. And if you have a spec sheet open on your desk right now, mind sending it over? I'll check whether a factory of ours matches it.

If Vietnam sourcing isn't a priority at the moment, a quick "not interested" is completely fine and I'll leave you be.

Best regards,
Linda Nguyen
VEXIM GLOBAL CO., LTD
25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam
veximbridge.com
```

**QA:** 111 từ · risk **LOW** · PASSED (được vào approval queue)
&nbsp;&nbsp;── 0 issue

<details><summary><b>Bản VI cho AE review</b> (approval queue hiển thị song ngữ)</summary>

> Chào chị Sarah,
> 
> Em nhắc nhanh, nhẹ nhàng hơn email trước.
> 
> Hai cách em có thể làm dễ dàng cho chị: nếu chị đang cân nhắc thêm nguồn robusta, em có thể chốt danh sách nhà máy Việt Nam đã đạt chuẩn hồ sơ xuất Mỹ để chị so sánh không mất công. Hoặc nếu chị đang mở spec nào trên bàn, gửi em được không ạ? Em kiểm tra nhà máy nào khớp và trả lời có/không ngay.
> 
> Nếu sourcing Việt Nam chưa phải ưu tiên, chị trả lời "not interested" là em dừng ngay ạ.

</details>

---

## 3 · Close-loop — email cuối của sequence

**Campaign:** ↑ cùng sequence  
**To buyer:** sarah.mitchell@atlanticcoffeetraders.com  
**Step:** 3 · close_loop · guidance: _3-5 sentences. Give an easy no, leave the door open, no new claims._

**Follow-up gate (AI đánh giá lại trước khi cho gửi):** proceed=**true** · confidence **0.88** ≥ 0.7 · category `close_loop_courtesy`
> Zero replies across the sequence; a final courteous note gives the buyer a dignified way to decline and closes the loop cleanly instead of an open-ended drip.
→ Quyết định scheduler: **GENERATE**

**Như buyer nhận được** (headers mô phỏng theo `approve.ts` → `sendEmailDraft`):

```text
From: "Linda Nguyen" <linda.nguyen@veximtrade.com>          ← buildPersonalizedSender: tên người thật, không phải brand
Reply-To: linda.nguyen@veximtrade.com          ← work_email của AE (fallback trade@)
To: sarah.mitchell@atlanticcoffeetraders.com
Subject: Closing the loop for now

# ── headers vô hình với buyer ──
List-Unsubscribe: <https://veximbridge.com/unsubscribe/9f2ce8a1d74b4c0f8e21ab77>   ← RFC 2369; Gmail hiện nút hủy đăng ký gốc thay vì Report spam
X-Entity-Ref-ID: <c4f19e02-7b31-4a8e-9f2d-6b5c8e1a90d4@veximtrade.com>   ← chống Gmail thread nhầm (chỉ khi KHÔNG phải reply-thread)
X-Mailer: Vexim-Trade/1.0
```

```text
Hi Sarah,

I don't want to keep landing in your inbox uninvited, so this will be my last note for a while.

If US-ready Vietnamese robusta becomes relevant later — a new blend project, a supply gap, or simple curiosity about what our factories can document — just reply here and I'll pick the thread back up exactly where we left it.

If Vietnam sourcing isn't a priority, a simple "no thanks" is completely fine and I'll close the file with no hard feelings. Which would you prefer?

Thanks for your time, Sarah.

Best regards,
Linda Nguyen
VEXIM GLOBAL CO., LTD
25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam
veximbridge.com
```

**QA:** 113 từ · risk **LOW** · PASSED (được vào approval queue)
&nbsp;&nbsp;── 0 issue

<details><summary><b>Bản VI cho AE review</b> (approval queue hiển thị song ngữ)</summary>

> Chào chị Sarah,
> 
> Em không muốn tiếp tục xuất hiện trong hộp thư của chị khi chưa được mời, nên đây sẽ là email cuối của em trong một thời gian.
> 
> Nếu robusta Việt Nam đạt chuẩn Mỹ trở nên phù hợp sau này — dự án blend mới, thiếu nguồn, hoặc đơn giản là muốn tìm hiểu năng lực hồ sơ của nhà máy — chị chỉ cần reply, em sẽ tiếp tục đúng chỗ mình đang dừng.
> 
> Nếu sourcing Việt Nam chưa phải ưu tiên, một lời "no thanks" là đủ và em sẽ đóng hồ sơ, không sao cả ạ. Chị muốn phương án nào?

</details>

---

## 4 · Email đầu tiên — campaign seafood (positioning khác)

**Campaign:** Northeast Seafood Importers — Vietnam Pangasius & Shrimp  
**To buyer:** mark.donovan@harborlineseafood.com  
**Step:** 1 · initial_outreach · guidance: _Angle: documentation handled, audit before introduction. No volume claims, no pricing._  
**Khác biệt:** import_data gần như UNKNOWN → email chỉ nói theo category, không nêu bất kỳ số liệu nào

**Như buyer nhận được** (headers mô phỏng theo `approve.ts` → `sendEmailDraft`):

```text
From: "Linda Nguyen" <linda.nguyen@veximtrade.com>          ← buildPersonalizedSender: tên người thật, không phải brand
Reply-To: linda.nguyen@veximtrade.com          ← work_email của AE (fallback trade@)
To: mark.donovan@harborlineseafood.com
Subject: Vietnam shrimp and pangasius, audit-ready

# ── headers vô hình với buyer ──
List-Unsubscribe: <https://veximbridge.com/unsubscribe/9f2ce8a1d74b4c0f8e21ab77>   ← RFC 2369; Gmail hiện nút hủy đăng ký gốc thay vì Report spam
X-Entity-Ref-ID: <c4f19e02-7b31-4a8e-9f2d-6b5c8e1a90d4@veximtrade.com>   ← chống Gmail thread nhầm (chỉ khi KHÔNG phải reply-thread)
X-Mailer: Vexim-Trade/1.0
```

```text
Hi Mark,

Keeping frozen shrimp and pangasius programs supplied on the East Coast usually means juggling vendors, and documentation is where the friction shows up.

I'm Linda Nguyen with VEXIM GLOBAL CO., LTD in Hanoi. We prepare Vietnamese seafood factories for US-market expectations — FDA registration, HACCP plans, traceability records — and every factory is audited before it can be introduced to a buyer. Direct factory relationships, not a marketplace.

Would a short call be worth it to see whether any factory in our roster fits a program you're sourcing for?

Best regards,
Linda Nguyen
VEXIM GLOBAL CO., LTD
25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam
veximbridge.com
```

**QA:** 111 từ · risk **LOW** · PASSED (được vào approval queue)
&nbsp;&nbsp;── 0 issue

<details><summary><b>Bản VI cho AE review</b> (approval queue hiển thị song ngữ)</summary>

> Chào anh Mark,
> 
> Duy trì các chương trình tôm và cá tra đông lạnh cho bờ Đông thường đồng nghĩa với xoay xở nhiều vendor, và hồ sơ giấy tờ là chỗ hay vướng.
> 
> Em là Linda Nguyen, thuộc VEXIM GLOBAL CO., LTD tại Hà Nội. Chúng em chuẩn bị nhà máy hải sản Việt cho yêu cầu thị trường Mỹ — đăng ký FDA, kế hoạch HACCP, hồ sơ truy xuất — và mỗi nhà máy đều được audit trước khi giới thiệu cho buyer. Quan hệ trực tiếp với nhà máy, không phải marketplace.
> 
> Anh có dành ít phút cuộc gọi ngắn để xem nhà máy nào trong roster phù hợp chương trình anh đang sourcing không ạ?

</details>

---

## 5 · Email vi phạm → QA chặn trước approval queue

Minh hoạ vì sao shadow mode + QA quan trọng — model thi thoảng lạc đề, các lớp sau phải bắt được. (Chú ý: đoạn "Linda" cuối email là generator **tự append signature** vì model quên — behaviour thật của buildSignature fallback.)

**Như buyer sẽ nhận được (nếu không có QA):**

```text
From: "Linda Nguyen" <linda.nguyen@veximtrade.com>          ← buildPersonalizedSender: tên người thật, không phải brand
Reply-To: linda.nguyen@veximtrade.com          ← work_email của AE (fallback trade@)
To: sarah.mitchell@atlanticcoffeetraders.com
Subject: AMAZING Vietnamese coffee deal — free samples inside!

# ── headers vô hình với buyer ──
List-Unsubscribe: <https://veximbridge.com/unsubscribe/9f2ce8a1d74b4c0f8e21ab77>   ← RFC 2369; Gmail hiện nút hủy đăng ký gốc thay vì Report spam
X-Entity-Ref-ID: <c4f19e02-7b31-4a8e-9f2d-6b5c8e1a90d4@veximtrade.com>   ← chống Gmail thread nhầm (chỉ khi KHÔNG phải reply-thread)
X-Mailer: Vexim-Trade/1.0
```

```text
Hi Sarah,

We guarantee the best price on Vietnamese robusta — only $2.90/lb for orders this month!

Book a call now: https://calendly.com/vexim-demo/15min

Linda
Best regards,
Linda Nguyen
VEXIM GLOBAL CO., LTD
25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam
veximbridge.com
```

**QA:** 43 từ · risk **HIGH** · BLOCKED (không thể approve)
&nbsp;&nbsp;── [MEDIUM] `cta_pressure` Aggressive CTA detected.
&nbsp;&nbsp;── [LOW] `cta_missing` No question/CTA found in email.
&nbsp;&nbsp;── [HIGH] `links` Link found in cold email (https://calendly.com/vexim-demo/15min). Only veximbridge.com plain-text allowed.
&nbsp;&nbsp;── [MEDIUM] `spam_word` Spam trigger word detected (/\bguarantee(d)?\b/i).
&nbsp;&nbsp;── [LOW] `exclamation` Exclamation mark found — keep tone flat.

→ `risk_level = HIGH` → **nút Approve bị chặn ở UI** (`approveAndSendCampaignDraft` trả `qa_blocked`). Draft vẫn nằm trong queue để AE xem model sai ở đâu.
