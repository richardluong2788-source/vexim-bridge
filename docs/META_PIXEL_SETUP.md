# Cài đặt Meta Pixel + Conversions API cho quảng cáo Facebook

> **Tình huống ban đầu:** quảng cáo Facebook đã chạy về website mà pixel chưa từng được cài —
> Ads Manager không biết ai đã vào, ai đã xem sản phẩm, ai đã gửi form. Dữ liệu của giai đoạn đó
> **không thể lấy lại** (Meta không backfill). Phần còn lại của tài liệu mô tả những gì đã code
> sẵn trong repo và cách vận hành nó.

---

## 0. Trạng thái hiện tại

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Meta Pixel (trình duyệt) | ✅ **ĐANG CHẠY trên production** (từ 2026-10-04) | Dataset ID `4532386106980064`, set ở Vercel → Production |
| Conversions API (server) | ⏸ **Chưa bật** | thiếu `META_CAPI_ACCESS_TOKEN` — vướng phân quyền Business Manager. Xem Bước 5 |
| Preview / `next dev` | ⛔ Cố ý tắt | mặc định chỉ chạy production; bật tạm bằng `NEXT_PUBLIC_META_PIXEL_ENABLED=true` |
| Công bố pháp lý | ✅ Tự bật theo pixel | `/legal/cookies` + `/legal/privacy` giờ đã công bố Meta Pixel, ngày hiệu lực 2026-10-04 |

Dataset ID **không phải secret** — nó nằm trong HTML của mọi trang công khai, ghi lại đây chỉ để
môi trường Preview (hoặc một dataset thứ hai nếu sau này tách thương hiệu) không bị dán nhầm.
Đừng hardcode nó vào `lib/analytics/meta/config.ts`: đọc từ env là cách duy nhất để tắt pixel mà
không phải sửa code.

**CAPI chưa bật thì làm ngay 2 việc bù đắp (không cần quyền Business Manager):**

1. Events Manager → dataset → `Settings` → **Automatic Advanced Matching = ON**. Pixel sẽ tự băm
   name/email/phone ngay trong form tư vấn — đây là phần lớn lợi ích match quality mà CAPI mang
   lại, và bật nó chỉ tốn một cú click.
2. Xem điểm **Event Match Quality** của event `Lead` (Events Manager → Overview → chọn event).
   Dưới 4.0 nghĩa là Meta đang match yếu → lead vẫn được ghi nhận nhưng tối ưu chiến dịch kém
   chính xác, và đó là dấu hiệu nên ưu tiên xin quyền CAPI.

---

## 1. Phần code đã làm sẵn

Toàn bộ integration tự tắt khi `NEXT_PUBLIC_META_PIXEL_ID` rỗng — xoá biến đó đi là kill switch,
không cần sửa code. (Hiện biến đã được set trên production.)

### 1.1 Các file mới

| File | Vai trò |
| --- | --- |
| `lib/analytics/meta/config.ts` | Đọc env, quyết định "có track không" và "URL nào được track" |
| `lib/analytics/meta/browser.ts` | Helper phía trình duyệt: `trackMetaEvent()`, `trackMetaEventOnce()`, `newMetaEventId()` |
| `lib/analytics/meta/server.ts` | Conversions API (CAPI) phía máy chủ: băm SHA-256 PII, dựng `fbc`/`fbp`, gọi Graph API |
| `components/analytics/meta-pixel.tsx` | Nạp base snippet của Meta, bắn `PageView` khi chuyển trang, bắt click gọi/email/Zalo |
| `components/analytics/meta-page-event.tsx` | Bắn 1 sự kiện khi một trang (server component) render — dùng cho `ViewContent`/`Search` |
| `docs/META_PIXEL_SETUP.md` | File này |

### 1.2 Các file được sửa

| File | Thay đổi |
| --- | --- |
| `app/layout.tsx` | Mount `<MetaPixel />` (không đọc cookie/header → shell vẫn static, cache CDN không đổi) |
| `components/landing/consultation-form.tsx` | Bắn `Lead` sau khi gửi form thành công, kèm `fbclid` cho CAPI |
| `app/api/consultation/route.ts` | Gửi `Lead` qua **CAPI** từ máy chủ + trả `eventId` về client để khử trùng lặp |
| `app/products/[id]/page.tsx` | `ViewContent` (kèm tên/id/giá sản phẩm) |
| `app/products/page.tsx` | `Search` khi có `?q=`, `ViewContent` khi chỉ lọc danh mục |
| `app/profile/[slug]/page.tsx` | `ViewContent` cho hồ sơ nhà cung cấp công khai |
| `components/product/product-request-quote-dialog.tsx` | `Lead` khi buyer gửi yêu cầu báo giá |
| `app/legal/cookies/page.tsx` · `app/legal/privacy/page.tsx` | Tự công bố Meta Pixel khi pixel bật (xem mục 6) |

### 1.3 Bảng sự kiện (event map)

| Sự kiện | Bắn ở đâu | Khi nào | Dùng để làm gì trong Ads Manager |
| --- | --- | --- | --- |
| `PageView` | mọi trang **công khai** | tải trang + mỗi lần chuyển trang mềm | Reach, tần suất, retargeting "đã ghé website" |
| `ViewContent` | `/products/[id]`, `/profile/[slug]`, `/products` | xem chi tiết | Retargeting "xem sản phẩm nhưng chưa hỏi" |
| `Search` | `/products?q=…` | buyer gõ từ khoá | Biết thị trường Mỹ đang tìm gì |
| `Contact` | mọi link `tel:`, `mailto:`, Zalo/WhatsApp/Messenger | click | "Lead nóng" gọi hotline — thường bị bỏ sót hoàn toàn |
| **`Lead`** | form tư vấn landing **+** form yêu cầu báo giá | gửi thành công | **Conversion event chính của chiến dịch** |

**Trang KHÔNG bắn pixel** (cố ý): `/admin`, `/client`, `/settings`, `/notifications`, `/auth`,
`/api` (traffic nội bộ của team sẽ làm bẩn audience và làm sai mọi con số), cùng các trang dùng
token riêng tư `/share`, `/shortlist`, `/invoice`, `/unsubscribe`, `/client-intake`. Danh sách này
nằm trong `isMetaTrackedPath()` — sửa ở đó nếu muốn đổi.

### 1.4 Vì sao gửi Lead 2 lần (browser + server)

Cùng một sự kiện `Lead` được gửi bằng **hai đường**:

1. trình duyệt: `fbq('track', 'Lead', …, { eventID })`
2. máy chủ: `POST graph.facebook.com/<version>/<PIXEL_ID>/events` (Conversions API)

Cả hai dùng chung một `event_id` (server sinh, trả về trong response của `/api/consultation`), nên
Meta **tự khử trùng lặp** — chỉ tính 1 conversion. Lợi ích:

- ad blocker / Safari ITP / iOS ATT chặn đường browser → đường server vẫn ghi nhận;
- token CAPI chưa cấu hình hoặc Graph API lỗi → đường browser vẫn ghi nhận;
- Event Match Quality cao hơn (server gửi kèm email/phone đã băm + `fbc`/`fbp` + IP + user agent),
  mà match quality cao thì **giá mỗi lead rẻ hơn** vì Meta tối ưu đúng người.

Lead gửi **trùng** (cùng email, form vẫn còn mở) sẽ không được báo lần hai — API trả
`duplicate: true` và cả hai phía đều im lặng, tránh thổi phồng số conversion.

---

## 2. Việc bạn cần làm (theo thứ tự)

### Bước 1 — Lấy Dataset ID (Pixel ID)

1. Vào **Meta Events Manager**: <https://business.facebook.com/events_manager> (chọn đúng Business
   Portfolio đang chạy quảng cáo).
2. Nếu **chưa có** nguồn dữ liệu nào: `Connect Data Sources` → `Web` → `Meta Pixel` → đặt tên
   (ví dụ `Vexim Trade Website`) → nhập `https://veximtrade.com`.
3. Nếu **đã có**: click vào dataset đó → `Settings` → copy **Dataset ID** (15–16 chữ số).
4. Trong `Settings` → `Data use settings`, bật:
   - **Automatic Advanced Matching** → ON (pixel tự lấy name/email/phone trong form và băm lại;
     form tư vấn của mình có đủ 3 field này → tăng match quality rõ rệt).
   - **Data sharing settings** → chọn mức bạn muốn (mức cao hơn cho Meta nhiều dữ liệu đo hơn).

### Bước 2 — Xác minh domain (khuyến nghị mạnh)

`Business Settings` → `Brand Safety` → `Domains` → `Add Domain` → `veximtrade.com` → xác minh bằng
**DNS TXT record** (sạch nhất, không phải deploy) hoặc meta tag. Sau đó cho ad account quyền sử
dụng domain này. Không xác minh thì một số cấu hình conversion bị giới hạn kể từ iOS 14+.

### Bước 3 — Thêm biến môi trường trên Vercel ✅ đã xong (Production)

Vercel → project → `Settings` → `Environment Variables`. **Bắt buộc:**

| Biến | Giá trị | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ID` | Dataset ID ở Bước 1 | Production (+ Preview nếu muốn test) |

**Khuyến nghị (server-side, bật CAPI):**

| Biến | Giá trị | Ghi chú |
| --- | --- | --- |
| `META_CAPI_ACCESS_TOKEN` | access token của dataset | lấy ở Bước 5 |
| `META_CAPI_API_VERSION` | `v26.0` | mặc định đã là v26.0; Meta khai tử mỗi version sau ~2 năm |

**Tuỳ chọn:**

| Biến | Giá trị | Ghi chú |
| --- | --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ENABLED` | `true` / `false` | mặc định: chỉ chạy ở production. Đặt `true` ở Preview để test trước |
| `META_CAPI_TEST_EVENT_CODE` | `TEST12345` | chỉ dùng lúc test (xem Bước 4), **xoá sau khi xong** |
| `NEXT_PUBLIC_META_LEAD_VALUE` | ví dụ `25` | gắn "giá trị" cho mỗi lead khi bạn muốn tối ưu theo value. Chưa cần thì để trống |
| `NEXT_PUBLIC_META_LEAD_CURRENCY` | `USD` / `VND` | đi kèm biến trên, mặc định `USD` |
| `MARKETING_LEAD_RATE_LIMIT_DISABLED` | `1` | chỉ khi test gửi form nhiều lần liên tiếp |

> ⚠️ Biến `NEXT_PUBLIC_*` được **nhúng lúc build**, nên sau khi thêm/sửa phải **Redeploy**
> (`Deployments` → deployment mới nhất → `⋯` → `Redeploy`). Restart không ăn thua.

### Bước 4 — Kiểm tra pixel chạy

1. Cài extension **Meta Pixel Helper** (Chrome/Edge).
2. Mở `https://veximtrade.com` → icon Helper phải hiện `PageView` và đúng Dataset ID.
3. Bấm thử vào số hotline ở footer → Helper hiện thêm event `Contact`.
4. Vào `/products` → `ViewContent` hoặc `Search`; vào 1 sản phẩm → `ViewContent` kèm `content_ids`.
5. Events Manager → `Test Events` → để tab đó mở, rồi gửi 1 form tư vấn thật (dùng email test) →
   phải thấy `Lead` xuất hiện **2 dòng** (browser + server) và Meta ghi chú đã **khử trùng lặp**
   (`Deduplicated`).
6. Nếu bật CAPI, xem log Vercel: `Functions` → deployment → tìm `[meta-capi]`. Không có dòng nào =
   thành công; có dòng `[meta-capi] rejected` = đọc `detail` để biết lỗi (thường là token sai).
7. **Xoá** `META_CAPI_TEST_EVENT_CODE` và redeploy. Sự kiện còn mã test sẽ bị loại khỏi báo cáo.

### Bước 5 — Lấy token cho Conversions API ⏸ đang chờ quyền Business Manager

Nếu `Generate access token` / `System Users` bị khoá (thường vì bạn chỉ là **Employee** trong
Business Portfolio chứ không phải Admin), thì đây là việc cần **nhờ admin BM làm**, gửi nguyên đoạn
này cho họ:

> Business Settings → Users → System Users → Add → role **Employee** → Generate token → chọn app →
> scope **`ads_management`** → sau đó ở asset của system user đó, assign **Dataset `4532386106980064`**
> với quyền full control. Token system user không hết hạn. Dán giá trị vào Vercel với tên
> `META_CAPI_ACCESS_TOKEN` rồi Redeploy.

Trong lúc chờ, pixel trình duyệt vẫn ghi nhận `Lead` bình thường — chỉ là sẽ **thiếu** những
conversion từ trình duyệt có ad blocker / Safari ITP / iOS ATT (thường 15–30%). Bật
**Automatic Advanced Matching** (mục 0) là cách bù đắp rẻ nhất cho tới khi có token.

Hai cách lấy token (khi đã có quyền):

- **Cách nhanh:** Events Manager → dataset → `Settings` → `Conversions API` →
  `Generate access token` (token gắn thẳng vào dataset đó).
- **Cách chuẩn cho lâu dài:** `Business Settings` → `Users` → `System Users` → tạo system user
  (role: Admin hoặc Employee) → `Generate token` → chọn app → scope **`ads_management`** →
  assign asset là dataset của bạn. Token system user **không hết hạn**, trong khi token cá nhân có.

Dán vào `META_CAPI_ACCESS_TOKEN`, redeploy, test lại Bước 4.5.

### Bước 6 — Cấu hình chiến dịch trong Ads Manager

Trong ad set:

- **Conversion location:** `Website`
- **Performance goal:** `Maximize number of conversions`
- **Conversion event:** `Lead` ← chọn đúng event này (không phải `PageView`, không phải `Landing page views`)
- **URL quảng cáo:** nên kèm UTM để đối chiếu được với DB (xem mục 4):
  ```
  https://veximtrade.com/vi?utm_source=facebook&utm_medium=paid_social&utm_campaign=<ten-chien-dich>&utm_content=<mau-quang-cao>
  ```
  (`/vi` là bản tiếng Việt — form tư vấn nhắm nhà máy Việt nên dùng `/vi`; bản tiếng Anh là `/`.)
- **Attribution setting:** `7-day click and 1-day view` là mặc định hợp lý cho B2B lead.

> 💡 **Learning phase:** Meta cần khoảng **50 conversion / 7 ngày / ad set** để thoát học máy.
> Nếu ngân sách nhỏ và mỗi tuần chỉ vài lead, hãy cân nhắc (a) gộp ad set lại, hoặc (b) tối ưu theo
> event dày hơn (`Contact` hoặc `ViewContent`) rồi mới chuyển sang `Lead`. Tối ưu theo `Lead` với
> 3 conversion/tuần sẽ cho kết quả thất thường hơn là không tối ưu.

---

## 3. Dữ liệu cũ đã mất — cứu được phần nào?

Pixel không thể hồi tố, nhưng **lead thật thì vẫn còn trong DB** (`marketing_leads`, có email +
phone + ngày gửi). Hai việc nên làm:

1. **Customer List Custom Audience** (làm ngay, giá trị nhất)
   `Audiences` → `Create Audience` → `Custom Audience` → `Customer list` → upload CSV gồm
   `email`, `phone`, `full name`, `company` lấy từ `marketing_leads`. Từ đó tạo
   **Lookalike 1%** (VN) — đây là cách duy nhất để "dạy" Meta chân dung khách của bạn khi chưa có
   dữ liệu pixel.
   ```sql
   -- Supabase SQL editor
   select full_name, email, phone, company_name, industry, created_at
   from marketing_leads
   where status <> 'spam'
   order by created_at desc;
   ```
2. **Gửi lại lead cũ qua CAPI** (giá trị thấp hơn, chỉ làm nếu rảnh)
   Meta mặc định chỉ nhận sự kiện trong ~7 ngày; dataset có tuỳ chọn
   *"Allow historical conversion uploads"* mở rộng tới 90 ngày. Nhưng muốn gán được cho quảng cáo
   thì phải có `fbclid`/`fbc` của cú click gốc — lead cũ **không lưu** field này, nên phần lớn sẽ
   thành sự kiện không attribution. Từ nay về sau thì có: `fbclid` được lưu trong
   `marketing_leads.raw_payload->>'fbclid'`, nên về sau muốn đối chiếu "click nào ra lead nào"
   vẫn làm được.

---

## 4. Đối chiếu số liệu Meta với số liệu của mình

Nguồn sự thật vẫn là **`marketing_leads`** (xem `/admin/marketing-leads`). Số trong Ads Manager
luôn khác số trong DB, và đó là chuyện bình thường:

| Nguyên nhân | Ảnh hưởng |
| --- | --- |
| Cửa sổ attribution (7 ngày click / 1 ngày view) | Meta nhận cả lead không mang UTM Facebook |
| Ad blocker + iOS ATT | Meta **thiếu** lead so với DB (CAPI bù lại phần lớn) |
| Người dùng từ chối/bị chặn cookie | không match được |
| Lead trùng (cùng email gửi 2 lần) | DB gộp 1 dòng, Meta có thể tính 2 |

Cách đối chiếu nhanh: lead nào từ Facebook thì `utm_source` = `facebook`/`fb`, hoặc
`referrer` chứa `facebook.com` / `l.facebook.com`:

```sql
select date_trunc('day', created_at) as ngay,
       count(*) filter (where utm_source ilike '%facebook%' or referrer ilike '%facebook%') as tu_facebook,
       count(*) as tong_lead
from marketing_leads
where created_at > now() - interval '30 days'
group by 1 order by 1 desc;
```

---

## 5. Audience retargeting nên tạo (sau ~2 tuần có dữ liệu)

| Audience | Điều kiện | Dùng cho |
| --- | --- | --- |
| Đã gửi form | `Lead` trong 30 ngày | **Loại trừ** khỏi chiến dịch acquisition (đừng trả tiền để quảng cáo lại người đã hỏi) |
| Xem sản phẩm, chưa hỏi | `ViewContent` 30 ngày **AND NOT** `Lead` 30 ngày | Retargeting chính — nhóm này đã có ý định |
| Ghé website, thoát nhanh | `PageView` 7 ngày, không có `Contact`/`Lead` | Ngân sách nhỏ, creative khác góc |
| Bấm hotline/email | `Contact` 14 ngày | Lead nóng, ưu tiên cao nhất |
| Lookalike 1% từ customer list | mục 3.1 | Mở rộng tệp acquisition |

---

## 6. Pháp lý / cookie policy

Trang `/legal/cookies` trước đây ghi rõ *"Chúng tôi không sử dụng cookie quảng cáo, retargeting,
fingerprinting hay social tracking pixel"* — cài pixel vào mà để nguyên câu đó là một tuyên bố sai
trong văn bản pháp lý. Nên cả `/legal/cookies` và `/legal/privacy` giờ **tự đọc cùng một biến môi
trường** `NEXT_PUBLIC_META_PIXEL_ID`:

- pixel bật → trang công bố Meta Pixel, cookie `_fbp`/`_fbc`, dữ liệu gửi qua CAPI (đã băm), và
  hướng dẫn 3 cách tắt;
- pixel tắt → giữ nguyên câu cũ (vì lúc đó nó đúng).

Không cần sửa tay khi bật/tắt pixel.

**Còn thiếu nếu muốn chặt chẽ hơn:** banner xin chấp thuận cookie (consent mode) trước khi nạp
pixel. Với traffic VN + Mỹ và mô hình B2B hiện tại thì chưa bắt buộc; nếu sau này có traffic EU
thì thêm — chỗ gắn vào là `components/analytics/meta-pixel.tsx` (chỉ mount khi đã consent).

---

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
| --- | --- |
| Pixel Helper không thấy gì | Chưa set `NEXT_PUBLIC_META_PIXEL_ID`, hoặc set rồi nhưng **chưa redeploy** (`NEXT_PUBLIC_*` nhúng lúc build). Hoặc bạn đang xem `/admin` — cố ý không bắn. |
| Preview không có pixel | Mặc định chỉ chạy production. Thêm `NEXT_PUBLIC_META_PIXEL_ENABLED=true` cho môi trường Preview. |
| Có `PageView` nhưng không có `Lead` | Mở DevTools → Network → lọc `facebook.com/tr`. Nếu form trả lỗi thì không có lead thật. Nếu `ok:true` mà vẫn không có → kiểm tra `fbq` bị chặn (ad blocker): lúc này CAPI vẫn ghi nhận, xem `Test Events` phần `Server`. |
| CAPI trả lỗi `190` | Token hết hạn / sai scope → tạo lại token system user với `ads_management`. |
| CAPI trả lỗi `(#803) … dataset does not exist` | `META_CAPI_ACCESS_TOKEN` của dataset khác, hoặc ID pixel sai. |
| `Lead` bị tính gấp đôi | Hai phía dùng khác `event_id`. Kiểm tra response `/api/consultation` có `eventId` không (client phải nhận được). |
| Event Match Quality thấp (dưới 4) | Bật **Automatic Advanced Matching** (Bước 1.4) và đảm bảo CAPI đang chạy — hai thứ này đóng góp phần lớn điểm. |
| Số liệu nhảy lung tung 24–48h đầu | Bình thường: Meta cần thời gian quy attribution và khử trùng lặp. |

---

## 8. Ghi chú kỹ thuật cho dev

- **Không phá ISR/static.** `/products/[id]` và `/profile/[slug]` vẫn là SSG (`●`), `/products`
  vẫn dynamic (`ƒ`) như trước. `<MetaPageEvent />` là client component chỉ bắn event trong
  `useEffect`, không đọc cookie/header lúc render.
- **Không dùng `useSearchParams()`** trong `meta-page-event.tsx` — trên route static nó buộc Next
  bail out sang client rendering (và báo lỗi build nếu thiếu Suspense). Query string được server
  component truyền xuống qua `dedupeKey`.
- **Chống bắn trùng:** `trackMetaEventOnce(key, …)` — React StrictMode chạy effect 2 lần ở dev, và
  App Router re-mount page khi user bấm Back. Không có lớp này thì mỗi lần xem sản phẩm bị đếm 2–3
  lần, mà Meta tối ưu theo đúng cái mình đưa nó.
- **Snippet dùng `next/script` với `strategy="afterInteractive"`** — pixel không được tranh băng
  thông với ảnh LCP của landing. `fbq` là hàng đợi nên event bắn trước khi `fbevents.js` tải xong
  vẫn không mất.
- **Pixel ID được validate là chữ số** (`/^\d{1,20}$/`) trước khi nội suy vào inline script: dán
  nhầm URL thay vì ID sẽ làm pixel tự tắt chứ không chèn text lạ vào document.
- **PII không bao giờ log.** `lib/analytics/meta/server.ts` chỉ in status code và error message;
  hàm băm nằm trong module `server-only` nên không thể bị bundle ra trình duyệt.
- **Timeout 5s, never throws.** CAPI được `await` (không fire-and-forget, vì trên Vercel promise
  còn treo khi response đã gửi có thể bị đóng băng và mất event), nhưng lỗi CAPI không bao giờ
  biến một lead hợp lệ thành trang báo lỗi.
- **Bật/tắt:** xoá `NEXT_PUBLIC_META_PIXEL_ID` → toàn bộ integration tắt (kể cả phần text pháp lý).
  Đó là kill switch.

### Kiểm tra nhanh ở máy local

```bash
# Pixel bật ở dev (mặc định dev bị tắt để không bẩn dữ liệu thật)
NEXT_PUBLIC_META_PIXEL_ID=1234567890123456 \
NEXT_PUBLIC_META_PIXEL_ENABLED=true \
MARKETING_LEAD_RATE_LIMIT_DISABLED=1 \
pnpm dev
```

Mở `http://localhost:3000/vi`, bật Pixel Helper, gửi form → console sẽ có `fbq` call
(`window.fbq.queue` xem được trực tiếp trong DevTools).
