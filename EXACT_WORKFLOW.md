# 📍 Exact Workflow - Cách Hoạt Động Chính Xác

## ❓ Câu Hỏi: "Giờ thế nào để Client nhập sản phẩm và Admin tìm kiếm?"

**Đáp án:** Có 2 cách chính!

---

## CÁCH 1️⃣: CLIENT TỰ NHẬP TRÊN DASHBOARD

### Timeline: Client làm việc này
```
Thời gian: ~5 phút/sản phẩm
Tần suất: Khi có sản phẩm mới hoặc cập nhật giá
Ai làm: Client (nhà cung cấp)
```

### Bước 1: Client Đăng Nhập
```
URL: https://app.vexim-bridge.com
Username: client@company.com
Password: ****

→ Vào dashboard
```

### Bước 2: Truy Cập Sản Phẩm
```
Cách 1 (Recommend): Click "Sản Phẩm" (📦) trên sidebar trái
Cách 2: Gõ URL trực tiếp: /client/products

→ Trang sản phẩm mở lên
```

### Bước 3: Thêm Sản Phẩm
```
Click nút: [+ Thêm Sản Phẩm]

Dialog form xuất hiện:
┌─────────────────────────────┐
│ Thêm Sản Phẩm Mới           │
├─────────────────────────────┤
│ *Tên Sản Phẩm               │
│ [Arabica Coffee Beans    ]  │
│                             │
│ *Danh Mục                   │
│ [▼ Coffee              ]    │
│                             │
│ *Sản Lượng/Tháng (kg)       │
│ [500                    ]   │
│                             │
│ *Đơn Hàng Tối Thiểu (kg)   │
│ [100                    ]   │
│                             │
│ *Giá/Kg (USD)               │
│ [4.50                   ]   │
│                             │
│ ○ Cách Đóng Gói             │
│ [25kg jute bags         ]   │
│                             │
│ ○ Xuất Xứ / Ghi Chú        │
│ [Premium grade, Vietnam ]   │
│                             │
│ ○ Chứng Chỉ FDA             │
│ [Upload file...]  ✓ FDA-123 │
│                             │
│ [Hủy] [Lưu Sản Phẩm]      │
└─────────────────────────────┘
```

### Bước 4: Điền Thông Tin
```
BẮT BUỘC phải điền (*):
  ✓ Tên Sản Phẩm: "Arabica Coffee Beans"
  ✓ Danh Mục: "Coffee" (dropdown)
  ✓ Sản Lượng/Tháng: 500
  ✓ Đơn Hàng Tối Thiểu: 100
  ✓ Giá/Kg: 4.50

TÙY CHỌN (có thể bỏ qua):
  ○ Cách Đóng Gói
  ○ Xuất Xứ
  ○ Chứng Chỉ FDA
```

### Bước 5: Lưu Sản Phẩm
```
Click: [Lưu Sản Phẩm]

Backend xử lý:
  1. Validate form data
  2. Insert into client_products table
  3. Set status = 'active'
  4. Return success

Kết quả:
  ✅ Thông báo: "Sản phẩm đã lưu!"
  ✅ Product hiện trong danh sách
  ✅ Admin có thể tìm thấy ngay
```

### Bước 6: Xem Danh Sách
```
Trang sản phẩm giờ hiển thị:

┌──────────────────────────────────────────┐
│ Sản Phẩm Của Bạn                         │
│ [+ Thêm Sản Phẩm]                       │
├──────────────────────────────────────────┤
│ Product Name    | Category | Qty | Price │
├──────────────────────────────────────────┤
│ Arabica Beans   | Coffee   |500kg | $4.50│
│ Status: ✓ Active                         │
│ [Edit] [Delete] [Download]               │
│                                          │
│ Robusta Beans   | Coffee   |300kg | $3.80│
│ Status: ✓ Active                         │
│ [Edit] [Delete] [Download]               │
└──────────────────────────────────────────┘
```

### Bước 7: Chỉnh Sửa / Xóa
```
Muốn chỉnh sửa:
  Click [Edit] → Form mở lên → Sửa → [Lưu]

Muốn ẩn sản phẩm:
  Click [Delete] → Status = 'inactive'
  (Sản phẩm sẽ biến mất khỏi Admin search)

Xuất danh sách:
  Click [Download] → PDF tải về
```

---

## CÁCH 2️⃣: ADMIN TÌM KIẾM & LIÊN HỆ

### Timeline: Admin làm việc này
```
Thời gian: ~2 phút/search
Tần suất: Mỗi khi cần tìm supplier
Ai làm: Admin (người tìm kiếm)
```

### Bước 1: Admin Đăng Nhập
```
URL: https://app.vexim-bridge.com
Username: admin@vexim.com
Password: ****

→ Vào dashboard
```

### Bước 2: Truy Cập Tìm Kiếm Sản Phẩm
```
Cách 1 (Recommend): Click "Sản Phẩm" (📦) trên sidebar
Cách 2: Gõ URL: /admin/products

→ Trang tìm kiếm sản phẩm mở lên
```

### Bước 3: Chọn Cách Tìm Kiếm

#### **Option A: Quick Search (Tìm Nhanh)**
```
Top của trang có ô search:

┌────────────────────────────────────┐
│ 🔎 Search: [Arabica________]      │
│            [🔍 Search]             │
└────────────────────────────────────┘

Nhập: "Arabica" hoặc "Coffee Trading"
→ Tìm toàn bộ sản phẩm chứa từ này
→ Kết quả hiện trong 2 giây
```

#### **Option B: Advanced Filter (Tìm Nâng Cao - RECOMMEND)**
```
┌────────────────────────────────────┐
│ ADVANCED FILTERS                   │
├────────────────────────────────────┤
│ Category: [▼ Coffee_______]        │
│ Min Capacity: [400____] kg/month   │
│ Price Range: [$3.00 - $5.50]      │
│ FDA Status: [▼ All_______]        │
│ [🔍 Tìm Kiếm]                    │
└────────────────────────────────────┘

Ví dụ 1: Tìm Coffee rẻ
  Category: Coffee
  Min Capacity: 400
  Price: $3.00 - $4.50
  → [Search]

Ví dụ 2: Tìm Cocoa bất kỳ
  Category: Cocoa
  (để rỗng min capacity & price)
  → [Search]

Ví dụ 3: Tìm Pepper FDA-approved
  Category: Pepper
  FDA Status: Approved
  → [Search]
```

### Bước 4: Xem Kết Quả
```
Kết quả hiện ra:

┌──────────────────────────────────────────────┐
│ RESULTS (2 matched)                          │
├──────────────────────────────────────────────┤
│                                              │
│ 1. ABC COFFEE TRADING                        │
│    📧 Email: sales@abccoffee.com             │
│    ☎️  Phone: +84 912 345 678               │
│                                              │
│    PRODUCTS:                                 │
│    ✓ Arabica Beans                          │
│      • Capacity: 500 kg/month               │
│      • Price: $4.50/kg                      │
│      • Min Order: 100 kg                    │
│      • FDA: ✓ FDA-ABC-2024                  │
│                                              │
│    [📧 Contact] [Create Deal] [Details]    │
│                                              │
│ ─────────────────────────────────────────── │
│                                              │
│ 2. DEF GLOBAL COFFEE                         │
│    📧 Email: export@defcoffee.com            │
│    ☎️  Phone: +84 987 654 321               │
│                                              │
│    PRODUCTS:                                 │
│    ✓ Arabica Grade-A                       │
│      • Capacity: 600 kg/month               │
│      • Price: $4.30/kg                      │
│      • Min Order: 50 kg                     │
│      • FDA: ✓ FDA-DEF-2024                  │
│                                              │
│    [📧 Contact] [Create Deal] [Details]    │
│                                              │
└──────────────────────────────────────────────┘

Database query đã chạy:
  SELECT * FROM client_products
  WHERE category = 'coffee'
    AND monthly_capacity >= 400
    AND unit_price <= 5.50
    AND status = 'active'
  ORDER BY unit_price ASC
```

### Bước 5: Hành Động

#### **Option 1: Gọi/Email Direct**
```
Click [📧 Contact]
→ Xem email & phone
→ Copy vào Outlook / WhatsApp
→ Liên hệ trực tiếp supplier
```

#### **Option 2: Tạo Deal Ngay (RECOMMEND)**
```
Click [Create Deal]
→ Dialog mở lên:

┌────────────────────────────────────┐
│ Tạo Opportunity Mới                │
├────────────────────────────────────┤
│ Buyer *: [▼ Select buyer__]       │
│ Supplier: ABC Coffee Trading (auto)│
│ Product: Arabica Beans (auto)     │
│ Quantity *: [1000______] kg        │
│ Unit Price: $4.50/kg (auto)        │
│ Status: [▼ Lead_________]         │
│ [Hủy] [Tạo Opportunity]           │
└────────────────────────────────────┘

Điền:
  ✓ Chọn Buyer từ dropdown
  ✓ Quantity = 1000 kg
  ✓ Click [Tạo Opportunity]

Backend xử lý:
  1. Create row in opportunities table
  2. Link product_id = Arabica Beans
  3. Link supplier_id = ABC Trading
  4. Link buyer_id = XYZ Cafe Corp
  5. Status = 'lead'

Kết quả:
  ✅ Deal tạo thành công!
  ✅ Hiện trên Pipeline
  ✅ Product được track cụ thể
```

#### **Option 3: Xem Chi Tiết Đầy Đủ**
```
Click [Details]
→ Xem tất cả:
   • Thông tin công ty
   • Tất cả sản phẩm của họ
   • Hình ảnh chứng chỉ
   • Deal history
   • Activity log
```

---

## DATABASE LIÊN KẾT

### Trước khi Product Discovery:
```
profiles (Company info)
├─ id: user-123
├─ company_name: "ABC Coffee Trading"
└─ email: "john@abccoffee.com"
    │
    └─→ opportunities (Admin knows this company sells coffee)
        ├─ supplier_id: user-123
        ├─ description: "Coffee - chưa biết loại/lượng/giá"
        └─ (admin phải gọi điện hỏi tiếp)
```

### Sau khi Product Discovery:
```
profiles (Company info)
├─ id: user-123
├─ company_name: "ABC Coffee Trading"
└─ email: "john@abccoffee.com"
    │
    ├─→ client_products (SỰ CHI TIẾT!)
    │   ├─ Arabica Beans: 500kg/month @ $4.50/kg ← LIÊN KẾT
    │   ├─ Robusta Beans: 300kg/month @ $3.80/kg
    │   └─ Coffee Powder: 200kg/month @ $5.00/kg
    │
    └─→ opportunities (LIÊN KẾT ĐẾN PRODUCT CỤ THỂ)
        ├─ supplier_id: user-123
        ├─ product_id: prod-001 (Arabica Beans) ← LINK!
        ├─ quantity: 1000kg
        └─ unit_price: $4.50 (từ product)
```

---

## WORKFLOW DIAGRAM

```
┌─────────────────┐
│ CLIENT Login    │
└────────┬────────┘
         │
         ├─→ Click "Sản Phẩm" (📦) on sidebar
         │
         ├─→ /client/products
         │
         ├─→ Click "+ Thêm Sản Phẩm"
         │
         ├─→ Fill Form:
         │    • Name: "Arabica Beans"
         │    • Category: "Coffee"
         │    • Capacity: 500 kg
         │    • Price: $4.50/kg
         │
         ├─→ Click "Lưu Sản Phẩm"
         │
         ├─→ INSERT into client_products
         │    status = 'active'
         │
         └─→ ✅ Product saved!
             ✅ Admin có thể tìm!


┌──────────────────┐
│ ADMIN Login      │
└────────┬─────────┘
         │
         ├─→ Click "Sản Phẩm" (📦) on sidebar
         │
         ├─→ /admin/products
         │
         ├─→ Option A: Type "Arabica" in search box
         │    OR
         │    Option B: Set filters (Category, Price, Capacity)
         │
         ├─→ Click [🔍 Search]
         │
         ├─→ SELECT from client_products
         │    WHERE status = 'active'
         │      AND (filters match)
         │
         ├─→ ✅ Results: 2-3 suppliers match
         │
         ├─→ Click [Create Deal]
         │
         ├─→ Dialog mở, auto-fill:
         │    • Supplier: ABC Coffee Trading
         │    • Product: Arabica Beans
         │    • Price: $4.50/kg
         │
         ├─→ Select Buyer & Quantity
         │
         ├─→ Click "Tạo Opportunity"
         │
         ├─→ INSERT into opportunities
         │    product_id linked ✓
         │
         └─→ ✅ Deal created!
             ✅ Pipeline updated!
             ✅ Product tracked!
```

---

## TÓML: THỜI GIAN CHÍNH XÁC

| Hành động | Thời gian | Ai làm |
|-----------|-----------|---------|
| Client thêm 1 sản phẩm | 3-5 phút | Client |
| Admin tìm kiếm sản phẩm | 1-2 phút | Admin |
| Admin tạo deal từ search | 1 phút | Admin |
| **TOTAL:** Từ sản phẩm → deal | **5-8 phút** | Cả hai |

**So sánh:**
- Trước: 2-3 giờ (gọi điện, chờ callback)
- Sau: 5-8 phút (search + create deal)
- **Improvement: 95% faster!** 🚀

---

## ✅ CHECKLIST: SẴN SÀNG CHƯA?

- [x] Client có thể add products? ✓ /client/products ready
- [x] Admin có thể search? ✓ /admin/products ready
- [x] Sidebar có menu? ✓ "Sản Phẩm" (📦) added
- [x] Database schema? ✓ Migration scripts ready
- [x] Documentation? ✓ 9 files complete
- [x] Security? ✓ RLS configured

**Status: 🟢 READY TO DEPLOY!**

---

## 🆘 NẾUÔCÓ VẤN ĐỀ?

| Vấn đề | Giải pháp |
|--------|----------|
| Client không tìm thấy menu | Refresh page, clear cache |
| Admin tìm không ra sản phẩm | Check status = "active" |
| Sản phẩm lưu không thành công | Kiểm tra các trường bắt buộc |
| Search chậm | Bình thường nếu 500+ products |

---

*Đó là toàn bộ quy trình!* 🎉

Client nhập → Database lưu → Admin tìm → Create deal ✓
