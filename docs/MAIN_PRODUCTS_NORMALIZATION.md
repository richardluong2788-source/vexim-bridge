# Chuẩn hóa `main_products` thành danh mục sản phẩm

Phạm vi: bóc tách trường text tự do ở bước intake thành row `client_products`
chuẩn, **không** làm ảnh hưởng hồ sơ nhà máy đã publish. Code:
`lib/client-intake/split-main-products.ts`. Vận hành:
`scripts/backfill-main-products.mjs`. Schema:
`scripts/083_client_products_intake_seed.sql`.

## 1. Vấn đề

`client_intake_submissions.main_products` (064/065) là **một textarea**. Nhà máy
điền gì cũng được, và hồ sơ thật thì thường là:

```
Chúng tôi chuyên sản xuất và cung cấp các mặt hàng nông sản: hạt điều rang muối,
cà phê robusta (HS 0901.21), tiêu, muối và các loại khác
```

Trường này **không có cột đích** nào: `approveIntakeSubmission` mirror
`tagline/moq/lead_time/...` sang `client_profiles`, còn `main_products` thì nằm
yên ở bảng submission. Trong khi đó mọi thứ phía buyer đọc đều là
`client_products`:

| Bề mặt | Đọc từ | Hệ quả khi chưa tách |
| --- | --- | --- |
| `/products`, `/products/<id>`, `/api/products/search` | `client_products` (`status='active'`) | nhà máy vô hình trên catalog |
| `/profile/<slug>` tab "Sản phẩm" | `client_products` (`status='active'`) | profile có chữ "sản phẩm chính" mà không có sản phẩm nào |
| AI matching `lib/matching/scorer.ts` | view `ae_client_products` ← `client_products` | score thấp gần như chắc chắn (xem `docs/CLIENT_INTAKE_PRODUCTS.md` §2c) |

Nên đây là **nối lại đường data**, không phải tính năng mới.

## 2. Bộ tách: cái nó làm, và cái nó làm, và cái nó từ chối làm

Đầu vào là text, đầu ra là `candidates` + `dropped` (kèm lý do) + `notes`. Tách
xong mỗi candidate có `product_name`, `hs_code`, `category`, `unit_of_measure`
và `confidence`.

Tách theo: xuống dòng, `,` `;` `|`, bullet `•·*`, số thứ tự `1.` `2)`, ` / `
(khoảng trắng hai bên), và chuỗi nối `và / hoặc / & / +`.

**Không** tách theo dấu phẩy tưởng tượng: text một câu không có dấu phân cách nào
chỉ cho ra **một** candidate và bị hạ `confidence = low`. Nếu text chỉ phân cách
bằng "và" (rất dễ gặp động từ xen giữa: "chúng tôi sản xuất A và B") thì chỉ
những mảnh ngắn (≤ 40 ký tự) **và** khớp một nhóm hàng đã biết (hoặc có mã HS)
mới được tin.

Chuẩn hóa:

- **Mã HS**: nhận `HS 2008.19`, `(mã HS: 0901.21)`, `HSCode 0901.21`, và cả mã
  trần `0901.21`; số viết thiếu dấu chấm được phục hồi (`090121` → `0901.21`,
  `20081900` → `2008.19.00`). Không đúng dạng 4/6/8/10 chữ số → **bỏ mã**, không
  bỏ tên: thà thiếu một mã còn hơn lưu một mã customs sai cho buyer tra theo.
- **Tên**: bỏ marker đầu dòng, bỏ dẫn nhập ("Sản phẩm chính:", "Gồm -"), bỏ dấu
  câu thừa, viết lại tên IN HOA thành chữ thường viết hoa đầu câu (giữ nguyên mã
  hàng có số: "Gạo ST25"), cắt 120 ký tự ở ranh giới từ và **báo** là đã cắt.
- **Đơn vị**: `500g/hộp` → tên `Cà phê rang xay` + `unit_of_measure='box'`;
  `25 kg` → `kg`. Không có gì rõ ràng thì để NULL (DB default `kg`).
- **Category**: chỉ gán khi khớp một trong 10 giá trị canonical của migration 028
  (`Coffee, Cocoa, Pepper, Cashew, Spices, Nuts, Dried Fruits, Grains, Oils,
  Other`) theo **từ đầy đủ** trên khóa đã bỏ dấu. Không khớp → NULL, không đoán,
  và không đổ vào `Other` (một row `Other` chẳng giúp gì cho matching).
  Chưa có nhóm cho trà/hải sản — đó là giới hạn của bảng `product_categories`,
  không phải của bộ tách.
- **Rác**: "các loại khác", "v.v.", "theo yêu cầu", "chúng tôi", "cung cấp",
  "xuất khẩu", tên công ty lặp lại, và trùng lặp (khóa so sánh không phân biệt
  hoa/thường/dấu) — tất cả vào `dropped` kèm lý do, không vào DB.
- **Trần 12 row/khách** (`--max-per-client`), vì textarea không có giới hạn.

## 3. Ghi vào DB: những gì được bảo đảm

`seedProductsFromMainProducts()` (cùng module) đọc danh mục hiện có của khách rồi
mới ghi. Mặc định của mọi đường ghi (script lẫn lúc duyệt intake):

| Bảo đảm | Cơ chế |
| --- | --- |
| Không hồ sơ publish nào bị chạm | script **không** ghi `client_profiles`; `is_published` không nằm trong tập lệnh nào. Hàng mới là `client_products`, và `status='inactive'` nên catalog + `/profile/<slug>` + search (đều lọc `status='active'`) không đổi một byte nào. |
| Không sửa/xóa dữ liệu cũ | chỉ `INSERT`. Không có `update`/`delete` trong module. Danh mục AE đã tự làm là bất khả xâm phạm. |
| Khách đã có sản phẩm thì không tự thêm | `onlyWhenClientEmpty: true` (mặc định). Muốn "lấp chỗ trống" thì phải nói rõ: `--mode=fill-gaps`, và vẫn bỏ qua tên đã tồn tại. |
| Chạy lại không nhân đôi | `product_code = AUTO-<hash(nameKey)>` đập vào `UNIQUE(client_id, product_code)` + dedupe theo tên đã chuẩn hóa + insert `ignoreDuplicates`. |
| Nguồn gốc truy vết được | `source_submission_id` (migration 083) → "row này sinh ra từ hồ sơ nào", và là cách xóa đúng một đợt seed. |
| Không tự bịa mô tả | `description` để NULL, `subcategory` NULL, giá không động: người duyệt viết phần mà buyer cần, không phải máy. |
| Lỗi không làm hỏng nghiệp vụ | module không throw; duyệt intake vẫn thành công nếu seed fail (log `[v0] intake product seeding failed`). |

Một tác dụng phụ **có chủ đích**: view `ae_client_products` (035/047) **không lọc
status**, nên hàng `inactive` đã tính vào `product_categories`/`product_hs_codes`
cho AI matching — đó chính là thứ làm nhà máy mới duyệt hết "mỏng". Nếu bạn muốn
siết view này thì đó là thay đổi scoring trên client đang chạy, xem §6.

## 4. Chạy dọn dữ liệu cũ

```bash
# 0) (khuyến nghị) lấy provenance trước
psql "$POSTGRES_URL" -f scripts/083_client_products_intake_seed.sql

# 1) xem sẽ ghi gì — mặc định là dry-run
node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --include-pending

# 2) chạy thử 5 hồ sơ đầu, rồi mới chạy hết
node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --limit=5 --apply --report=/tmp/seed-1.json
node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --limit=200 --apply --report=/tmp/seed-2.json

# hoặc: không cho node chạm DB, in SQL idempotent để dán vào Supabase SQL editor
node --env-file-if-exists=.env.local scripts/backfill-main-products.mjs --emit-sql > /tmp/seed.sql
```

Tùy chọn đáng nhớ: `--mode=fill-gaps`, `--min-confidence=high` (chỉ lấy phần chắc
nhất), `--status=active` (có cảnh báo — hiện luôn ra public), `--submission-id`,
`--client-id`, `--delay`, `--report`. Script resumable: chạy lại là các hồ sơ đã
seed tự nhảy sang `client_not_empty`.

**Duyệt lại** ở `/admin/clients/[id]` (tab Sản phẩm — mục "Quản lý hồ sơ"): sửa
tên/thêm giá/rồi bật `active`; hoặc xóa hàng rác. Muốn lùi cả đợt:

```sql
delete from public.client_products
 where source_submission_id is not null
   and status = 'inactive';
```

## 5. Từ giờ trở đi, hồ sơ mới

`approveIntakeSubmission(id, fields, reviewNotes, { seedProductsFromIntake })` —
mặc định **bật**. Ở `/admin/clients/intake/<id>`, ngay dưới ô "Sản phẩm / mã HS
chính" là:

- chips preview đúng danh sách sẽ được tạo (kèm mã HS + category), update khi bạn
  sửa textarea → **cái textarea đó chính là trình sửa danh mục**, không cần thêm
  UI nhập liệu;
- dòng "Bỏ qua N cụm từ không phải tên sản phẩm (…)";
- checkbox "Duyệt xong tạo N sản phẩm nháp…" để bỏ qua việc seed;
- sau khi duyệt: "Đã tạo N sản phẩm nháp (ẩn với buyer tới khi bạn bật lên…)".

Vì row là `inactive`, duyệt intake không tự đẩy gì lên trang public.

## 6. Chưa làm (ghi chú lại, xử lý sau khi xong luồng core)

1. **`ae_client_products` không lọc `status`** — quyết định nghiệp vụ, vì nó đổi
   điểm matching của client đang chạy: thêm `and cp.status = 'active'` (phải
   `DROP VIEW` + `CREATE VIEW`) thì hàng nháp không còn ảnh hưởng AI; bỏ qua thì
   hàng nháp *có* ảnh hưởng (hiện tại là vậy, có chủ đích).
2. **Editor danh mục đầy đủ ở bước duyệt** (thêm/xóa/sửa từng chip thay vì sửa
   text). Chips + textarea đã đủ cho đa số; editor chỉ cần khi nhà máy hay điền
   sai.
3. **`intake_submissions.main_products` vẫn là text tự do** — chưa ép trần 500 ký
   tự, chưa có field "mỗi dòng một sản phẩm" trong form công khai
   (`components/client-intake/client-intake-form.tsx`).
4. **`client_products` chưa có trong `Database` type** → module phải cast một lần
   ở biên Supabase (bình luận trong code). Xong khi chạy `supabase gen types`
   (xem `docs/CLIENT_INTAKE_REMEDIATION_PLAN.md` PR1).
5. Các mục mở rộng của luồng public (song ngữ hóa trang sản phẩm, `headers` bảo
   mật, `ignoreBuildErrors`) theo dõi ở `docs/SEO_LOCALE_AND_CACHE_NOTES.md` §6.

## 7. Test

```bash
node --test scripts/check-split-main-products.mjs   # 22 case, Node >= 22.18
```

Phủ: tách theo `,` `;` newline bullet số thứ tự ` / ` "và"; không bịa sản phẩm từ
câu văn liền; câu chỉ có động từ → 0 row; drop "các loại khác"/"v.v."/"theo yêu
cầu"/tên công ty; trùng lặp không phân biệt hoa-thường-dấu; trần 12 row; phục hồi
và từ chối mã HS; IN HOA → viết hoa đầu câu; pack size → unit; cắt 120 ký tự kèm
cờ `truncated`; `planSeedRows` (empty-only / fill-gaps / low-confidence /
duplicate / idempotent / giới hạn 160 ký tự tên); `planToSql` escape `'`.

Đường ghi thật (đọc existing → insert → đếm) đã chạy end-to-end trên một PostgREST
giả trong sandbox: 4 row sạch từ một blob lộn xộn, hồ sơ đã có sản phẩm bị bỏ
qua, `--apply` lần hai ghi 0 row, và không một `PATCH`/`DELETE` nào được phát ra.
