# Tiêu chí AI phân bổ Buyer cho AE

> Tài liệu này dành cho **LR (Lead Rep)** dùng để tự đánh giá sơ bộ một buyer/lead
> *trước khi* nhập chính thức vào hệ thống — dự đoán buyer sẽ được AI auto-assign,
> đưa vào inbox, hay bị skip, và AE nào có khả năng nhận buyer cao nhất.
>
> Nguồn logic: `lib/matching/scorer.ts`, `lib/matching/orchestrator.ts`,
> `lib/matching/types.ts`.

## 1. Bộ lọc cứng trước khi chấm điểm: Ngành hàng (Industry)

Trước khi AI chấm điểm bất kỳ yếu tố nào, hệ thống lọc AE theo **industry**
(chuẩn hóa qua `normalizeIndustry`) khớp với industry của buyer:

- **Có AE cùng ngành** → chỉ những AE này được đưa vào vòng chấm điểm ở Mục 2.
  AE khác ngành, dù các yếu tố khác khớp cao, **không bao giờ** được xét.
- **Không có AE nào cùng ngành** (hoặc buyer chưa có industry) → buyer bị đưa
  vào **Shared Inbox**: mọi AE đều nhận được, ai claim trước thì được
  (first-come-first-served), không có auto-assign.

**LR cần điền:** Industry của buyer phải chính xác và khớp với industry đã gán
cho AE — đây là điều kiện tiên quyết, sai/thiếu industry sẽ đẩy buyer ra khỏi
luồng auto-assign ngay từ đầu.

## 2. Công thức chấm điểm (áp dụng cho AE cùng ngành)

Điểm được tính trên portfolio **client thực tế** mà AE đang quản lý (bảng
`client_products`), không dựa vào hồ sơ AE tự khai.

| # | Yếu tố | Trọng số | Input LR cần cung cấp | Cách chấm |
|---|---|---|---|---|
| 1 | **HS Code Match** | 40% | Mã HS (6 số) của sản phẩm buyer cần | So khớp với HS code thật của các client AE đang quản lý: **exact match (6 số) = 100đ**, **prefix match (4 số) = 70–100đ** (tăng theo tỷ lệ số mã trùng), không có mã HS AE nào = 20đ, buyer không nhập HS code = 30đ (trung tính), AE chưa có client = 0đ |
| 2 | **Product Match** | 25% | Từ khóa sản phẩm / category buyer tìm | So khớp từ khóa với category/subcategory sản phẩm của client AE (dạng includes hai chiều). Nếu có semantic embedding: **70% semantic + 30% rule-based** (hybrid mode). Không có từ khóa = 40đ (trung tính) |
| 3 | **Country Match** | 20% | Quốc gia buyer, các nước buyer đang nhập hàng (`main_import_countries`) | Buyer đã nhập hàng **từ Việt Nam** → **100đ tuyệt đối**. AE có client cùng quốc gia với buyer → **80đ**. Không khớp → 40đ. Không có dữ liệu → 50đ (trung tính) |
| 4 | **Logistics Match** | 10% | Cảng đi (`origin_ports`), cảng đến, loại container | Điểm nền 50đ. **+30đ** nếu cảng đi là cảng VN (HCMC/Hồ Chí Minh, Hải Phòng, Đà Nẵng, Cát Lái, Cái Mép). **+20đ** nếu container loại 20' hoặc 40'. Tối đa 100đ |
| 5 | **Priority Bonus** | 5% | Mức độ ưu tiên buyer (`priority_rating`, thang 1–5) do LR đánh giá | Priority × 20 (ví dụ priority 5 = 100đ, priority 1 = 20đ). Không có priority = 0đ |
| — | **VN Supplier Bonus** | +10đ cố định (ngoài 100%) | Buyer đã có nhà cung cấp Việt Nam chưa (`top_suppliers`) | Nếu có ít nhất 1 supplier ghi quốc gia Việt Nam → **+10 điểm thẳng** vào tổng, đánh dấu "warm lead" |

**Tổng điểm** = Σ(điểm từng yếu tố × trọng số) + VN Supplier Bonus (nếu có),
giới hạn tối đa **100 điểm**.

## 3. Ngưỡng quyết định (thresholds)

| Tổng điểm | Kết quả | Ý nghĩa |
|---|---|---|
| **≥ 75** | `auto_assign` | Tự động gán cho AE điểm cao nhất, gửi notification, ghi activity log |
| **50 – 74.99** | `inbox` | Đưa vào AE Inbox cho mọi AE đạt ngưỡng tối thiểu; phân loại lại priority hiển thị: **high** nếu điểm ≥ 70 (inbox_max − 5), còn lại **medium/low** theo vị trí trong khoảng; hết hạn sau 7 ngày nếu AE không phản hồi |
| **< 50** | `skip` | Không đủ điểm, không đề xuất AE nào cho buyer này |

*(Các ngưỡng 75/50 là mặc định, admin có thể chỉnh qua bảng `matching_config`.)*

## 4. Checklist thông tin LR nên nhập đầy đủ để AI chấm điểm chính xác

Điền đủ các trường sau khi tạo lead sẽ giúp AI chấm điểm chính xác nhất
(thiếu trường nào, yếu tố đó rơi về điểm trung tính, làm giảm khả năng
auto-assign đúng AE):

- [ ] **Industry** — bắt buộc để qua được vòng lọc cứng
- [ ] **HS Code** sản phẩm (càng đủ 6 số càng tốt, trọng số cao nhất 40%)
- [ ] **Từ khóa/loại sản phẩm** cụ thể (category, subcategory)
- [ ] **Quốc gia buyer** và **các nước buyer đang nhập hàng** (`main_import_countries`) — đặc biệt ghi rõ nếu buyer đã nhập từ Việt Nam
- [ ] **Cảng đi/cảng đến** dự kiến và **loại container**
- [ ] **Priority rating** (1–5) theo đánh giá độ "nóng" của lead
- [ ] **Nhà cung cấp hiện tại của buyer** (`top_suppliers`), đặc biệt nếu đã có supplier Việt Nam

## 5. Lưu ý khi đánh giá client/AE

- AI **không** dựa vào hồ sơ AE tự khai (trừ `industry`), mà dựa vào **dữ liệu
  thật từ các client AE đang quản lý**. AE mới hoặc chưa có client sẽ luôn có
  điểm HS Code/Product Match = 0 và khó được auto-assign cho đến khi có ít
  nhất vài client làm dữ liệu mẫu.
- Nếu muốn buyer chắc chắn được auto-assign, ưu tiên đảm bảo đủ **HS code
  chính xác** + **industry đúng** + **quốc gia/nguồn nhập rõ ràng** — đây là
  3 yếu tố chiếm tỷ trọng lớn nhất (40% + 20% + hỗ trợ lọc ngành).
- Trường hợp buyer thiếu nhiều thông tin, hệ thống sẽ có xu hướng đưa vào
  `inbox` (nhiều AE cùng thấy) hơn là `auto_assign`, để AE tự xác nhận thay AI.
