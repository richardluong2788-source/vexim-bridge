# 📖 Hướng Dẫn Chi Tiết - Product Discovery System

## 🎯 Tổng Quan

Hệ thống Product Discovery giúp bạn:
- **CLIENT (Nhà cung cấp):** Đăng ký sản phẩm của mình một lần, Admin sẽ tìm được
- **ADMIN:** Tìm nhà cung cấp nhanh chóng theo sản phẩm cụ thể thay vì chỉ biết ngành hàng

---

## 👥 PHẦN 1: CLIENT - Đăng Ký Sản Phẩm

### Bước 1: Truy Cập Trang Sản Phẩm

```
1. Đăng nhập vào tài khoản client
2. Trên sidebar trái, nhấp vào: "Sản Phẩm" (icon Package)
   
   Sidebar sẽ hiển thị:
   ┌─────────────────────────┐
   │ 🏠 Dashboard            │
   │ 📦 Sản Phẩm        <--- │ (NEW - Click vào đây)
   │ 📋 Leads                │
   │ ⚙️  Settings            │
   └─────────────────────────┘
```

### Bước 2: Thêm Sản Phẩm Mới

**Màn hình sản phẩm sẽ hiển thị:**

```
┌──────────────────────────────────────────────┐
│ 📦 Sản Phẩm Của Bạn                          │
│ [+ Thêm Sản Phẩm] [Edit] [Delete] [Download]│
├──────────────────────────────────────────────┤
│ Product Name  | Category | Capacity  | Price │
├──────────────────────────────────────────────┤
│ (Chưa có sản phẩm nào)                       │
│ → Click "Thêm Sản Phẩm" để bắt đầu           │
└──────────────────────────────────────────────┘
```

**Click "Thêm Sản Phẩm"** → Dialog mở lên:

```
┌─────────────────────────────────────────┐
│ Thêm Sản Phẩm Mới                       │
├─────────────────────────────────────────┤
│                                         │
│ Tên Sản Phẩm *                          │
│ [Arabica Coffee Beans]                  │
│                                         │
│ Danh Mục *                              │
│ [▼ Coffee ________________]              │
│  ├─ Coffee                              │
│  ├─ Cocoa                               │
│  ├─ Cashew                              │
│  ├─ Pepper                              │
│  ├─ Grain & Cereal                      │
│  └─ Other                               │
│                                         │
│ Sản Lượng/Tháng (kg) *                  │
│ [500]                                   │
│                                         │
│ Đơn Hàng Tối Thiểu (kg) *               │
│ [100]                                   │
│                                         │
│ Giá/Kg (USD) *                          │
│ [4.50]                                  │
│                                         │
│ Cách Đóng Gói                           │
│ [25kg bags, jute sack]                  │
│                                         │
│ Xuất Xứ / Ghi Chú                       │
│ [Premium Arabica from Vietnam,          │
│  SHG grade, harvest 2024]               │
│                                         │
│ Chứng Chỉ FDA (nếu có)                  │
│ [Upload file ...] ✓ FDA-123456          │
│                                         │
│ ────────────────────────────────────── │
│ [Hủy] [Lưu Sản Phẩm]                   │
└─────────────────────────────────────────┘
```

### Bước 3: Điền Thông Tin

**Các trường BẮT BUỘC (*):**
- ✅ Tên Sản Phẩm: "Arabica Coffee Beans"
- ✅ Danh Mục: "Coffee"  
- ✅ Sản Lượng/Tháng: 500
- ✅ Đơn Hàng Tối Thiểu: 100
- ✅ Giá/Kg: 4.50

**Các trường TÙY CHỌN:**
- ○ Cách Đóng Gói
- ○ Xuất Xứ / Ghi Chú
- ○ Chứng Chỉ FDA

### Bước 4: Lưu Sản Phẩm

```
Click [Lưu Sản Phẩm] 
  ↓
✅ Sản phẩm được lưu với status = "Active"
  ↓
Admin sẽ có thể tìm thấy nó!
```

### Bước 5: Quản Lý Sản Phẩm

Sau khi lưu, danh sách sẽ hiển thị:

```
┌──────────────────────────────────────────────┐
│ 📦 Sản Phẩm Của Bạn                          │
│ [+ Thêm Sản Phẩm]                           │
├──────────────────────────────────────────────┤
│ Product Name    | Category | Capacity | Price│
├──────────────────────────────────────────────┤
│ Arabica Beans   | Coffee   | 500 kg   | $4.50│
│                 | Status: Active ✓            │
│                 | [Edit] [Delete]             │
│                                              │
│ Robusta Beans   | Coffee   | 300 kg   | $3.80│
│                 | Status: Active ✓            │
│                 | [Edit] [Delete]             │
└──────────────────────────────────────────────┘
```

**Các hành động:**
- **[Edit]** - Sửa thông tin sản phẩm
- **[Delete]** - Xóa sản phẩm (status = "Inactive")
- **[Download]** - Xuất danh sách PDF

---

## 🔍 PHẦN 2: ADMIN - Tìm Kiếm Sản Phẩm

### Bước 1: Truy Cập Trang Tìm Kiếm

```
1. Đăng nhập vào tài khoản admin
2. Trên sidebar trái, nhấp vào: "Sản Phẩm" (icon Package)
   
   Sidebar sẽ hiển thị:
   ┌─────────────────────────────┐
   │ 📊 Dashboard                │
   │ 👥 Clients                  │
   │ 📦 Sản Phẩm        <----- │ (NEW - Click vào đây)
   │ 📈 Pipeline                 │
   │ 🧑 Buyers                   │
   │ 💬 Activities               │
   │ 🌍 Country Risk             │
   │ 💰 Finance                  │
   │ 👤 Users                    │
   │ ⚙️  Settings                │
   └─────────────────────────────┘
```

### Bước 2: Giao Diện Tìm Kiếm

**Màn hình tìm kiếm sản phẩm:**

```
┌────────────────────────────────────────────────┐
│ 🔍 Tìm Kiếm Sản Phẩm                          │
├────────────────────────────────────────────────┤
│                                                │
│ QUICK SEARCH                                   │
│ ┌──────────────────────────────────────────┐  │
│ │ 🔎 Nhập từ khóa...                       │  │
│ │ (Tên, danh mục, hoặc công ty)            │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ ADVANCED FILTERS                               │
│ ┌──────────────────────────────────────────┐  │
│ │ Category: [▼ Coffee ________]             │  │
│ │ Capacity Min: [400] kg/month              │  │
│ │ Price Range: $[3.00] - $[5.50]            │  │
│ │ FDA Status: [▼ All ________]              │  │
│ │ [🔍 Tìm Kiếm]                            │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ RESULTS (2 matched)                            │
│ ┌──────────────────────────────────────────┐  │
│ │ 1. ABC Coffee Trading                    │  │
│ │    Email: sales@abccoffee.com            │  │
│ │    Phone: +84 912 345 678                │  │
│ │    ✓ Arabica Beans                       │  │
│ │      500 kg/month @ $4.50/kg             │  │
│ │      Min Order: 100kg                    │  │
│ │    ✓ FDA Registered: FDA-ABC-2024        │  │
│ │    [📧 Contact] [Create Deal] [Details]  │  │
│ │                                          │  │
│ │ 2. DEF Global Coffee                     │  │
│ │    Email: export@defcoffee.com           │  │
│ │    Phone: +84 987 654 321                │  │
│ │    ✓ Arabica Grade-A                     │  │
│ │      600 kg/month @ $4.30/kg             │  │
│ │      Min Order: 50kg                     │  │
│ │    ✓ FDA Registered: FDA-DEF-2024        │  │
│ │    [📧 Contact] [Create Deal] [Details]  │  │
│ └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

### Bước 3: Cách Sử Dụng Tìm Kiếm

#### **Cách 1: QUICK SEARCH (Tìm Nhanh)**

```
1. Nhập vào ô tìm kiếm:
   "Arabica"
   
2. Kết quả:
   → Tất cả sản phẩm chứa "Arabica" sẽ hiện
   → Bao gồm cả tên công ty, danh mục
```

#### **Cách 2: ADVANCED FILTERS (Tìm Nâng Cao)**

```
Ví dụ 1: Tìm Coffee có sản lượng lớn, giá rẻ
   ├─ Category: Coffee
   ├─ Capacity Min: 400 kg
   ├─ Price Range: $3.00 - $4.50
   ├─ FDA Status: Approved
   └─ Click [🔍 Tìm Kiếm]
   
Ví dụ 2: Tìm Cocoa bất kỳ
   ├─ Category: Cocoa
   ├─ Capacity Min: (để trống = tất cả)
   ├─ Price Range: (để trống = tất cả)
   └─ Click [🔍 Tìm Kiếm]

Ví dụ 3: Tìm Pepper từ 200-300kg/tháng
   ├─ Category: Pepper
   ├─ Capacity Min: 200
   ├─ Price Range: (để trống)
   ├─ FDA Status: Any
   └─ Click [🔍 Tìm Kiếm]
```

### Bước 4: Xem Chi Tiết Sản Phẩm

Khi tìm thấy nhà cung cấp:

```
Click [Details] → Xem đầy đủ:
├─ Tên công ty
├─ Email & Phone
├─ Tất cả sản phẩm của họ
├─ Hình ảnh chứng chỉ
├─ Tổng số deal đã thực hiện
└─ Activity log
```

### Bước 5: Tạo Deal Từ Kết Quả Tìm Kiếm

```
Khi tìm thấy supplier phù hợp:

[Create Deal] 
  ↓
Dialog mở lên:
├─ Supplier: ABC Coffee Trading (auto fill)
├─ Product: Arabica Beans (auto fill)
├─ Select Buyer: [▼ ____________]
├─ Quantity: [_____] kg
├─ Unit Price: [____] (từ product)
└─ [Create Opportunity]
```

---

## 📊 PHẦN 3: Database Flow

### Cách Dữ Liệu Được Lưu

```
┌─────────────────────────────────────┐
│ profiles                            │
│ (Mỗi client là 1 hàng)             │
│ ├─ id: user-123                    │
│ ├─ company_name: "ABC Trading"     │
│ └─ email: "john@abc.com"           │
└────────────┬────────────────────────┘
             │
             └─→ client_products (N sản phẩm)
                 ├─ id: prod-001
                 ├─ client_id: user-123
                 ├─ name: "Arabica Beans"
                 ├─ category: "coffee"
                 ├─ monthly_capacity: 500
                 ├─ unit_price: 4.50
                 ├─ status: "active"
                 └─ created_at: 2024-04-25
                 
                 ├─ id: prod-002
                 ├─ name: "Robusta Beans"
                 └─ ...
                 
                 └─→ opportunities (Khi admin tạo deal)
                     ├─ id: opp-001
                     ├─ supplier_id: user-123
                     ├─ product_id: prod-001 ← LIÊN KẾT
                     ├─ quantity: 1000
                     └─ status: "lead"
```

### Các Truy Vấn Thường Dùng

**Admin muốn biết:** "Có ai bán Coffee giá < $4/kg không?"

```sql
SELECT cp.*, p.company_name, p.email
FROM client_products cp
JOIN profiles p ON cp.client_id = p.id
WHERE cp.category = 'coffee'
  AND cp.unit_price < 4.00
  AND cp.status = 'active'
ORDER BY cp.unit_price ASC;

RESULT: 2 nhà cung cấp ✓
```

---

## 🎬 VÍ DỤ THỰC TIỄN

### Scenario: Buyer cần Cocoa Nibs 1000kg

**Hiện Tại (Không có Product Discovery):**
```
1. Admin gọi điện client: "Anh có bán cocoa không?"
2. Đợi callback...
3. Lặp lại với 10+ clients khác
4. Mất 2-3 tiếng để tìm được 1-2 suppliers

⏱️ Thời gian: 2-3 giờ
```

**Với Product Discovery:**
```
1. Admin mở /admin/products
2. Search:
   - Category: Cocoa
   - Capacity Min: 1000
   - Price: any
3. [🔍 Tìm Kiếm]
4. ✓ Kết quả: 3 suppliers hiện ra ngay
5. Click [Create Deal] → Tạo opportunity
6. Done!

⏱️ Thời gian: 30 giây
```

---

## ✅ Checklist - Bắt Đầu Sử Dụng

### Week 1 - Setup & Deploy
- [ ] Run migration SQL `023_client_products_schema.sql`
- [ ] Deploy code changes
- [ ] Test: `/client/products` page
- [ ] Test: `/admin/products` page

### Week 2 - Training
- [ ] Hướng dẫn clients thêm sản phẩm
- [ ] Hướng dẫn admin tìm kiếm
- [ ] Test toàn bộ flow

### Week 3 - Go Live
- [ ] Clients bắt đầu đăng ký sản phẩm
- [ ] Admin sử dụng để tìm suppliers
- [ ] Monitor & gather feedback

---

## 🆘 Troubleshooting

### Q: Client đăng ký sản phẩm nhưng Admin tìm không thấy?
**A:** Kiểm tra:
- [ ] Status = "Active" (không phải "Inactive")
- [ ] Category được chọn đúng
- [ ] Nhập đúng từ khóa tìm kiếm

### Q: Sản phẩm cũ vẫn hiện ra?
**A:** Bấm [Delete] để set status = "Inactive", sản phẩm sẽ ẩn khỏi kết quả tìm kiếm

### Q: Làm sao để export danh sách sản phẩm?
**A:** Click [Download] trên trang client products, sẽ xuất PDF

### Q: Có thể sửa sản phẩm sau khi lưu không?
**A:** Có, click [Edit], sửa thông tin rồi [Lưu]

---

## 📞 Support

Nếu có vấn đề:
1. Kiểm tra lại các bước trong hướng dẫn
2. Xem phần Troubleshooting
3. Liên hệ team technical support
