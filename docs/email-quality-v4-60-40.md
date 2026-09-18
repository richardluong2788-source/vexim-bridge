# Email V4 — 60% Compliance Consulting + 40% Buyer Product & Seasonality (Soft)

**Ngày:** 2026-05-11 V4  
**Feedback:** Văn phong hiện tại ~60% chuẩn, còn 40% nên nói về sản phẩm buyer đang nhập, tính mùa vụ (AI có thể xem trong dữ liệu hệ thống để phân tích). Ví dụ: "I noticed [Company] has a strong presence in premium cashew kernels for the US market. As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind."

**Yêu cầu trước đó vẫn giữ:** Không được đưa raw data buyer/supplier lên email — chỉ dùng để tư duy nội bộ, ngôn từ mềm mại.

---

## 1. Công Thức 60/40 V4

### 60% — Vexim Compliance Consulting (định vị cốt lõi)
- Vexim = đơn vị tư vấn tuân thủ cho DN Việt xuất khẩu vào Mỹ, không phải marketplace/trading
- Giúp nhà máy đáp ứng FDA registration, HACCP, ISO 22000, BRC, traceability, lot tracking, audit readiness
- Chỉ làm việc với factory đã qua chương trình tuân thủ + audit trực tiếp, reject 80%, direct factory
- Buyers get US-compliant suppliers, not random quotes

### 40% — Buyer Product & Seasonality Insight (mềm mại, không soi)
- **Product:** Dùng `main_product` → soft description: "premium cashew kernels", "arabica coffee", "black pepper" — KHÔNG dùng HS code
- **Seasonality:** Dùng `top_peak_months` + current date → soft hook: "peak year-end sourcing period", "Q4 peak season", "summer restocking", "first-quarter planning" — KHÔNG nêu "Oct, Nov, Dec" hay "your peak is Oct-Dec"
- **Capacity angle:** "securing consistent capacity and compliant supply is likely top of mind" — soft, không nêu số lượng, TEU, shipments

**Ví dụ 40% chuẩn (từ yêu cầu):**
> I noticed [Company Name] has a strong presence in [Specific Product, e.g., premium cashew kernels] for the US market. As we approach [Current Season Hook, e.g., the peak year-end sourcing period], securing consistent capacity and compliant supply is likely top of mind.

---

## 2. Implementation V4

### Helpers mới trong `vexim-positioning.ts`:

```ts
getSoftProductDescription(main_product):
  "Cashewnut Kernels W320" → "premium cashew kernels"
  "Arabica Green Coffee" → "premium arabica coffee"
  "Black Pepper" → "black pepper"
  // Không dùng HS code

getSoftSeasonalityHook(peak_months, currentDate):
  peak = "Oct, Nov, Dec" + current month = May → "peak year-end sourcing period"
  peak = "Oct, Nov, Dec" + current month = Oct → "peak year-end season"
  peak = "Jun, Jul, Aug" → "summer peak season"
  peak = null + current month = Sep-Nov → "peak year-end sourcing period"
  // Không expose exact months

getSeasonalCapacityAngle(seasonHook):
  "peak year-end sourcing period" → "securing consistent capacity and compliant supply is likely top of mind"
  "summer peak season" → "ensuring stable supply and compliance readiness is probably a priority"
```

### Context mới trong cả 2 luồng email:

```ts
// requirement-email.ts và email-generator.ts
const productSoft = getSoftProductDescription(main_product)
const seasonHook = getSoftSeasonalityHook(peak_months, new Date())
const capacityAngle = getSeasonalCapacityAngle(seasonHook)

context = {
  main_product_soft: productSoft, // safe: "premium cashew kernels"
  season_hook_soft: seasonHook, // safe: "peak year-end sourcing period"
  capacity_angle_soft: capacityAngle, // safe: "securing consistent capacity..."
  current_date: "2026-05-11",
  current_month: 5,
  example_40_percent: `I noticed ${company} has a strong presence in ${productSoft} for the US market. As we approach ${seasonHook}, ${capacityAngle}.`,
  _internal_hs_code: hs_code, // internal only
  _internal_purchase_history: purchase_history, // internal only
  _internal_top_suppliers: ..., // internal only
  _internal_top_peak_months: peak_months, // internal only
  _internal_supplier_vetting: {...}, // internal only
  vexim_positioning: { who_we_are, what_we_do, how_we_select, example_60_percent }
}
```

### System prompt V4 — 60/40 split:

**Requirement Inquiry (chưa có supplier):**
- Greeting
- 40% Buyer insight & seasonality (1-2 câu): dùng `main_product_soft` + `season_hook_soft` + `capacity_angle_soft` + `example_40_percent`
  - BAD: "I noticed you import HS 0801.32 from Visimex 16,800kg peak Oct-Dec"
  - GOOD: "I noticed Nodom has a strong presence in premium cashew kernels for the US market. As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind."
- 60% Vexim compliance (2-3 câu): dùng `vexim_positioning.example_60_percent` — FDA, HACCP, traceability, audit, direct factory
- CTA soft + opt-out + signature
- Length 120-170w
- Self-check: có product_soft + season_hook_soft (40%) + compliance (60%) + không raw data

**Introduction (đã có supplier):**
- Greeting
- 40% Buyer product & seasonality (1-2 câu): same as above, dùng main_product_soft + season_hook_soft
- 60% Compliance + supplier soft (2-3 câu): "The factory we work with has been through our US compliance program and audit — FDA registration, HACCP, traceability in place, verified capacity for this category" — không list exact specs
- CTA soft
- Length 120-170w

---

## 3. Ví Dụ So Sánh

### Buyer: Nodom, main_product = "Cashewnut Kernels W320", country = US, peak_months = "Oct, Nov, Dec", current date = May

**V3 (60% compliance, thiếu seasonality):**
> Hi John, I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US, and we work with a number of buyers in the cashew category who want a Vietnam option that already meets FDA and traceability requirements.

**V4 (60/40 đúng yêu cầu):**
> Hi John,
> 
> I noticed Nodom has a strong presence in premium cashew kernels for the US market. As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind.
> 
> I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US, helping them meet FDA, HACCP, and traceability requirements. Our factories go through our US compliance program and audit before joining our network — direct factory, not trading companies, only those meeting US standards.
> 
> Would you be open to exploring additional Vietnam sourcing with compliance support included for your cashew category? If now isn't the right time, no worries at all.
> 
> If sourcing from Vietnam isn't on your radar right now, just reply "no" and I won't reach out again — no hard feelings at all.
> 
> Best regards,
> Hoc Luong
> VEXIM GLOBAL CO., LTD
> ...

**Phân tích 60/40:**
- 40% = 2 câu đầu: "strong presence in premium cashew kernels for the US market" (product) + "As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind" (seasonality) — soft, không nêu Oct-Dec hay 120 shipments
- 60% = 3 câu tiếp: compliance consulting partner + FDA/HACCP/traceability + compliance program and audit + direct factory — định vị Vexim
- Tổng 145 words, plain text, no link, no HS code, no supplier names, no surveillance

### Introduction V4 (đã có supplier):

> Hi John,
> 
> I noticed Nodom has a strong presence in premium cashew kernels for the US market. As we approach peak year-end sourcing period, securing consistent capacity and compliant supply is likely top of mind.
> 
> I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US. The factory we work with has been through our US compliance program and audit — FDA registration, HACCP, and traceability from raw material in place, and we have verified capacity and lead time for this category. It's direct factory, not a trading company, and we can arrange a video call tour if helpful.
> 
> Would you be open to sharing your current spec so we can confirm fit? If now isn't the right time, no worries at all.

---

## 4. Google Deliverability — V4

V4 giữ nguyên độ an toàn V3 và còn tốt hơn vì có thêm seasonality hook tự nhiên (không phải mail-merge):

- Plain text, no links first email, <170w, human sender, opt-out human
- No spam triggers: best price, cheapest, guaranteed, free, act now...
- No surveillance triggers: HS code, 16,800kg, 120 shipments, TEU, Oct-Nov-Dec exact, supplier names, origin list — đã có regex detection trong `assessSpamRisk()`
- 60/40 balance check: phải có product mention + seasonality + compliance — nếu thiếu, flag medium risk

**Risk V4:** Low spam, Low promotions — vì soft product + seasonality hook nghe như human insight, không phải data dump.

---

## 5. Files Thay Đổi V4

1. `lib/ai/vexim-positioning.ts` V4:
   - Thêm `getSoftProductDescription()`, `getSoftSeasonalityHook()`, `getSeasonalCapacityAngle()`
   - Update `buildBuyerInsightSummary()` để nhấn mạnh product_soft + season_hook_soft
   - Update `assessSpamRisk()` thêm surveillance patterns + 60/40 balance check

2. `lib/ai/requirement-email.ts` V4:
   - Import soft helpers
   - Context thêm `main_product_soft`, `season_hook_soft`, `capacity_angle_soft`, `current_date`, `current_month`, `example_40_percent`
   - System prompt V4 60/40: 40% buyer product & seasonality (soft, dùng main_product_soft + season_hook_soft) + 60% compliance consulting, cấm expose raw data, self-check 60/40

3. `lib/ai/email-generator.ts` V4:
   - Import soft helpers
   - Computation thêm productSoft, seasonHookSoft, capacityAngleSoft
   - Context thêm soft helpers + example_40_percent
   - Introduction guidance V4 60/40: same structure, 40% product & seasonality soft + 60% compliance

4. `docs/email-quality-v4-60-40.md` (file này)

---

## 6. Kết Luận

V4 đạt đúng yêu cầu:
- 60% Vexim compliance consulting (đơn vị tư vấn tuân thủ cho DN Việt xuất khẩu Mỹ, đối tác đạt chuẩn tuân thủ Hoa Kỳ)
- 40% Buyer product & seasonality (sản phẩm buyer đang nhập + tính mùa vụ, dùng AI phân tích từ hệ thống nhưng nói mềm mại: "premium cashew kernels", "peak year-end sourcing period", "securing consistent capacity and compliant supply is likely top of mind")
- Không đưa raw data lên email (HS code, tên supplier, số lượng, peak months cụ thể) — chỉ dùng để tư duy nội bộ
- An toàn Google, tone compliance advisor, không surveillance

Sẵn sàng test với buyer có main_product và peak_months.
