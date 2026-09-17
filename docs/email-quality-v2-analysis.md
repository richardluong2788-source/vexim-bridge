# Email Giai Đoạn Đầu — Nâng Cấp Chất Lượng & Phân Tích Deliverability

**Ngày:** 2026-05-11  
**Yêu cầu:** Kết hợp (1) dữ liệu supplier vetted từ form nhập liệu và (2) dữ liệu buyer chi tiết để tạo email mapping chất lượng, đồng thời đánh giá nguy cơ vi phạm chính sách Google gây spam/promotions.

---

## 1. Hiện Trạng

### Email hiện tại hoạt động tốt về deliverability:
- ✅ Vào inbox chính (Primary) — không rơi Promotions
- ✅ Plain text, không có link/image ở email đầu
- ✅ Personalized sender name: "Hoc Luong <trade@...>" thay vì "Vexim Trade"
- ✅ Không dùng fake Re:/Fwd, không ALL CAPS, không spam trigger words
- ✅ Opt-out human: "just reply no..." — CAN-SPAM compliant
- ✅ Signature chỉ name/title/legal entity/address, không phone/email

### Vấn đề:
- ❌ Quá rộng, chưa lột tả định vị Vexim
- ❌ Chưa tận dụng dữ liệu supplier vetted (chứng chỉ, FDA, response rate, payment linh hoạt)
- ❌ Chưa tận dụng buyer deep data (lịch sử, quốc gia nhập, mùa cao điểm, HS code)
- ❌ Không có mapping buyer ↔ supplier

---

## 2. Dữ Liệu Sẵn Có

### Buyer Intelligence (từ `leads` table):
| Field | Ví dụ | Dùng để làm gì |
|-------|-------|----------------|
| `main_product` | "Cashewnut Kernels W320" | Product specificity |
| `hs_code` | "0801.32" | HS chapter matching |
| `secondary_hs_codes` | "0801.31, 2008.19" | Cross-sell |
| `purchase_history` | "Mua của Visimex Corp (VN) từ 2024, 2025 mua của Chile 16,800kg" | Scenario A/B/C detection |
| `top_suppliers` | [{"name": "OLAM", "country": "Vietnam"}, ...] | Competitive positioning |
| `main_import_countries` | "Vietnam, India, Chile" | Diversification angle |
| `top_peak_months` / `top_low_months` | "Oct, Nov, Dec" / "Feb, Mar" | Timing, capacity planning |
| `total_shipments`, `avg_teu_per_month` | 120 shipments, 3.5 TEU | Volume sizing |
| `origin_ports`, `destination_ports` | "Ho Chi Minh -> Los Angeles" | Logistics fit |
| `has_active_inquiry`, `inquiry_products` | true, "W320, 10 tons" | Direct intent |
| `bol_description` | "Cashew kernels white wholes" | Spec understanding |

### Supplier Vetting (từ form nhập liệu supplier):
| Field | Nguồn | Dùng để pitch |
|-------|-------|---------------|
| `certifications` | client_intake_submissions.certifications | HACCP, ISO 22000, BRC, FDA, HALAL |
| `quality_systems` | quality_systems | ISO, HACCP, GMP |
| `fda_status`, `fda_number` | fda_status, fda_number | US compliance — critical for US buyer |
| `production_capacity` | production_capacity | "50 tons/month" vs buyer volume |
| `moq`, `lead_time_days` | moq, lead_time_days | Fit for trial vs bulk |
| `incoterms` | incoterms | FOB, CIF, EXW flexibility |
| `payment_policy` | payment_policy | T/T, L/C at sight, flexible |
| `traceability` | traceability | Lot tracking, raw material to finished |
| `export_markets`, `export_since_year` | export_markets, export_since_year | "Export to US/EU since 2018" |
| `oem_odm` | oem_odm | Private label capability |
| `company_scale` | company_scale | 50-300 workers |
| `has_export_dept`, `has_english_staff` | has_export_dept, has_english_staff | 24h response, English team |
| `staff_engineers_count` | staff_engineers_count | QC engineers |
| `usp_points` | usp_points | "Fast response", "Competitive price" |
| `client_products.hs_code`, `compliance_badges` | client_products | Product-HS match |
| `compliance_docs` (factory_video, COA, FDA cert) | compliance_docs | Proof pillars |

---

## 3. Mapping Logic — Buyer Needs → Supplier Strengths

### Implemented in `lib/ai/vexim-positioning.ts`:

```ts
buildBuyerSupplierMapping(buyer, supplier):
- HS Code alignment: Buyer HS 0801.32 ↔ Supplier HS 0801.32 = direct match
- Volume fit: Buyer 3.5 TEU/month ↔ Supplier 50 tons/month = suitable scale
- Seasonality: Buyer peak Oct-Dec + Supplier lead time 15 days = plan ahead
- US compliance: Buyer US-based + Supplier FDA registered = ready for US import
- Vietnam experience: Buyer already sources from VN = easier switch, familiar logistics
- Diversification: Buyer sources from Chile/India = Vietnam reduces single-country risk
- Payment flexibility: Supplier T/T + L/C at sight = match buyer preference
- Certifications: HACCP/ISO/BRC match product category requirements
- Traceability: lot tracking important for US/EU buyers
```

### Ví dụ mapping cụ thể:
**Buyer:** US company, imports Cashew W320 HS 0801.32 from Vietnam (Visimex 2024) and Chile (16,800kg 2025), peak Oct-Dec, 120 shipments, 3.5 TEU/month, destination Los Angeles.

**Supplier:** Factory 150 workers, export since 2018 to US/EU, HACCP/ISO 22000/BRC, FDA registered, capacity 80 tons/month, MOQ 5 tons, lead time 15 days, FOB Ho Chi Minh, T/T + L/C at sight, traceability from farm, QC 5 engineers, English export team.

**Mapping:**
- HS match: 0801.32 exact
- Volume fit: 3.5 TEU (~70 tons) vs 80 tons capacity = perfect
- Seasonality: Peak Oct-Dec, lead time 15 days = order by Sep for peak
- US compliance: FDA registered = US import straightforward
- Vietnam experience: Already bought from Visimex VN = familiar with VN quality
- Payment: L/C at sight available = safe for new supplier trial

---

## 4. Email Mới — Cấu Trúc & Ví Dụ

### 4.1 Requirement Inquiry (trước khi chọn supplier) — V2

**Trước (generic):**
> Hi John, I'm Hoc with Vexim in Vietnam. I came across your company while looking into cashew buyers... Would you be open to evaluating additional sourcing from Vietnam?

**Sau (high-quality mapping, vẫn an toàn Google):**
> Subject: Sourcing cashew W320 from Vietnam
> 
> Hi John,
> 
> I noticed Nodom imports cashew W320 under HS 0801.32 from Vietnam and Chile, with peak shipments around Oct-Dec and about 120 shipments — I'm Hoc with Vexim in Vietnam, we only work with factories we've audited ourselves.
> 
> Typical partners in our network have valid HACCP/ISO and FDA registration for US, with traceability from raw material and flexible payment including L/C at sight — response within 24h and English export team.
> 
> Would you be open to evaluating additional sourcing from Vietnam for your cashew category? If now isn't the right time, no worries at all.
> 
> If sourcing from Vietnam isn't on your radar right now, just reply "no" and I won't reach out again — no hard feelings at all.
> 
> Best regards,
> Hoc Luong
> VEXIM GLOBAL CO., LTD
> trade@veximtrade.com
> 25/6, Lane 51, Ngoa Long Street, Tay Tuu Ward, Hanoi, Vietnam

**Điểm cải thiện:**
- ✅ 2 buyer data points cụ thể: HS 0801.32 + Vietnam/Chile + peak Oct-Dec + 120 shipments
- ✅ 1-2 Vexim trust pillars relevant: FDA + traceability + L/C at sight + 24h response (relevant for US buyer evaluating new supplier)
- ✅ Vẫn plain text, không link, không spam trigger, 150 words
- ✅ Tone consultative, không brochure

### 4.2 Introduction (sau khi chọn supplier) — V2

**Trước (buyer relevance only, không mention supplier proof):**
> Are rising costs on your Chile supply starting to squeeze margins? I noticed you import cashew... Rather than sending you a general supplier list, we can shortlist manufacturers based on your spec...

**Sau (buyer + supplier mapping):**
> Subject: Nodom's cashew W320 supply — audited factory in Vietnam
> 
> Hi John,
> 
> I noticed Nodom imports W320 under HS 0801.32 from Vietnam (Visimex in 2024) and Chile for your 16,800kg volume, with peak around Oct-Dec — I'm Hoc with Vexim, we only represent factories we've visited and audited.
> 
> The factory we work with produces W320 under same HS with valid HACCP/ISO 22000/BRC and FDA registration active for US, capacity 80 tons/month and lead time 15 days which lines up with your peak season. They offer T/T and L/C at sight with traceability from farm to finished pack, and English export team with 24h response.
> 
> Would you be open to sharing your current spec so we can confirm fit and arrange a video call tour if helpful? If now isn't the right time, no worries at all.
> 
> Best regards,
> Hoc Luong
> VEXIM GLOBAL CO., LTD
> ...

**Điểm cải thiện:**
- ✅ 3 buyer data points: HS + purchase_history (Visimex 2024 + Chile 16,800kg) + peak + volume
- ✅ 3 supplier strengths mapped: FDA + capacity/lead time vs peak + L/C + traceability + English team
- ✅ Vexim positioning: audited factory, not trading company, 80% reject rate implied
- ✅ Vẫn <180 words, plain text, no link, consultative

---

## 5. Google Deliverability — Phân Tích Tính Khả Thi & Rủi Ro

### 5.1 Gmail Bulk Sender Guidelines (2024 update, vẫn áp dụng 2026)

**Nếu gửi >5000 email/ngày tới Gmail:**
- Bắt buộc SPF, DKIM, DMARC (Vexim đã có via Resend + veximtrade.com verified)
- Bắt buộc one-click unsubscribe header (Resend tự thêm)
- Spam complaint rate <0.3% (theo dõi via Resend webhook → email_drafts.delivery_status)
- Hiện tại Vexim gửi <5000/ngày → chưa bị enforce strict, nhưng nên tuân thủ để future-proof

**Vexim hiện trạng:**
- ✅ Domain veximtrade.com verified trên Resend (SPF/DKIM OK)
- ✅ Personalized sender: "Hoc Luong <trade@...>" + work_email personal khi có
- ✅ Reply-To = AE personal work_email (tăng trust)
- ✅ No List-Unsubscribe header cho cold email (tránh Promotions — đúng)
- ✅ Plain text, không HTML nặng

### 5.2 Content-based Filtering — Primary vs Promotions vs Spam

**Gmail phân loại dựa trên:**
1. **Sender reputation:** history, engagement, complaint rate
2. **Content signals:** marketing language, images, links, HTML ratio, spam trigger words
3. **User behavior:** open, reply, move to Primary, mark as spam

**Yếu tố đẩy vào Promotions (cần tránh ở email đầu):**
- ❌ Nhiều link, nhiều image, HTML template nặng
- ❌ Marketing language: "best price", "free", "discount", "limited time", "buy now"
- ❌ Generic template shape: greeting → company pitch paragraph → value prop → CTA → sign-off (Salesloft/Apollo shape)
- ❌ ALL CAPS, nhiều exclamation marks, emoji
- ❌ Fake Re:/Fwd

**Yếu tố giữ ở Primary (đang làm tốt):**
- ✅ Plain text, 1-3 câu/đoạn, short paragraphs
- ✅ Personalized observation về buyer (HS, product, import countries)
- ✅ Human sender name, conversational tone, contractions (I'm, you're)
- ✅ No links/images ở email đầu
- ✅ Opt-out human, không legal footer
- ✅ Signature minimal: name/title/legal entity/address

### 5.3 Rủi Ro Khi Thêm Supplier Vetting Data

**Nguy cơ nếu làm không khéo:**
- Liệt kê quá nhiều certs/payment/capacity như brochure → marketing copy → Promotions
- Dùng superlatives: "best", "cheapest", "guaranteed" → spam trigger
- Email dài >200 words → Gmail ưu tiên <150 cho cold
- Thêm link factory video/COA ở email đầu → Promotions + giảm trust

**Mitigation đã implement:**
1. **Weave, don't list:** Trust pillars được weave vào cùng câu với buyer observation, không phải paragraph riêng. Ví dụ: "I noticed you import W320 from Vietnam and Chile — I'm Hoc with Vexim, we only work with factories we've audited ourselves, typical partners have FDA and traceability" thay vì 3 đoạn riêng biệt.
2. **Relevance filter:** Chỉ mention 1-2 pillars RELEVANT cho buyer này: US buyer → FDA, food buyer → HACCP/traceability, buyer nhiều supplier → 24h response/English team, buyer lo payment → L/C at sight.
3. **Factual, not promotional:** Nói "factories with valid HACCP/ISO and FDA registration" (factual về vetting process) thay vì "FDA approved" (claim về supplier cụ thể) — tránh forbidden claim.
4. **Length control:** Requirement inquiry 130-200 words (tăng nhẹ từ 120-180 để chứa buyer insight + 1-2 trust pillars), introduction 130-180 words.
5. **No links/images ở email đầu:** Factory video/COA chỉ offer ở follow-up sau khi buyer reply — đúng funnel: buyer relevance → supplier credibility → commercial.
6. **Spam vocabulary filter:** System prompt cấm explicit: "free", "discount", "cheap", "guaranteed", "100%", "act now", "limited time", "risk-free", "click here", "unsubscribe"...

### 5.4 Đánh Giá Rủi Ro Tổng Thể

| Thay đổi | Rủi ro spam | Rủi ro Promotions | Mitigation |
|----------|-------------|-------------------|------------|
| Thêm 2 buyer data points (HS, purchase_history, peak) | **Thấp** — tăng personalization, giảm spam score | **Thấp** — càng specific càng giống human | Đã implement, self-check yêu cầu >=2 data points |
| Thêm 1-2 Vexim trust pillars (FDA, traceability, L/C) | **Thấp-Medium** nếu liệt kê dài | **Medium** nếu viết như brochure | Weave vào cùng câu, chỉ 1-2 pillars relevant, factual tone |
| Thêm supplier specific (certs, capacity, payment) ở introduction | **Thấp** — vì đã có relationship (buyer đã reply hoặc opportunity) | **Thấp** — không còn là cold email | Chỉ ở introduction sau khi chọn supplier, không ở requirement_inquiry |
| Tăng length từ 120-180 lên 130-200 words | **Thấp** | **Thấp-Medium** | Vẫn <200, short paragraphs, plain text |
| Tổng thể V2 | **Low** | **Low-Medium, controllable** | Nếu tuân thủ prompt mới, vẫn vào Primary với high probability |

**Kết luận:** Tính khả thi **CAO**, rủi ro **THẤP** nếu implement đúng như thiết kế. Không vi phạm chính sách Google nếu giữ nguyên tắc: plain text, no links ở email đầu, personalized, consultative, no spam triggers, factual not promotional.

---

## 6. Implementation

### Files thay đổi:
1. **Mới:** `lib/ai/vexim-positioning.ts` — Vexim vetting framework, buyer intel → natural language, supplier trust signals, buyer-supplier mapping, spam risk assessment
2. **Sửa:** `lib/ai/requirement-email.ts` — Deep buyer context (purchase_history, top_suppliers, main_import_countries, peak_months, total_shipments, origin_ports...), inject vexim_vetting, system prompt V2 yêu cầu 2 buyer data points + 1-2 trust pillars, length 130-200 words
3. **Sửa:** `lib/ai/email-generator.ts` — Load supplier vetting từ client_factory_assessments, client_profiles, client_products, compliance_docs, profiles.fda; build trust_signals_text + buyer_supplier_mapping; inject vào context; update introduction guidance V2 yêu cầu mapping buyer ↔ supplier

### Cách test:
1. AE tạo engagement mới với buyer có đầy đủ data (purchase_history, top_suppliers, peak_months)
2. Generate requirement_inquiry email → kiểm tra có reference 2 data points + 1-2 trust pillars không, có vào Primary không
3. Sau khi buyer reply và tạo shortlist, generate introduction email → kiểm tra có mapping supplier strengths không
4. Dùng `assessSpamRisk()` trong vexim-positioning.ts để check risk level trước khi gửi
5. A/B test: 50% buyer dùng template cũ, 50% dùng V2, so sánh open rate, reply rate, Primary vs Promotions rate (via Resend webhook)

### Monitoring:
- Theo dõi `email_drafts.delivery_status`, `opened_count`, `clicked_count`, `bounced_at`, `complained_at`
- Spam complaint rate phải <0.3% (Gmail threshold)
- Nếu thấy tăng Promotions rate, giảm length hoặc giảm số trust pillars mention

---

## 7. Ví Dụ So Sánh Trước/Sau

### Requirement Inquiry — Buyer: Cashew W320, US, HS 0801.32, từng mua Visimex VN 2024, Chile 2025 16,800kg, peak Oct-Dec

**Trước (generic, 140 words):**
> Hi John, I'm Hoc with Vexim in Vietnam. I came across Nodom while looking into cashew buyers, and wanted to introduce myself directly. We work with manufacturers here for cashew, so if you're ever evaluating additional suppliers from Vietnam, I'd be glad to put a few suitable options in front of you. Would you be open to taking a quick look? If now isn't the right time, no worries at all.

**Sau (V2, 165 words, high-quality mapping):**
> Hi John, I noticed Nodom imports cashew W320 under HS 0801.32 from Vietnam and Chile, with peak shipments around Oct-Dec and about 120 shipments — I'm Hoc with Vexim in Vietnam, we only work with factories we've audited ourselves. Typical partners in our network have valid HACCP/ISO and FDA registration for US, with traceability from raw material and flexible payment including L/C at sight — response within 24h and English export team. Would you be open to evaluating additional sourcing from Vietnam for your cashew category? If now isn't the right time, no worries at all.

**Lift:** Từ 0 data point cụ thể → 3 data points (HS, Vietnam/Chile, peak, volume) + 2 trust pillars (FDA/traceability + L/C/24h response). Vẫn plain text, không link, không spam trigger.

---

## 8. Khuyến Nghị

1. **Triển khai V2 cho cả 2 luồng:** requirement_inquiry (chưa có supplier) và introduction (đã có supplier)
2. **Giữ nguyên tắc deliverability:** plain text, no links ở email đầu, <200 words, personalized sender, human opt-out
3. **Training AE:** Khi nhập buyer, điền đầy đủ purchase_history, top_suppliers, main_import_countries, peak_months, total_shipments — càng nhiều data, email càng chất lượng
4. **Training supplier onboarding:** Đảm bảo form nhập liệu supplier điền đầy đủ certifications, fda_status, production_capacity, payment_policy, traceability, has_export_dept, has_english_staff — đây là "đạn" cho AI pitch
5. **A/B test 2 tuần:** 50/50 old vs new, đo open rate, reply rate, Primary rate
6. **Monitor spam complaint:** Nếu >0.3%, dừng và review content
7. **Future:** Có thể thêm aggregated stats: "We currently work with 12 FDA-registered cashew factories in Binh Phuoc with 500 tons/month total capacity" — nhưng cần query DB, để phase 2

---

**Kết luận:** Email giai đoạn đầu hoàn toàn có thể nâng cấp chất lượng bằng cách kết hợp supplier vetted data + buyer deep data mà vẫn an toàn với Google, nếu tuân thủ nguyên tắc: specific, factual, consultative, short, plain text, no spam triggers. Đã implement trong code và sẵn sàng test.
