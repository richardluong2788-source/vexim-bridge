# Phương án xử lý các khoảng trống thu thập hồ sơ & sản phẩm client

Kèm theo `docs/CLIENT_INTAKE_PRODUCTS.md` (bản trích xuất hiện trạng). Tài liệu này chỉ bàn **cách sửa**, sắp xếp theo tỷ lệ giá trị / rủi ro.

**Bối cảnh thi công:** sandbox không có `node_modules` và không có `.env` → tôi không chạy được `next build`/`pnpm lint` và **không đối chiếu được schema live trên Supabase**. Vì vậy mọi thứ chia làm 2 loại: (A) sửa code an toàn không cần đụng DB; (B) cần chạy SQL/verify schema trước. Tôi có thể code cả hai, nhưng phần (B) phải do bạn apply migration (hoặc cho tôi `POSTGRES_URL`/`NEXT_PUBLIC_SUPABASE_URL` + service key trong env để tôi tự kiểm tra).

---

## P0 — Nối lại đúng đường data đang bị đứt (không cần migration, ~0,5 ngày, 1 PR)

| # | File | Thay đổi | Vì sao |
|---|---|---|---|
| 1 | `app/admin/clients/intake/actions.ts` | Trong `approveIntakeSubmission`, thêm FDA vào `createInput`: `fda_registration_number: fields.fda_number ?? null`, `fda_expires_at: fields.fda_expires_at ?? null`. `createClientAccount` tự suy ra `fda_status` (`'missing'` khi không có số, `'pending_supplement'` khi số là `PENDING`/`đang bổ sung`) nên **không cần** map thủ công; khi khách khai `fda_status='none'` thì profile nhận `'missing'` — đúng nghiệp vụ. | `createClientAccount` **đã hỗ trợ đủ 3 field FDA** (`CreateClientInput`, kèm chuẩn hóa `pending/đang bổ sung → 'pending_supplement' + 'PENDING'`) nhưng chỗ gọi không truyền → mất 10 điểm score và trigger `enforce_fda_for_opportunity()` chặn `FDA_REQUIRED` ở mọi stage sau `new`/`contacted` (danh sách 10 stage của 002: `sample_requested`, `sample_sent`, `negotiation`, `price_agreed`, `production`, `shipped`, `won`, `lost`). Sửa = 2 dòng. |
| 2 | `app/admin/clients/intake/actions.ts` | Cùng chỗ: thêm `description: fields.company_description`, `factory_image_urls: fields.factory_image_urls ?? []` vào upsert `client_profiles` (chỉ set khi có dữ liệu, để không ghi đè khi duyệt lại). | Hai cột **đã tồn tại** (`description` — 041, `factory_image_urls` — 060) và **đã được render** (`components/profile/profile-description.tsx`, `profile-media-gallery.tsx`) nhưng không ai ghi → khối "About Us" và thư viện ảnh nhà máy vĩnh viễn trống. |
| 3 | `components/admin/admin-profile-manager.tsx` | Thêm textarea "Giới thiệu / About Us" bound vào `description`, đưa vào `data` của `handleSave`. | `CreateClientProfileInput`/`UpdateClientProfileInput` đã có `description?`; thiếu đúng một ô nhập → hiện muốn sửa phải UPDATE DB tay (`updateClientProfile` spread `...input` nên chỉ cần thêm field trong payload là ăn, không phải sửa actions). |
| 4 | `components/client/client-products-list.tsx` | Bỏ `action={<Button…Add Product>}` ở empty state (hoặc render nó sau khi wire dialog — xem P1-5), đổi mô tả thành "Danh mục do chuyên viên Vexim cập nhật — cần thay đổi gì bạn gửi yêu cầu ở mục *SLA & Yêu cầu*" (`/client/sla`, mục duy nhất trên sidebar client nhận yêu cầu). | `Button`, `Plus`, `handleOpenDialog` **không được import/định nghĩa** → `/client/products` `ReferenceError` ngay khi client chưa có sản phẩm. `next.config.mjs` bật `typescript.ignoreBuildErrors: true` nên build không catches. |
| 5 | `lib/ai/embeddings.ts` (dòng ~99) | `select("id, category, subcategory, notes, hs_codes")` → `"id, category, subcategory, description, hs_code"`. | `notes`/`hs_codes` không xuất hiện trong bất kỳ migration nào của `client_products` (`hs_code` số ít + `description` mới là cột của 023), và `client_products` cũng không có trong `Database` type nên TS không bắt được. Nếu DB live thật không có 2 cột đó thì mỗi lần `sync-embeddings` chạy là một lần PostgREST báo lỗi và `product_embeddings` đứng yên. Chọn `description`/`hs_code` là an toàn cả hai chiều: 2 cột đó chắc chắn tồn tại. |
| 6 | `app/admin/clients/new/actions.ts` | Trong `createClientAccount`, thêm nhánh: nếu `fda_expires_at` đã qua hoặc `input.fda_status === "expired"` → ghi `fda_status = "expired"` (hiện mọi số FDA có number đều bị ghi `'valid'`). | `fdaStatusValue = isPending ? "pending_supplement" : rawFdaNumber ? "valid" : "missing"` → số FDA đã hết hạn vẫn bị lưu `'valid'`. Thiệt hại thực tế nhỏ (UI/badge đọc `lib/fda/status.ts` và tự tính lại từ `fda_expires_at`, trigger 081 cũng so ngày), nhưng cột `profiles.fda_status` được **chính trigger 081 dùng** để cho/bỏ qua (`fda_status='pending_supplement'`) → giá trị lưu phải đáng tin. Sửa ~6 dòng, không đổi hành vi client hiện hữu. |
| 6b | `app/client/products/*`, `app/client/requests/*` | (tùy chọn, cùng PR — phụ thuộc quyết định P2-1) chốt luôn số phận 2 route mồ côi | `/client/documents` **có** trên sidebar client (`components/client/client-sidebar.tsx` dòng 40), còn `products`/`requests` thì không → route vẫn build, vẫn đi được bằng URL, nhưng người dùng không thấy. Nên chốt một lần thay để lưng chừng. |
| 7 | `app/admin/clients/intake/[id]/page.tsx` + `intake-review-detail.tsx` | Cảnh báo ngay cạnh nút Duyệt: nếu `fda_status ∈ {none, expired}` → dòng chữ "Client chưa có FDA còn hạn — thương vụ sẽ không đẩy qua `sample_requested` được tới khi bổ sung", kèm checkbox `Đánh dấu "Đang bổ sung hồ sơ FDA"` → `approveIntakeSubmission(id, fields, reviewNotes, opts?: { fdaPendingSupplement?: boolean })` truyền `fda_status='pending_supplement'` xuống `createClientAccount` (cần thêm 1 tham số vào chữ ký server action). | Nghiệp vụ 081 đã cho phép `pending_supplement` đi tiếp; hiện nhân viên không biết mình đang duyệt một hồ sơ sẽ chết ở bước đầu tiên. Đây là quyết định con người, không nên auto. |

**Kiểm chứng P0 (manual, không có test runner trong repo):** tạo link ở `/admin/clients/new` → mở `/client-intake/<token>` điền 5 bước có FDA số + hạn + mô tả + 2 link ảnh nhà máy → duyệt ở `/admin/clients/intake/<id>` → kiểm tra: `profiles.fda_registration_number`, `client_profiles.description`, `factory_image_urls`, score FDA = 10 trong `client_factory_assessments.score_breakdown`, "About Us" hiện trên `/profile/<slug>` (sau khi publish), `/client/products` không crash.

---

## P1 — Tự động hóa + chốt schema (cần migration, ~2–3 ngày, nên tách 3 PR)

**PR 1 — chống drift (đặt nền):**
- `scripts/082_client_products_schema_drift.sql`: idempotent `ALTER TABLE public.client_products ADD COLUMN IF NOT EXISTS …` cho đúng 18 cột code đang dùng nhưng không có trong `scripts/` (`country_of_origin, key_specifications, usp, moq_value, moq_unit, lead_time, sample_available, sample_notes, price_unit, incoterm, incoterm_place, payment_terms, packing, package_size, shelf_life, storage_conditions, private_label_available, private_label_notes`) + 2 index tìm kiếm. Mục tiêu: **tái tạo được DB từ repo**. Trước khi viết, phải dump schema live (`information_schema.columns`) để lấy đúng kiểu/kích thước thật — sai kiểu ở bước này còn hại hơn không có migration.
- `scripts/verify-schema.mjs` (dùng `postgres` đã có trong `devDependencies`): đọc `information_schema` và assert mọi bảng/cột mà code select (đặc biệt `client_products`, `client_profiles`, `client_intake_submissions`) tồn tại; chạy trong CI. Đây là cách triệt để nhất để không lặp lại lỗi P0-5 và P0-6.
- Gỡ `typescript.ignoreBuildErrors: true` trong `next.config.mjs` **và** `pnpm tsc --noEmit` + `pnpm lint` vào CI: chính flag này là lý do lỗi P0-4 (`Button`/`Plus` không import) lọt lên production mà không ai thấy.
- Chạy `supabase gen types typescript` để `Database["public"]["Tables"]["client_products"]` và `client_profiles.description` có mặt trong `lib/supabase/types.ts`.

**PR 2 — intake sinh được danh mục sản phẩm (giá trị nghiệp vụ lớn nhất):**
- `approveIntakeSubmission`: tách `main_products` (text) → row `client_products`. Helper `lib/client-intake/split-main-products.ts`: cắt theo `,` `;` newline `•` `/`, lowercase-dedupe, loại token <3 ký tự, cắt 120 ký tự, **trần 12 row**.
- Chèn với `status: 'inactive'`, `created_by = caller.id`, `source_submission_id = <submission id>`; audit `client_products_seeded_from_intake`.
- `client_products ADD COLUMN source_submission_id UUID REFERENCES client_intake_submissions(id) ON DELETE SET NULL` (đi kèm PR 1) → truy vết được row nào do intake sinh.
- **Điều kiện chạy:** chỉ khi `COUNT(client_products WHERE client_id) = 0` (idempotent, không nhân đôi khi duyệt lại), và chỉ khi reviewer tick "Tạo danh mục SP nháp từ phần Sản phẩm chính".
- `intake-review-detail.tsx`: card thứ 5 "Sản phẩm" — chips tách sẵn, sửa/xóa/thêm tay trước khi duyệt. Không auto-insert mà không cho người xem lại: text tự do kiểu "cà phê robusta rang xay, điều, tiêu" sẽ sinh tên SP bẩn nếu không qua mắt người.
- Vì rows là `inactive`: `app/admin/buyers/actions.ts` (buyer matching) và `lib/profile/actions.ts` đều lọc `status='active'` → **không** lọt sang buyer/ TRANG công khai trước khi duyệt. **Lưu ý quyết định:** view `ae_client_products` (035/047) lại KHÔNG lọc `status`, tức SP `inactive`/`suspended` vẫn tính vào `product_categories`/`product_hs_codes` cho scorer AE↔buyer. Nên thêm `AND cp.status = 'active'` vào view (cùng PR 1, kèm `DROP VIEW` + `CREATE VIEW` vì Postgres không cho đổi cột giữa) — nhưng đây là thay đổi hành vi scoring của client hiện hữu, cần bạn duyệt.

**PR 3 — các trường intake còn lại có chỗ ở:**
- `client_profiles`: thêm `website TEXT, address TEXT, tax_code TEXT, certifications TEXT[]` (083) — hiện 5 trường này thu về rồi **không có cột đích nào** trong `profiles` lẫn `client_profiles`.
- Mirror lúc duyệt + thêm ô nhập/checkbox ở `admin-profile-manager.tsx` + render trên `/profile/[slug]` (website → link ngoài, `certifications` → badge "tự khai, chưa xác minh" tách khỏi `featured_certifications` là **UUID của `compliance_docs`** = chứng từ đã xác minh; phân biệt verified/self-declared là điểm bán hàng thật của Vexim).
- Hồ sơ công khai sau khi duyệt luôn bị đặt `is_published: false` — thêm bộ lọc/badge "chưa xuất bản" ở `/admin/clients` (badge ở `/admin/clients`) để không chết chìm.

---

## P2 — Hoàn thiện trải nghiệm & bề mặt công khai (xếp sau, chờ quyết định)

1. **Cổng tự khai của client: chọn 1 trong 2.** (a) *Hoàn thiện*: wire `client-product-dialog.tsx` vào list, đổi `CATEGORIES` hard-code (chữ thường, lệch `product_categories`) sang `listProductCategoriesAction`, thêm `/client/products` vào `components/client/client-sidebar.tsx`, thêm ô upload ảnh; (b) *Gỡ bỏ*: xóa `app/client/products/*` + dialog, để câu "danh mục do Vexim quản lý" ở P0-4 thành chính thức. Trạng thái lưng chừng hiện tại là nguồn lỗi lặp lại.
2. **Ảnh trong intake:** thêm `POST /api/client-intake/[token]/upload-images` — cùng cơ chế Blob upload-token như `/api/products/upload-images` nhưng authorize bằng token (verify qua RPC `get_intake_submission_by_token`, `access: public`, prefix `intake/{token}/`), vẫn giữ `ImageLinkField` làm lựa chọn song song.
3. **Link intake:** nút "Gửi lại link / Gia hạn 14 ngày" (sinh token mới cho cùng submission `pending`), cap số link ACTIVE mỗi AE (vd. 50), xóa mềm thay vì DELETE hẳn ở cron để giữ audit.
4. **Hardening bề mặt công khai:** `/api/products/search` không auth + không rate-limit (chính `docs/LUONG_VAN_HANH.md` đã đánh dấu) → thêm rate-limit (Upstash `@upstash/ratelimit`, repo chưa có dep này) hoặc cache + cap `per_page`; cân nhắc trả tối thiểu field.
5. **Validation parity:** phía server `submit_client_intake` chỉ check 5 field; thêm trần độ dài (vd. 2000 ký tự cho `company_description`, 500 cho `main_products`) và ép `^(https?:)?//` cho mọi `*_url` — form hiện chỉ lọc chuỗi rỗng.
6. **Tài liệu:** `PRODUCT_DISCOVERY_*.md` / `EXACT_WORKFLOW.md` / `ARCHITECTURE_OVERVIEW.md` ở gốc đã lệch code (mô tả `/admin/products`, client tự nhập SP là luồng chính) → gộp vào `docs/`, đánh dấu superseded, thêm quy ước "đổi luồng thì sửa doc cùng PR".

---

## Việc cần bạn chốt trước khi tôi code

| Câu | Lựa chọn | Khuyến nghị của tôi |
|---|---|---|
| Khách intake khai **chưa có FDA** — duyệt thì ghi gì? | `missing` (chặn deal đúng nghiệp vụ) / tự `pending_supplement` (cho chạy) | `missing` + checkbox tự nguyện ở P0-7 |
| Auto-sinh `client_products` từ `main_products` | làm / chỉ gợi ý trên UI / bỏ | làm, `status='inactive'`, tick tay, chỉ khi client chưa có SP |
| Sửa view `ae_client_products` lọc `status='active'` | có / không | có, nhưng PR riêng vì chạm scoring của client đang chạy |
| `/client/products` của client | hoàn thiện / gỡ | gỡ (P2-1b) nếu bạn không muốn client tự nhập; nếu muốn thì làm trọn gói |
| `notes`/`hs_codes` trong `client_products` trên DB live | tồn tại / không | cần bạn chạy 1 câu SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='client_products'` |
