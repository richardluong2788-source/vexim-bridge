# Email Giai Đoạn Đầu — V3 Soft Approach + Compliance Consulting

**Ngày:** 2026-05-11 (V3 sau feedback)  
**Feedback:** Không được đưa dữ liệu buyer/supplier lên email — buyer sẽ nghĩ bị soi. Dữ liệu chỉ dùng để tư duy nội bộ, đối chiếu và đưa ra lời chào phù hợp, mềm mại. Vexim là đơn vị tư vấn tuân thủ cho DN Việt xuất khẩu vào Mỹ, đối tác được tuyển chọn chất lượng đạt yêu cầu tuân thủ Hoa Kỳ.

---

## 1. Triết Lý Mới V3

### Sai lầm V2:
```text
BAD: "I noticed you import cashew W320 under HS 0801.32 from Vietnam and Chile, 
      with peak around Oct-Dec and 120 shipments, 16,800kg — capacity 80 tons 
      lead time 15 days FDA active 5 QC engineers"
→ Buyer cảm thấy bị surveillance, giống tool scrape ImportYeti
```

### Đúng V3:
```text
GOOD: "We work with a number of buyers in the cashew category who are looking 
       to strengthen their Vietnam supply with factories that already meet 
       US compliance requirements"

GOOD: "Many buyers in your space tell us they want a Vietnam option that already 
       has FDA registration and traceability in place, rather than starting 
       compliance from scratch"

GOOD: "For cashew W320, Vietnam offers strong options, but US compliance is where 
       many factories fall short — that's where our compliance program helps"
```

**Nguyên tắc:**
- `_internal_*` fields = chỉ để AI reasoning, chọn góc tiếp cận, chọn compliance pillar relevant
- Email = soft category-level insight + compliance consulting positioning, không nêu raw data
- Vexim = compliance consulting partner, không phải marketplace/trading

---

## 2. Dữ Liệu Vẫn Dùng Nhưng Internal Only

### Buyer Intelligence (internal reasoning):
- `hs_code`, `purchase_history`, `top_suppliers`, `main_import_countries`, `peak_months`, `total_shipments`, `origin_ports`, `bol_description` → prefix `_internal_` trong context JSON, prompt ghi rõ "INTERNAL REASONING ONLY, DO NOT expose verbatim"

AI dùng để:
- Biết buyer là US → nhấn FDA + traceability
- Biết main_product là cashew → dùng soft "buyers in the cashew category"
- Biết purchase_history có VN → angle "buyers who already work with Vietnam"
- Biết main_import_countries đa dạng → angle "many buyers are looking to strengthen Vietnam supply"
- Biết volume lớn → internal confirm capacity fit, nhưng email chỉ nói "verified capacity for this category"

### Supplier Vetting (internal reasoning):
- `certifications`, `fda_status`, `production_capacity`, `moq`, `lead_time`, `payment_policy`, `traceability`, `export_markets` → `_internal_supplier_vetting`
- AI dùng để confirm fit, nhưng email chỉ nói soft: "The factory we work with has been through our US compliance program and audit — FDA registration, HACCP, traceability in place, and we have verified capacity and lead time for this category"
- KHÔNG list: "capacity 80 tons/month, lead time 15 days, FDA active, 5 QC engineers, FOB Ho Chi Minh, T/T + L/C"

---

## 3. Vexim Định Vị Mới — Compliance Consulting

**Trước V2:** "We only work with factories we've audited — curated network, valid certs, fast response, flexible payment"

**Sau V3 (theo yêu cầu):**
> Vexim is a compliance consulting partner for Vietnamese factories exporting to the US — not a marketplace, not a trading company.
> We help Vietnamese manufacturers meet US compliance requirements: FDA registration, HACCP, ISO 22000, BRC, traceability from raw material to finished goods, lot tracking, food safety training, audit readiness.
> Only factories that have been through our compliance program and audit, meeting US standards, join our network. We reject 80% that apply. Direct factory, transparent pricing, no trading companies.
> Buyers don't just get a supplier — they get a supplier that has already been through US compliance consulting and audit.

**Trust pillars soft:**
- Compliance program for US market: FDA, HACCP, ISO, BRC, traceability
- Factory audit by Vexim team, direct factory, 50-300 workers typical
- Quality system: traceability, QC engineers, English export team
- Support: 24h response, video factory tour, flexible payment

Email chỉ mention 1 pillar soft, không list dài.

---

## 4. Email Mới V3 — Ví Dụ

### Requirement Inquiry (chưa có supplier)

**Subject:** Vietnam cashew — US compliance support

**Body V3 soft (130 words):**
> Hi John,
>
> I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US, and we work with a number of buyers in the cashew category who want a Vietnam option that already meets FDA and traceability requirements.
>
> Our factories go through our US compliance program (FDA registration, HACCP, traceability from raw material) and audit before joining our network — direct factory, not trading companies.
>
> Would you be open to exploring additional Vietnam sourcing with compliance support included for your cashew category? If now isn't the right time, no worries at all.
>
> If sourcing from Vietnam isn't on your radar right now, just reply "no" and I won't reach out again — no hard feelings at all.
>
> Best regards,
> Hoc Luong
> VEXIM GLOBAL CO., LTD
> trade@veximtrade.com
> 25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam

**Điểm khác V2:**
- Không hề có HS code, supplier names, shipment counts, peak months, volumes
- Soft: "buyers in the cashew category", "many buyers tell us"
- Compliance consulting: "compliance consulting partner", "US compliance program (FDA, HACCP, traceability)"
- Vẫn personalized nhẹ qua main_product category, không surveillance

### Introduction (đã có supplier)

**Subject:** Vietnam W320 — US compliance support included

**Body V3 soft (145 words):**
> Hi John,
>
> I'm Hoc with Vexim in Vietnam — we work as a compliance consulting partner for Vietnamese factories exporting to the US.
>
> We work with buyers in the cashew category who want a Vietnam option that already meets US compliance, rather than starting from scratch. The factory we work with has been through our US compliance program and audit — FDA registration, HACCP, and traceability from raw material in place, and we have verified capacity and lead time for this category.
>
> It's direct factory, not a trading company, and we can arrange a video call tour if helpful.
>
> Would you be open to sharing your current spec so we can confirm fit? If now isn't the right time, no worries at all.
>
> Best regards,
> Hoc Luong
> VEXIM GLOBAL CO., LTD
> ...

**Điểm khác V2:**
- Không list "capacity 80 tons, lead time 15 days, 5 QC engineers, FOB, T/T + L/C"
- Soft: "verified capacity and lead time for this category", "FDA registration, HACCP, traceability in place"
- Compliance consulting angle xuyên suốt

---

## 5. Google Deliverability — V3 Càng An Toàn Hơn

V3 soft approach **giảm rủi ro** so với V2:

| Yếu tố | V2 | V3 | Lợi ích |
|--------|----|----|---------|
| Raw buyer data exposure | Có (HS, supplier names, volumes, peak) | **Không** — internal only | Giảm surveillance feeling, giảm Promotions risk (Gmail phát hiện mail-merge) |
| Supplier specs listing | Có (capacity, lead time, QC count) | **Không** — soft "verified capacity" | Giảm brochure feeling, tăng Primary rate |
| Length | 130-200w | 120-170w | Ngắn hơn, Gmail ưu tiên |
| Tone | Consultative + specific | Compliance advisor + soft | Ít salesy, nhiều trust |
| Spam triggers | Đã tránh | Đã tránh + thêm surveillance check | An toàn hơn |

**Surveillance detection mới trong `assessSpamRisk()`:**
- Regex phát hiện HS code, "16,800kg", "120 shipments", "TEU", "peak Oct-Dec", "I noticed you import from X and Y" → flag High risk
- Khuyến nghị: dùng soft category language

**Kết luận:** V3 **an toàn hơn V2** về cả Google policy lẫn tâm lý buyer. Không vi phạm, không bị coi là soi data.

---

## 6. Implementation V3

**Files sửa:**
1. `lib/ai/requirement-email.ts` — context đổi sang `_internal_*`, vexim_positioning = compliance consulting, system prompt V3 cấm expose raw data, yêu cầu soft language, self-check surveillance
2. `lib/ai/email-generator.ts` — introduction guidance V3 soft, context đổi sang `_internal_*`, vexim_positioning compliance consulting
3. `lib/ai/vexim-positioning.ts` — V3: pillars đổi sang compliance consulting, functions `buildBuyerInsightSummary` / `buildSupplierTrustSignals` / `buildBuyerSupplierMapping` đều ghi `[INTERNAL] ... DO NOT expose verbatim`, `getVeximPositioningSnippet` soft compliance, `assessSpamRisk` thêm surveillance patterns
4. `docs/email-quality-v3-soft-approach.md` (file này) — giải thích triết lý mới

**Cách AI tư duy nội bộ V3:**
1. Đọc `_internal_purchase_history` → biết buyer đã từng mua VN → chọn angle "buyers who already work with Vietnam" (soft, không nêu tên)
2. Đọc `_internal_hs_code` + `main_product` → biết category cần FDA/HACCP → chọn pillar "FDA registration and traceability"
3. Đọc `_internal_main_import_countries` → biết đa dạng nguồn → angle "strengthen Vietnam supply with US-compliant factories"
4. Đọc `_internal_supplier_vetting.fda_status` → confirm fit → email nói "FDA registration in place for US market" (soft, không số FDA)
5. Tổng hợp thành email mềm mại, compliance-focused, không surveillance

---

## 7. Khuyến Nghị

1. **Training AE:** Khi viết `viPrompt` (Vietnamese instruction), nhấn mạnh compliance angle, không yêu cầu AI nêu raw data. VD: "Giới thiệu Vexim là đơn vị tư vấn tuân thủ cho DN Việt xuất khẩu Mỹ, hỏi buyer có muốn đánh giá thêm nguồn cung VN với hỗ trợ tuân thủ không. Dùng ngôn từ mềm mại, không soi data."
2. **Monitor:** Dùng `assessSpamRisk()` trước khi gửi — nếu flag surveillance patterns, rewrite
3. **A/B test V3 vs V2:** Đo reply rate và cảm nhận buyer (V3 dự kiến reply cao hơn vì không bị cảm giác soi)
4. **Future:** Có thể thêm compliance content marketing: "We recently helped a factory in Binh Phuoc get FDA registration in 30 days" — soft proof, không phải raw data

---

**Tóm tắt:** V3 giải quyết đúng feedback: dữ liệu buyer/supplier chỉ để tư duy nội bộ, email dùng ngôn từ mềm mại, định vị Vexim là compliance consulting cho DN Việt xuất khẩu Mỹ, đối tác đạt chuẩn tuân thủ Hoa Kỳ. An toàn Google, không surveillance, tăng trust.
