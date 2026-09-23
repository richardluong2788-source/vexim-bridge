# Thu thập hồ sơ & sản phẩm của client — trích xuất toàn bộ

Tài liệu này gom **toàn bộ nội dung liên quan đến việc thu thập hồ sơ năng lực và sản phẩm của client (nhà cung cấp)** đang nằm trong repo: luồng nghiệp vụ, từng trường dữ liệu, schema DB, RLS, server actions, UI, job định kỳ và các khoảng trống phát hiện được.

Đường dẫn tham chiếu đều tính từ gốc repo `vexim-bridge`. Trích tại nhánh `arena/01a0c990-vexim-bridge`, cập nhật 2026-09-23; mọi kết luận dưới đây lấy từ code/schema trong repo, không suy diễn từ tài liệu.

---

## 0. Bản đồ file

| Khu vực | File | Vai trò |
|---|---|---|
| Phát sinh link khảo sát | `app/admin/clients/new/actions.ts` (`createIntakeLink`, `createClientAccount`) | Tạo token single-use, hạn 14 ngày; cấp tài khoản client khi duyệt |
| Nút tạo link (UI) | `components/admin/intake-link-generator.tsx` | Tab "Gửi link cho khách hàng" ở `/admin/clients/new` |
| Trang nhập liệu công khai | `app/client-intake/[token]/page.tsx` | Đọc hồ sơ theo token qua RPC, không cần đăng nhập |
| Wizard 5 bước | `components/client-intake/client-intake-form.tsx` (1060 dòng) | Toàn bộ câu hỏi, validate, xem lại & gửi |
| Bước đánh giá nhà máy | `components/client-intake/factory-capability-step.tsx` | 10 mục (mục 6–15 của form nội bộ) |
| Trường ảnh | `components/client-intake/image-link-field.tsx` | Chỉ nhận **link ảnh công khai**, không upload |
| Submit công khai | `app/client-intake/[token]/actions.ts` | Validate + gọi RPC `submit_client_intake` |
| Hàng đợi duyệt | `app/admin/clients/intake/page.tsx`, `components/admin/intake-review-list.tsx` | "Hồ sơ chờ duyệt", lọc theo trạng thái |
| Màn duyệt chi tiết | `app/admin/clients/intake/[id]/page.tsx`, `components/admin/intake-review-detail.tsx` (829 dòng) | Sửa bổ sung, duyệt, từ chối |
| Logic duyệt | `app/admin/clients/intake/actions.ts` | `updateIntakeSubmission`, `approveIntakeSubmission`, `rejectIntakeSubmission` |
| Schema intake | `scripts/064_client_intake_submissions.sql`, `scripts/065_client_intake_factory_capability.sql` | Bảng + 2 RPC SECURITY DEFINER + RLS |
| RLS intake cho SR | `scripts/072_supplier_researcher_intake_rls.sql` | SR được insert/update intake |
| Tùy chọn đánh giá + chấm điểm | `lib/assessment/constants.ts`, `lib/assessment/scoring.ts`, `lib/assessment/actions.ts` | Option lists, điểm /100 → A/B/C/D, upsert |
| Bảng đánh giá | `scripts/046_factory_assessments.sql`, `scripts/058_factory_assessment_labor_env.sql` | `client_factory_assessments` |
| Danh mục sản phẩm | `app/admin/clients/products-actions.ts` | CRUD + tìm kiếm sản phẩm client |
| Dialog sản phẩm (admin) | `components/admin/admin-product-dialog.tsx` (~30 trường) | Form đầy đủ nhất |
| Quản lý sản phẩm (admin) | `components/admin/admin-client-products-manager.tsx` | Tab "Sản phẩm" trong `/admin/clients/[id]` |
| Cổng client tự nhập SP | `app/client/products/page.tsx`, `components/client/client-products-list.tsx`, `components/client/client-product-dialog.tsx` | Trang `/client/products` |
| Schema sản phẩm | `scripts/023_client_products_schema.sql`, `scripts/029_product_images_compliance.sql`, `scripts/028_product_categories.sql` | `client_products`, ảnh/badge, bảng danh mục |
| Danh mục (lookup) | `app/admin/clients/categories-actions.ts`, `components/admin/add-product-category-dialog.tsx` | Admin thêm/sửa category không cần deploy |
| Tùy chọn sản phẩm | `lib/constants/product-options.ts` | Đơn vị, tiền tệ, Incoterms, T/T, compliance badges |
| API sản phẩm | `app/api/admin/client-products/route.ts`, `app/api/products/search/route.ts`, `app/api/products/upload-images/route.ts` | Đọc SP theo clientId; tìm kiếm công khai; token upload ảnh |
| Chứng từ (hồ sơ giấy tờ) | `scripts/009_sprint_b_compliance_financials.sql`, `lib/blob/client-docs.ts`, `app/admin/clients/compliance-actions.ts`, `app/client/documents/*`, `components/admin/client-compliance-workspace.tsx`, `components/client/documents/client-documents-view.tsx` | Bảng `compliance_docs`, lưu Vercel Blob, chia sẻ token |
| Lịch sử & hết hạn chứng từ | `scripts/migration-compliance-doc-history.sql`, `scripts/048_fix_compliance_doc_history_fk.sql`, `app/api/documents/history/route.ts`, `app/api/cron/document-expiry-check/route.ts` | Audit trail + cảnh báo hết hạn |
| AI tư vấn hồ sơ | `lib/ai/document-advisor.ts`, `app/api/documents/analyze/route.ts`, `components/admin/document-advisor-section.tsx` | Gap analysis hồ sơ theo ngành/thị trường |
| Hồ sơ công khai | `scripts/038_client_profiles_schema.sql`, `scripts/041`, `scripts/059`, `scripts/060`, `lib/profile/actions.ts`, `components/admin/admin-profile-manager.tsx` | Trang `/profile/[slug]` cho buyer |
| Checklist năng lực | `lib/profile/capability-checklist.ts` | "Năng lực đã xác minh" trên profile |
| Email báo cho AE | `lib/notifications/intake-submitted-email.ts` | "Hồ sơ mới đã được gửi" |
| Dọn link hết hạn | `app/api/cron/client-intake-expiry/route.ts` | Xóa link `pending` quá hạn (batch 500) |
| Nav / badge | `components/admin/admin-sidebar.tsx` (dòng 89), `lib/nav/sidebar-badges.ts` (`pendingIntake`) | Mục "Hồ sơ chờ duyệt" + số đếm |
| SOP nội bộ | `app/admin/knowledge/sr/page.tsx` (S2, S3, S4, S5, S6, S7) | Hướng dẫn nghiệp vụ thu thập hồ sơ |
| Tài liệu Product Discovery | `PRODUCT_DISCOVERY_*.md`, `docs/PRODUCT_DISCOVERY_IMPLEMENTATION.md`, `README_PRODUCT_DISCOVERY.md` | Mô tả hệ thống sản phẩm |

---

## 1. Luồng A — Gửi link khảo sát để client tự điền hồ sơ

### 1.1 Tạo link (`app/admin/clients/new/actions.ts`)

- Hàm `createIntakeLink()` — quyền: `admin`, `staff`, `super_admin`, `account_executive`, `supplier_researcher`.
- Token: `randomBytes(24).toString("base64url")`; URL `${siteConfig.url}/client-intake/${token}`.
- Cột bắt buộc khi insert: `token`, `ae_id` (người sở hữu hồ sơ). Mặc định DB: `status='pending'`, `expires_at = now() + 14 days`.
- Ghi audit `activities.action_type = 'client_intake_link_created'` (chỉ lưu 8 ký tự đầu token).
- UI (`intake-link-generator.tsx`): nút "Tạo liên kết mới", hiển thị link + ngày hết hạn + "Chỉ dùng được một lần", nút "Tạo liên kết khác".

Nội dung mô tả trong UI (verbatim):
> "Tạo một liên kết riêng, dùng một lần cho khách hàng bạn đã liên hệ. Khách hàng điền thông tin đăng ký và hồ sơ năng lực — không cần tài khoản. Sau khi khách gửi, hồ sơ sẽ chờ bạn xét duyệt tại mục \"Hồ sơ chờ duyệt\"."

### 1.2 Phiếu khảo sát — 5 bước (`client-intake-form.tsx`)

```
0. Liên hệ & đăng ký          (User)
1. Giới thiệu doanh nghiệp     (Building2)
2. Năng lực & chứng nhận       (FileCheck2)
3. Đánh giá năng lực nhà máy   (ClipboardCheck)
4. Xem lại & gửi               (CheckCircle2)
```

Mô tả từng bước hiển thị cho client:
- Bước 0: "5 thông tin bắt buộc để nhân viên kinh doanh tạo tài khoản cho bạn."
- Bước 1: "Giúp buyer hiểu rõ hơn về doanh nghiệp của bạn."
- Bước 2: "Điểm mạnh, chứng nhận và hình ảnh nhà máy — có thể bổ sung sau."
- Bước 3: "10 mục đánh giá giúp Vexim hiểu rõ năng lực sản xuất, xuất khẩu và mức độ sẵn sàng hợp tác của nhà máy — có thể bổ sung sau."
- Bước 4: "Kiểm tra lại thông tin trước khi gửi."

### 1.3 Danh sách trường thu thập (đầy đủ)

**Bước 0 — Liên hệ & đăng ký**

| Nhãn UI | Field | Bắt buộc | Ghi chú |
|---|---|---|---|
| Tên doanh nghiệp | `company_name` | ✔ | placeholder "Công ty TNHH Xuất khẩu ABC" |
| Người liên hệ | `contact_name` | ✔ | |
| Số điện thoại | `phone` | ✔ | type tel |
| Email | `email` | ✔ | "Email này sẽ dùng để đăng nhập vào hệ thống Vexim Trade sau khi hồ sơ được duyệt." |
| Ngành nghề | `industries[]` | ✔ (≥1) | chọn nhiều; bấm ★ để đặt ngành chính (`promoteToPrimary`) |
| Quốc gia | `country` | | gợi ý từ `lib/constants/countries.ts` |
| Mã số thuế | `tax_code` | | |
| Địa chỉ | `address` | | |
| Website | `website` | | |

Ngành nghề lấy từ `lib/constants/industries.ts`: `Food & Beverage, Agriculture, Seafood, Cosmetics & Personal Care, Pharmaceuticals, Textiles & Garments, Footwear, Furniture & Home Decor, Machinery & Industrial Parts, Electronics & Components, Packaging & Printing, Chemicals & Raw Materials, Other`.

**Bước 1 — Giới thiệu doanh nghiệp (bao gồm thông tin sản phẩm dạng text)**

| Nhãn UI | Field | Ghi chú |
|---|---|---|
| Slogan | `tagline` | |
| Mô tả doanh nghiệp | `company_description` | textarea 4 dòng |
| **Sản phẩm / mã HS chính** | `main_products` | textarea; gợi ý: "Hạt điều rang muối (HS 2008.19), Cà phê rang xay (HS 0901.21)..." |
| **Công suất sản xuất** | `production_capacity` | "500 tấn/năm" |
| **MOQ (số lượng tối thiểu)** | `moq` | "1 container (20ft)" |
| **Thời gian giao hàng** | `lead_time_days` | "20-30 ngày" |

**Bước 2 — Năng lực & chứng nhận**

| Nhóm | Field | Chi tiết |
|---|---|---|
| USP (tối đa 4) | `usp_points[]` | mỗi USP = `{ icon, title }`; icon là từ khóa (VD "Experience") |
| Chứng nhận | `certifications[]` | `HACCP, GMP, ISO 22000, ISO 9001, FDA Registration, Organic (USDA/EU), Halal, Kosher, BRC, FSSC 22000` + `certifications_other` |
| Logo doanh nghiệp | `logo_url` | chỉ dán link; khuyến nghị 400×400, nền trong/trắng |
| Ảnh bìa | `cover_image_url` | 1600×900 (16:9) |
| Ảnh nhà máy / sản phẩm | `factory_image_urls[]` | tối đa 5, ≥1200×1200 |
| URL video nhà máy (YouTube) | `video_url` | không cho upload file ở intake |

**Bước 3 — Đánh giá năng lực nhà máy** (`factory-capability-step.tsx`, ánh xạ mục 6–15 của form nội bộ)

| # | Câu hỏi | Field |
|---|---|---|
| 1 | Hệ thống quản lý chất lượng & ATTP đang áp dụng | `quality_systems[]` (HACCP/GMP/ISO22000/SOP/QC/other) + `quality_systems_other` |
| 2 | Năng lực OEM/ODM + quy mô | `oem_odm[]` (OEM/ODM/Private Label/none), `company_scale` |
| 3 | Kinh nghiệm xuất khẩu | `export_since_year`, `export_markets[]` (US/EU/JP/KR/CN/ASEAN/ME/other), `export_markets_other` |
| 4 | Hệ thống truy xuất nguồn gốc | `traceability[]` (lot/input/finished/recall/batch-lot/none) |
| 5 | Đăng ký FDA | `fda_status` (valid/expired/none), `fda_number`, `fda_expires_at` |
| 6 | Nhân sự, giờ làm việc & rủi ro lao động/môi trường | `staff_engineers_count`, `staff_workers_count`, `work_hours_start/end`, `work_days_per_week`, `food_safety_training_regular`, `equipment_calibration_regular`, `water_source[]`, `water_source_other`, `water_testing`, `near_pollution_source`, `pollution_source_note` |
| 7 | Khả năng tiếp đón Buyer Audit | `audit_readiness[]` (onsite/online/not-ready), `audit_owner` |
| 8 | Năng lực thương mại | `incoterms[]` (EXW/FOB/CIF), `payment_policy`, `oem_policy`, `odm_policy` |
| 9 | Nhân sự phụ trách dự án | `has_export_dept`, `has_english_staff`, `pricing_decision_maker` |
| 10 | Cam kết triển khai dự án | `commitments[]` (priority/cooperation/accuracy), `project_priority` (Cao/Trung bình/Thấp) |

**Bước 4 — Xem lại**: 4 khối `ReviewSection` (Liên hệ & đăng ký / Giới thiệu doanh nghiệp / Năng lực & chứng nhận / Đánh giá năng lực nhà máy), nút "Gửi hồ sơ".

### 1.4 Ràng buộc khi gửi (`app/client-intake/[token]/actions.ts`)

- `ClientIntakePayload` = đúng danh sách trường ở trên.
- Validate phía server: token; email regex; `contact_name`; `company_name`; `phone`; `industries` phải thuộc `INDUSTRIES` (lọc rác) và ≥1 phần tử.
- Mọi chuỗi được `.trim()`, email lowercase, rỗng → `null`.
- Gửi qua RPC `submit_client_intake(p_token, p_payload)`; nếu RPC update 0 dòng → trả `link_expired` → UI báo "Liên kết đã hết hạn hoặc đã được gửi trước đó."
- Sau khi lưu thành công: `notifyAeOfIntakeSubmission(token)` (best-effort, không bao giờ làm fail submission).
- **Điểm chặn duy nhất trong wizard** (`components/client-intake/client-intake-form.tsx`):
  - `step1Valid` = `company_name` + `contact_name` + email khớp `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` + `phone` != `""` + `industries.length > 0` → **chỉ chặn ở bước 1** (`goNext()` return sớm nếu chưa đạt).
  - Nút "Gửi hồ sơ" ở bước 5 chỉ `disabled={isPending}` — **không có điều kiện bắt buộc nào khác**, không có checkbox đồng ý / cam kết dữ liệu.
  - Bước 2, 3, 4 không bắt buộc: bỏ trống toàn bộ năng lực, chứng chỉ, đánh giá rồi vẫn gửi được.
- Không giới hạn độ dài chuỗi, không sanitize HTML. Nút Back disabled ở bước 1.
- Trường ảnh dùng `components/ui/image-link-input.tsx`: chấp nhận **dán nhiều link** cách nhau space/comma/newline, Enter = thêm, tự `normalizeImageLink` (VD: link Google Drive → direct link), khử trùng với danh sách đang có, chặn vượt `max` (toast "Tối đa N ảnh"), yêu cầu `https://`. Logic parse ở `lib/utils/image-link.ts`.

Mã lỗi + thông dịch (`translateError`): `invalid_email`, `contact_name_required`, `company_required`, `phone_required`, `industry_invalid`, `link_expired`.

### 1.5 Bảng `client_intake_submissions` (064 + 065)

Nhóm cột:
- **Liên kết / sở hữu**: `token` (unique), `ae_id → profiles(id)`, `status ∈ (pending, submitted, approved, rejected)`, `expires_at` (mặc định +14 ngày).
- **Đăng ký (map → `profiles`)**: `contact_name, email, phone, company_name, industries[]`.
- **Doanh nghiệp (map → `profiles`)**: `country, address, website, tax_code`.
- **Hồ sơ năng lực (map → `client_profiles`)**: `tagline, company_description, main_products, production_capacity, moq, lead_time_days, usp_points jsonb, logo_url, cover_image_url, factory_image_urls[], video_url`.
- **Chứng nhận**: `certifications[], certifications_other`.
- **Đánh giá nhà máy (065)**: 34 cột, mirror 1:1 với `client_factory_assessments` (mục 6–15 của form).
- **Review metadata**: `reviewed_by, reviewed_at, review_notes, rejection_reason, created_client_id`, `submitted_at, created_at, updated_at`.
- Index: `token`, `ae_id`, `status`. Trigger `updated_at`.

**RLS**: anon không có quyền SELECT/UPDATE trực tiếp — mọi thứ đi qua 2 RPC `SECURITY DEFINER`:
- `get_intake_submission_by_token(p_token)` — chỉ trả về row khi `status='pending' AND expires_at > now()`, trả đúng danh sách field nhập liệu (không lộ metadata review).
- `submit_client_intake(p_token, p_payload)` — `UPDATE ... WHERE token = p_token AND status='pending' AND expires_at > now()`, set `status='submitted'`, `submitted_at=now()` → token dùng một lần.

Người dùng nội bộ: AE đọc/ghi hồ sơ của mình; `admin/staff/super_admin` đọc/ghi tất cả; SR được thêm ở 072 (insert own / update all).

### 1.6 Hàng đợi duyệt

- Sidebar: `/admin/clients/intake` — "Hồ sơ chờ duyệt", icon `FileCheck2`, cap `CLIENT_VIEW`, badge `pendingIntake` (`lib/nav/sidebar-badges.ts`).
- Query danh sách: `select id, status, company_name, contact_name, email, phone, industries, submitted_at, created_at, expires_at, ae_id, rejection_reason, profiles(ae)`, sort `submitted_at desc, created_at desc`; AE scope → `eq ae_id`; ẩn link `pending` quá hạn.
- Bộ lọc trạng thái: **Chờ duyệt** (mặc định) / Đã gửi link / Đã duyệt / Đã từ chối / Tất cả, kèm số đếm.

### 1.7 Màn duyệt chi tiết & tiến trình nghiệp vụ (`app/admin/clients/intake/actions.ts`)

Reviewer: `admin, staff, super_admin, account_executive, supplier_researcher` (`REVIEWER_ROLES`).

1. `updateIntakeSubmission(id, fields)` — cho phép nhân viên sửa/bổ sung ngay trên phiếu (không đổi status). AE chỉ sửa được hồ sơ của mình.
2. `approveIntakeSubmission(id, fields, reviewNotes?)`
   - Chặn duyệt lại: `already_approved` / `already_rejected`.
   - Lưu chỉnh sửa trước (`updateIntakeSubmission`).
   - **Cấp tài khoản**: `createClientAccount({ email, full_name, company_name, industries, phone, country, sourced_by })`
     → `admin.auth.admin.generateLink({type:"invite"})` (không dùng `inviteUserByEmail` để tránh email chung của Supabase vào spam), upsert `profiles` với `role='client'`, AE tạo thì tự gán `account_manager_id`, SR duyệt thì ghi `sourced_by`, gửi mail mời qua `sendClientInviteEmail`.
   - **Soi dữ liệu đánh giá** → `upsertAssessment(clientId, …)` vào `client_factory_assessments` + tự tính điểm (mục 2.2).
   - **Soi hồ sơ công khai** → upsert `client_profiles`: `slug` (diễn âm không dấu, cắt 90 ký tự, thêm hậu tố nếu trùng), `display_name, tagline, logo_url, cover_image_url, video_url, usp_points, production_capacity, moq, lead_time_days`, `is_published = false`.
   - Set `status='approved'`, `reviewed_by/at`, `review_notes`, `created_client_id`; audit `client_intake_approved`; `revalidatePath(/admin/clients/intake, /admin/clients)`.
   - Nếu là AE tạo client: chạy `rematchOpenSharedInboxLeads` để buyer ngành đó được ghép ngay.
3. `rejectIntakeSubmission(id, reason)` — chỉ `status='submitted'`, lưu `rejection_reason`, audit `client_intake_rejected`, **không đụng `profiles`**.

Thông báo sau khi duyệt (verbatim): "Đã tạo tài khoản khách hàng và chuyển dữ liệu vào Quản lý hồ sơ. Bạn còn có thể tiếp tục chỉnh sửa hồ sơ công khai tại trang Khách hàng."

### 1.8 Email & cron

- Email cho AE (`lib/notifications/intake-submitted-email.ts`): subject `Hồ sơ mới đã được gửi — {company}`; thân: greeting theo tên AE, dòng "… vừa hoàn tất và gửi hồ sơ đăng ký qua link intake của bạn trên {site}", Người liên hệ / Email / Điện thoại, nút "Xem & duyệt hồ sơ" → `/admin/clients/intake/{id}`; footer ghi rõ gửi vì bạn là AE phụ trách link.
- Cron `GET /api/cron/client-intake-expiry` (Bearer `CRON_SECRET`, schedule `0 6 * * *` trong `vercel.json`): xóa `status='pending' AND expires_at <= now()`, batch 500, trả `{ ok, deleted }`.

---

## 2. Khung chấm điểm & bảng đánh giá

### 2.1 `client_factory_assessments` (046 + 058)
Một row mỗi client (`unique_client_assessment`), các cột giống hệt nhóm mục 6–15, cộng: `score_total`, `score_grade`, `score_breakdown jsonb`, `scored_at`, `created_by/updated_by/created_at/updated_at`.
RLS: internal (`admin/super_admin/staff/account_executive`) đọc/ghi tất cả; client chỉ ĐỌC hồ sơ của mình. (SR được mở ở 069/073.)

### 2.2 Cách tính điểm (`lib/assessment/scoring.ts`)
Tổng raw max = 110, chuẩn hóa về /100; grade: **A ≥80** (Xuất sắc — sẵn sàng ký), **B 60–79**, **C 40–59**, **D <40**.

| Hạng mục | Điểm tối đa | Cách cộng |
|---|---|---|
| Chứng nhận / QLCL | 20 | HACCP 6, GMP 6, ISO22000 6, SOP 2, QC 2 |
| Kinh nghiệm xuất khẩu | 15 | có `export_since_year` 5; US 10 (nếu không có US: EU/JP 5) |
| Đăng ký FDA | 10 | có số ĐK: còn hạn 10, hết hạn 4 |
| Truy xuất nguồn gốc | 10 | 2 điểm/mục (khác `none`), trần 10 |
| Sẵn sàng Buyer Audit | 10 | onsite 6, online 4 |
| Năng lực thương mại | 10 | 2/incoterm (trần 6) + có `payment_policy` 4 |
| Nhân sự xuất khẩu | 10 | `has_export_dept` 5 + `has_english_staff` 5 |
| OEM/ODM | 5 | có mục ≠ `none` |
| Quy mô DN | 5 | `company_scale` không rỗng |
| Cam kết triển khai | 5 | ≥3 cam kết 3; `project_priority=high` 2 |
| Lao động & môi trường | 10 | giờ ≤8.5h: 2; ≤6 ngày/tuần: 1; đào tạo ATTP: 2; kiểm định máy: 2; nước máy/RO: 1; test nước: 1; không gần nguồn ô nhiễm: 1 |

Ba nhóm đầu/cuối được ghi chú trong SOP SR: "Điền theo bằng chứng, không phỏng đoán"; mỗi lần lưu cập nhật `scored_at` + `updated_by`.

---

## 3. Thu thập **sản phẩm** của client (danh mục có cấu trúc)

### 3.1 Hai tầng dữ liệu
1. **Tầng intake** (tự do): `main_products` (text), `production_capacity`, `moq`, `lead_time_days` — chỉ được soi một phần sang `client_profiles`; **không** tự sinh row `client_products`.
2. **Tầng danh mục**: bảng `client_products`, mỗi SKU một row — nhập bởi admin (tab Sản phẩm) hoặc client tự nhập ở `/client/products`.

### 3.2 Schema `client_products`

Từ 023: `id, client_id → profiles(id) ON DELETE CASCADE, product_name, product_code, category, subcategory, description, hs_code, unit_of_measure='kg', min_unit_price, max_unit_price, currency='USD', monthly_capacity_units, status ∈ (active|inactive|suspended), created_by, created_at, updated_at`, `UNIQUE(client_id, product_code)`; index: client_id, category, subcategory, status, (category,status).
029: `image_urls TEXT[]`, `compliance_badges TEXT[]`.
Code còn dùng các trường mở rộng **không có file migration trong repo** (xem §7): `country_of_origin, key_specifications, usp, moq_value, moq_unit, lead_time, sample_available, sample_notes, price_unit, incoterm, incoterm_place, payment_terms, packing, package_size, shelf_life, storage_conditions, private_label_available, private_label_notes`.

RLS: admin/staff/super_admin ALL; client tự quản row của mình; `status='active'` đọc được công khai. Trigger `updated_at`.

### 3.3 Danh mục sản phẩm — `product_categories` (028)
`value` (token lưu vào `client_products.category`), `label_vi`, `label_en`, `display_order`, `is_active`, `created_by`. Seed 10 nhóm: Coffee, Cocoa, Pepper, Cashew, Spices, Nuts, Dried Fruits, Grains, Oils, Other. Đọc: mọi user đã đăng nhập; ghi: admin/super_admin/staff (`listProductCategoriesAction` / `addProductCategoryAction`).

### 3.4 Bộ option chuẩn (`lib/constants/product-options.ts`) — source of truth cho **cả hai** dialog
- `PRODUCT_UNITS`: kg, tấn, lít, thùng, bao, cái
- `PRODUCT_CURRENCIES`: USD, EUR, VND, CNY, SGD, MYR
- `INCOTERMS`: EXW, FOB, CIF, CFR, FCA, DAP, DDP
- `PAYMENT_TERMS_OPTIONS`: T/T 30–70, T/T 100% trả trước, L/C at sight, L/C usance, D/P, Net 30, Net 60
- `COMPLIANCE_BADGES`: fda, coa, organic, fsvp, halal, kosher, brcgs, haccp

### 3.5 Trường thu thập trong dialog admin (`admin-product-dialog.tsx`) — nhãn tiếng Việt

| Nhóm | Trường (label UI) |
|---|---|
| Định danh | Tên sản phẩm *, Mã sản phẩm, Danh mục *, Danh mục phụ, Mô tả (Markdown) |
| Xuất xứ & spec | Quốc gia xuất xứ, Thông số kỹ thuật chính, Điểm bán hàng nổi bật (USP) |
| Năng lực & giá | Năng lực/tháng, Đơn vị, Tiền tệ, Giá tối thiểu, Giá tối đa, Giá tính theo |
| Thương mại | Incoterm, Cảng/Địa điểm giao hàng, Điều khoản thanh toán |
| Đơn hàng | MOQ (giá trị + đơn vị), Thời gian giao hàng, Có hàng mẫu + Chi tiết hàng mẫu |
| Đóng gói | Quy cách đóng gói, Kích thước đóng gói, Hạn sử dụng, Điều kiện bảo quản |
| Nhãn riêng | Hỗ trợ gia công nhãn riêng (Private Label/OEM) + Chi tiết |
| Khác | Mã HS, Trạng thái, **Chứng nhận & Tuân thủ** (badge), **Ảnh sản phẩm** (dán link công khai hoặc tải file 10MB/ảnh; lời hẹn trong UI "tối đa 10 ảnh", nhưng bộ chọn file chỉ giữ 5 ảnh tải lên mỗi lần — `slice(0, 5)`, dòng 191); ô chọn file tự ẩn khi đã có ảnh |
| Nội dung | `description` nhập bằng `MarkdownTextarea` |

Dialog phía client (`client-product-dialog.tsx`) là **bản rút gọn**: tên, mã, danh mục/phụ (hard-code coffee/cocoa/…), mô tả, HS, xuất xứ, key specs, giá min/max + currency + đơn vị, năng lực/tháng, MOQ, lead time, incoterm, payment terms, compliance badges, trạng thái — và **không có** USP/packing/shelf-life/private label/ảnh.

### 3.6 Server actions (`app/admin/clients/products-actions.ts`)

- `addClientProductAction(clientId, data)` / `updateClientProductAction(productId, data)` / `deleteClientProductAction(productId)` / `listClientProductsAction(clientId, filters)` / `searchClientProductsAction(filters)` (admin,分页 limit/offset, mặc định chỉ `active`, join `profiles`).
- `assertProductWriteAccess`: client tự ghi SP của mình; staff cần `CAPS.CLIENT_WRITE` **và** phải thuộc phạm vi sở hữu (`ownershipScopeFor` + `assertClientOwned`) — AE **không còn** `OWNERSHIP_BYPASS` (thay đổi `a40cd05`).
- `listClientProductsAction` dùng `CAPS.CLIENT_VIEW` + ownership tương tự.
- Audit mỗi thao tác: `activities.action_type ∈ client_product_added | client_product_updated | client_product_deleted`.
- Tìm kiếm tự do: `product_name / product_code / description ilike`.

### 3.7 API & upload

- `GET /api/admin/client-products?clientId=…` → `id, product_name, category, status` của SP `active` (cần đăng nhập).
- `GET /api/products/search` → browse công khai, filter `category, subcategory, min_capacity, min_price, max_price, search`, phân trang `limit/offset`, chỉ `active`, kèm `profiles(id, company_name, email, fda_registration_number, industry, industries)`.
- `POST /api/products/upload-images` → token upload Vercel Blob trực tiếp: ≤10MB, ≤10 file, `image/jpeg|png|webp|gif`, tiền tố `product-images/`.

### 3.8 Dữ liệu sản phẩm được dùng ở đâu

| Nơi dùng | Chi tiết |
|---|---|
| `ae_client_products` view (035, sửa ở 047) | gom `product_categories`, `product_subcategories`, `product_hs_codes` + `client_country` cho scorer AE↔buyer |
| `lib/matching/client-scorer.ts` + `client-types.ts` (`ClientProductInput`) | HS match; token overlap `category/subcategory/product_name`; spec/description; capacity+MOQ; compliance badges; `country_of_origin`/`incoterm`; commercial flags (price, incoterm, payment_terms, lead_time) |
| `lib/ai/email-generator.ts` | nạp 5 SP active (`product_name, hs_code, compliance_badges, moq_value, lead_time, category`) + `compliance_docs` + FDA từ `profiles` để cá nhân hóa email chào hàng |
| `lib/ai/embeddings.ts` (042, cron `sync-embeddings` 03:00 UTC) | embedding `product_embeddings` cho SP client — **đang select cột không tồn tại** (xem §7) |
| `lib/profile/actions.ts` (`featured_products`, tối đa 6) | sản phẩm nổi bật trên hồ sơ công khai |
| `app/products/`, `app/product/[id]/` + `components/product/*` | trang sản phẩm công khai + dialog "Request Quote" → `lib/product/actions.ts: submitProductQuoteRequest` tạo lead, chạy matching pipeline, notify AE/admin, gửi mail xác nhận buyer, mã tham chiếu `PQR-…` |
| `components/admin/product-link-picker.tsx` | AE chọn 1 SP trong email composer để lấy **link theo dõi** (`?ref=<opportunityId>`) gửi cho buyer; buyer bấm vào link thì yêu cầu báo giá gắn ngược về thương vụ |
| `opportunities.client_product_id`, `deals.product_id` (024) | gắn SP cụ thể vào thương vụ; view `client_opportunities_with_products` |
| `scripts/052` shortlist snapshots | khi gửi shortlist cho buyer, hệ thống **chụp bất biến** dữ liệu hồ sơ/sản phẩm tại thời điểm gửi |

### 3.9 SOP nội bộ về thu thập sản phẩm (`app/admin/knowledge/sr/page.tsx` §S5)
> "Sản phẩm là dữ liệu AI dùng nhiều nhất để ghép với nhu cầu buyer." Mỗi sản phẩm cần: Tên sản phẩm · Danh mục (phân cấp ngành hàng) · Mã HS · Sản lượng/tháng · Đơn hàng tối thiểu (MOQ) · Khoảng giá · Đơn vị tính & cách đóng gói · Xuất xứ / ghi chú chất lượng.
> 3 nguyên tắc: chỉ nhập SP NCC giao được thật; chuẩn hóa tên & mã HS theo danh mục hệ thống; kèm ảnh sản phẩm/nhà máy đúng quy định.

---

## 4. Thu thập **chứng từ** (hồ sơ giấy tờ) — `compliance_docs`

- Schema (009): `owner_id → profiles`, `kind ∈ fda_certificate | coa | price_floor | factory_video | factory_photo | other`, `title, url, mime_type, size_bytes, issued_at, expires_at, notes, uploaded_by`. RLS: admin/staff/super_admin/account_executive quản lý; client đọc của mình.
- Lưu trữ (`lib/blob/client-docs.ts`): path `clients/{ownerId}/{kind}/{timestamp}-{safeName}`, `MAX_FILE_MB = 100`, MIME cho phép `pdf, png, jpeg, webp, video/mp4, video/quicktime, video/webm`; hàm `validateComplianceFile`, `safeFilename`, `deleteComplianceDocByUrl`.
- Nendo dung (`app/api/clients/upload-token/route.ts`): browser upload thẳng lên Blob, cap `CLIENT_COMPLIANCE_WRITE`.
- Actions phía client: `app/client/documents/actions.ts` — `uploadClientComplianceDocAction(formData: kind, title, issuedAt, expiresAt, notes, file)`, `deleteClientComplianceDocAction`, `updateClientComplianceDocAction`; UI `components/client/documents/client-documents-view.tsx` (nhãn tiếng Việt: Giấy đăng ký FDA / Giấy phân tích (COA) / Bảng giá sàn / Video nhà máy / Ảnh nhà máy / Hồ sơ khác; trạng thái Còn hạn (n ngày) / Sắp hết hạn / Hết hạn).
- Actions phía admin: `app/admin/clients/compliance-actions.ts` — finalize upload, sửa/xóa, `createShareLinkAction`, `createBundleShareLinkAction`, `resendShareLinkEmailAction`, `revokeShareLinkAction`; link token mặc định **30 ngày**, chỉ 6 kind trên được chia sẻ (`TOKEN_SHAREABLE_KINDS`, đồng bộ `PUBLICLY_SHAREABLE_KINDS` ở `app/api/files/route.ts` và `SHAREABLE_KINDS` ở `client-compliance-workspace.tsx`).
- Lịch sử: `compliance_doc_history` (`created|updated|deleted|expired|renewed` + `changes/old_values/new_values`), đọc qua `GET /api/documents/history?docId=`, sheet `components/client/documents/document-history-sheet.tsx`.
- Cron `document-expiry-check`: ngưỡng cảnh báo 30 ngày, khẩn cấp 7 ngày, nhắc lại mỗi 7 ngày; bảng tên 16 loại hồ sơ (thêm phytosanitary, health cert, C/O, IUU, BRC/IFS, fumigation, GlobalGAP, OEKO-TEX, GOTS, FSC, CE…).
- AI advisor (`lib/ai/document-advisor.ts` + `POST /api/documents/analyze`): suy ra hồ sơ **cần** thu thập theo ngành + thị trường đích (COA, HACCP, FDA, organic, health_certificate, oeko_tex, gots, fsc, carb_cert, factory_audit, product_photos, test_report…), so với `compliance_docs` hiện có → gap analysis `valid | expiring_soon | expired | no_expiry`.
- FDA trên hồ sơ khách hàng: `profiles.fda_registration_number / fda_registered_at / fda_expires_at / fda_status` (`valid|expired|expiring_soon|pending_supplement|missing`, 081 cho phép trạng thái "Đang bổ sung" vẫn đủ điều kiện ghép); sửa qua `components/admin/fda-edit-dialog.tsx` + `updateFdaRegistration` (`app/admin/clients/actions.ts`); logic chung `lib/fda/status.ts` (`FDA_WARNING_DAYS = 90`).

---

## 5. Hồ sơ công khai của client — `client_profiles`

- Bảng (038 + 041 + 059 + 060): `client_id` (unique), `slug` (unique, VARCHAR100), `cover_image_url, logo_url, factory_image_urls[]`, `display_name, tagline, description`, `video_url, video_thumbnail_url`, `usp_points jsonb`, `production_capacity, moq, lead_time_days`, `featured_certifications uuid[]`, `featured_products uuid[]`, `enable_request_quote, enable_download_pdf, pdf_capability_url`, `is_published, published_at, view_count`, `created_by/updated_by/created_at/updated_at`.
- Actions (`lib/profile/actions.ts`): `getProfileBySlug` (chỉ `is_published=true`, tăng `view_count`), `getProfileByClientId`, `getProfileWithRelationsByClientId`, `createClientProfile`, `updateClientProfile`, `publishProfile`, `unpublishProfile`, `checkSlugAvailability`, `submitQuoteRequest`.
- Quyền nội bộ: `admin, super_admin, staff, account_executive, supplier_researcher`; AE/SR bị ràng buộc ownership (`ownershipScopeFor`) ở trang `/admin/clients/[id]/profile`.
- UI quản lý: `components/admin/admin-client-profile-tab.tsx` (trạng thái Published/Draft, link preview, nút xuất bản) + `components/admin/admin-profile-manager.tsx` (branding, USP icon picker 10 icon, production stats, chọn ≤6 featured products, chọn featured certifications, CTA toggles).
- Trang công khai: `app/profile/[slug]/page.tsx` + `components/profile/profile-*.tsx` (hero, header, description, media gallery, certifications, products, CTA).
- `lib/profile/capability-checklist.ts`: dựng checklist "Năng lực đã xác minh" từ `quality_systems`, `traceability`, 3 tín hiệu an toàn (đào tạo ATTP, kiểm định máy, kiểm định nước) — chỉ đưa tin hiệu an toàn, không điểm số.
- SOP S7: "Ba lớp hồ sơ phải đồng bộ" — đánh giá nhà máy, danh mục sản phẩm, hồ sơ công khai; chọn 2–4 chứng chỉ mạnh nhất; cập nhật khi NCC tăng công suất/đổi chứng chỉ/thêm thị trường (shortlist đã gửi giữ nguyên bản chụp).

---

## 6. Ma trận quyền theo vai trò

| Hành vi | admin / super_admin / staff | account_executive | supplier_researcher | lead_researcher | client |
|---|---|---|---|---|---|
| Tạo link khảo sát | ✔ | ✔ (own) | ✔ (own) | ✖ | ✖ |
| Xem hàng đợi intake | tất cả | chỉ của mình | tất cả | ✖ | ✖ |
| Duyệt / từ chối | ✔ | hồ sơ của mình | ✔ | ✖ | ✖ |
| Nhập/sửa sản phẩm client | ✔ | phải là khách của mình | phải là khách của mình (view) | ✖ | tự quản SP của mình |
| Quản lý danh mục SP | ✔ | ✖ | ✖ | ✖ | ✖ |
| Tải/xóa chứng từ | ✔ | ✔ | theo cap SR (073) | ✖ | tự tải lên (view + upload) |
| Tạo link chia sẻ | ✔ | ✔ | ✔ | ✖ | ✖ |
| Xuất bản hồ sơ công khai | ✔ | ownership | ownership | ✖ | ✖ |

---

## 7. Khoảng trống / điểm cần lưu ý (phát hiện khi đọc code)

1. **Sản phẩm không tự sinh từ intake.** `main_products` (text tự do) không bao giờ được tách thành row `client_products`; AI matching chỉ dùng `client_products` → NCC mới duyệt vẫn "mỏng" cho tới khi nhập tay. (`approveIntakeSubmission` không insert `client_products`.)
2. **Nhiều trường intake bị rơi khi duyệt.** Không được mirror sang bất kỳ bảng chính nào: `company_description`, `factory_image_urls` (hai cột này **có tồn tại** trong `client_profiles` — `description` do 041, `factory_image_urls` do 060 — nhưng upsert trong `approveIntakeSubmission` không set), và `address`, `website`, `tax_code`, `main_products`, `certifications[]`, `certifications_other` (bảng đích không có cột nào). Chỉ `profiles` nhận `industries` + `country` (+ `phone`, `full_name`, `company_name`, `email`).
2b. **Không có ô nhập "About Us" ở màn quản lý hồ sơ.** `lib/profile/types.ts` (`CreateClientProfileInput`) và `client_profiles.description` (041) đều hỗ trợ `description`, `components/profile/profile-description.tsx` render nó thành khối "About Us" trên trang công khai — nhưng `components/admin/admin-profile-manager.tsx` **không có field `description` nào** và payload `handleSave` không gửi nó → chỉ còn cách điền qua intake (bị rơi, xem 2) hoặc UPDATE trực tiếp DB.
2c. **`main_products` khai ở intake không ảnh hưởng điểm ghép đôi.** `lib/matching/scorer.ts` chỉ đọc view `ae_client_products` (`product_categories`, `product_subcategories`, `product_hs_codes`, `client_country`) và `profiles.industries`; text tự khai vì vậy không đi vào AI → NCC vừa duyệt gần như chắc chắn score thấp cho tới khi admin nhập `client_products` thủ công.
3. **FDA thu ở intake không đổ về `profiles` (lệch 1 bước code).** Form intake có `fda_status / fda_number / fda_expires_at` và
`createClientAccount` **hỗ trợ đủ 3 field đó** (`CreateClientAccountInput`, kèm chuẩn hóa `pending|dang_bo_sung`
→ `fda_status='pending_supplement'` + `fda_registration_number='PENDING'`), nhưng `createInput` trong
`approveIntakeSubmission` chỉ gửi `email, full_name, company_name, industries, phone, country, sourced_by` →
profile mới nhận `fda_status` mặc định `'missing'`, `fda_registration_number = NULL`.
Hậu quả dây chuyền:
- `computeScore(a, fda)` đọc FDA từ **`profiles`** (không đọc intake) → 10 điểm "Đăng ký FDA" luôn = 0, grade tụt 1 bậc, dù khách khai đã có số còn hạn.
- Trigger `enforce_fda_for_opportunity()` (014 → **081**, `BEFORE INSERT/UPDATE` trên `opportunities`) chặn
  `FDA_REQUIRED` ở mọi stage sau `new`/`contacted` → NCC vừa duyệt **không thể đẩy thương vụ sang `sample_requested` trở đi** (trigger chỉ miễn 2 stage `new`/`contacted`)
  cho tới khi admin nhập số FDA thủ công ở `components/admin/fda-edit-dialog.tsx`.
- Cách sửa gọn: map `fda_status/fda_number/fda_expires_at` từ `fields` vào `createInput` khi duyệt.

4. **Các cột mở rộng của `client_products` không có file migration trong `scripts/`** (`key_specifications`, `moq_value`, `packing`, `private_label_*`, …) — code + `lib/supabase/types.ts` dùng nhưng repo không có nguồn định nghĩa → không tái tạo được DB từ `scripts/`.
5. **Cổng client tự khai sản phẩm là route mồ côi và hỏng.** `docs/LUONG_VAN_HANH.md` đã ghi nhận: `/client/products` (và `/client/requests`) vẫn tồn tại nhưng **không được link từ `components/client/client-sidebar.tsx`**; mọi tài liệu `PRODUCT_DISCOVERY_*` vẫn mô tả đây là luồng chính. Thêm vào đó `components/client/client-products-list.tsx` gọi `handleOpenDialog()` và render `<Button>` / `<Plus>` trong khi **cả ba không được import/định nghĩa** → trang crash ngay ở trạng thái "chưa có sản phẩm". `components/client/client-product-dialog.tsx` (form tự nhập 494 dòng) **không được import ở bất kỳ đâu**. Thực tế: chỉ admin/AE/SR nhập được sản phẩm (actions + RLS vẫn cho client tự ghi, nhưng không có UI).
6. **Sync embeddings sản phẩm không xác minh được từ repo (nghi lỗi).** `lib/ai/embeddings.ts:syncClientProductEmbeddings` select `id, category, subcategory, notes, hs_codes` từ `client_products`. Hai cột `notes`/`hs_codes` **không xuất hiện ở bất kỳ migration nào trong `scripts/`** (bảng chỉ được khai báo `description` + `hs_code` ở 023), và `client_products` cũng không có trong `Database` type của `lib/supabase/types.ts` → PostgREST sẽ trả "column ... does not exist" nếu DB thật không có 2 cột này, `product_embeddings` không được làm mới và cron `sync-embeddings` (`0 3 * * *`) chỉ đếm `clientsFailed`. **Cần đối chiếu schema live trên Supabase** trước khi kết luận — cùng lý do: nhiều cột đang dùng thật (`moq_value`, `key_specifications`, …) cũng không có migration trong repo.
7. **Intake chỉ nhận link ảnh, không upload file** (khác với admin dialog cho phép upload ≤10MB và video 100MB ở `compliance_docs`) → hồ sơ ban đầu thường thiếu ảnh; SOP SR nói rõ "nhân viên sẽ xin ảnh sau".
8. **Link intake quá hạn chỉ bị ẩn** trên UI hàng đợi, row còn lại tới khi cron chạy (`/api/cron/client-intake-expiry`), và không có giới hạn số link/ngày cho mỗi AE.
9. **Tài liệu `PRODUCT_DISCOVERY_*.md` đã lệch code**: mô tả URL `/admin/products` + `product-search-widget.tsx` (không còn trong repo — quản lý SP nay nằm ở tab Sản phẩm của `/admin/clients/[id]`), và mô tả client tự thêm SP qua `/client/products` (xem mục 5).
10. **Type DB không theo kịp schema thật.** `client_products` và các cột mở rộng của nó **không có trong `Database["public"]["Tables"]`** của `lib/supabase/types.ts` (chỉ có hand-written type `ClientProduct` ở dòng ~2121); `client_profiles.Row` trong type sinh tự động **không liệt kê `description`** dù cột tồn tại (041) và `ClientProfile` viết tay thì có. Hệ quả: các query select cột sai (mục 6) không bị TS bắt được.
11. **`product_categories` vs danh mục hard-code.** Admin dialog đọc bảng `product_categories` với `value` in hoa (`Coffee`, `Cocoa`, `Dried Fruits`, …), còn dialog client chết `client-product-dialog.tsx` hard-code `CATEGORIES` **chữ thường** (`coffee`, `cocoa`, `fruits`, `vegetables`, `grains`, `other`) — tập giá trị lệch nhau (`fruits`/`vegetables` không có trong bảng). Nếu bật lại luồng tự khai cho client, `category` sẽ không khớp bộ lọc/search và không khớp `product_categories` mà `searchClientProductsAction` dùng.
12. **`client_intake_submissions` và `client_products` không có quan hệ ngoạikey nào.** Không có cột `submission_id` trên `client_products`, nên sau khi duyệt không truy vết được sản phẩm nào do intake sinh ra (và intake cũng không sinh row nào).
