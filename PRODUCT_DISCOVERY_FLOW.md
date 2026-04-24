# 🎯 Product Discovery - Quy Trình Hoạt Động (Visual)

## FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCT DISCOVERY SYSTEM                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────┐                    ┌─────────────────────┐
│                     │                    │                     │
│  CLIENT SIDE        │                    │  ADMIN SIDE         │
│  (Nhà Cung Cấp)    │                    │  (Người Tìm Kiếm)   │
│                     │                    │                     │
└─────────────────────┘                    └─────────────────────┘
        │                                           │
        │ 1️⃣ REGISTER PRODUCTS                      │
        │                                           │
        │ /client/products                          │
        │   ├─ [+ Add Product]                      │
        │   │  ├─ Name: "Arabica Beans"             │
        │   │  ├─ Category: Coffee                  │
        │   │  ├─ Capacity: 500 kg/month            │
        │   │  ├─ Price: $4.50/kg                   │
        │   │  └─ [SAVE]                            │
        │   │      ↓                                │
        │   │   ✓ Status = Active                   │
        │   │                                       │
        │   ├─ Product List                         │
        │   │  ├─ Arabica Beans (Active)            │
        │   │  ├─ [Edit] [Delete]                   │
        │   │  └─ Robusta Beans (Active)            │
        │   │      [Edit] [Delete]                  │
        │   │                                       │
        │   └─ Export PDF                           │
        │                                           │
        ├────────────────→ DATABASE ←───────────────┤
        │              client_products              │
        │           (Dữ liệu sản phẩm)              │
        │                                           │
        │                                    2️⃣ SEARCH PRODUCTS
        │                                           │
        │                                    /admin/products
        │                                      ├─ Quick Search
        │                                      │  Input: "Arabica"
        │                                      │    ↓
        │                                      │  Show all matching
        │                                      │
        │                                      ├─ Advanced Filter
        │                                      │  Category: Coffee
        │                                      │  Capacity: 500+ kg
        │                                      │  Price: < $5/kg
        │                                      │    ↓
        │                                      │  [🔍 Search]
        │                                      │    ↓
        │                                      │  2-3 suppliers
        │                                      │
        │                                      └─ Results List
        │                                         ├─ Supplier Name
        │                                         ├─ Email & Phone
        │                                         ├─ Product Details
        │                                         ├─ FDA Status
        │                                         └─ Actions:
        │                                            [Contact]
        │                                            [Create Deal]
        │                                            [Details]
        │                                           │
        │                                    3️⃣ CREATE OPPORTUNITY
        │                                           │
        │                                    [Create Deal] 
        │                                           ↓
        │                                    Dialog mở lên
        │                                      ├─ Buyer: XYZ Corp
        │                                      ├─ Supplier: ABC Trading (auto)
        │                                      ├─ Product: Arabica Beans (auto)
        │                                      ├─ Quantity: 1000 kg
        │                                      └─ [Create Opportunity]
        │                                           ↓
        │                                    opportunities table
        │                                      product_id linked ✓
        │
        └────────────────→ DATABASE ←───────────────┘
                       opportunities
                    (Deal được liên kết)
```

---

## STEP-BY-STEP WORKFLOW

### STEP 1: CLIENT Đăng Ký Sản Phẩm

```
┌─────────────────────────────────────────┐
│ CLIENT đăng nhập                        │
│ → Sidebar: click "Sản Phẩm" (📦)       │
│ → URL: /client/products                 │
│ → Click [+ Thêm Sản Phẩm]              │
│                                         │
│ FORM MỞ LÊN:                           │
│ ┌────────────────────────────────────┐ │
│ │ *Tên Sản Phẩm: Arabica Beans      │ │
│ │ *Danh Mục: Coffee                 │ │
│ │ *Sản Lượng: 500 kg/month          │ │
│ │ *Đơn Hàng Tối Thiểu: 100 kg       │ │
│ │ *Giá: $4.50/kg                    │ │
│ │ ○ Packaging: 25kg bags            │ │
│ │ ○ Xuất Xứ: Vietnam                │ │
│ │ ○ Chứng Chỉ: [Upload FDA.pdf] ✓  │ │
│ │ [Hủy] [Lưu Sản Phẩm]             │ │
│ └────────────────────────────────────┘ │
│       ↓ Click [Lưu Sản Phẩm]          │
│       ↓                                │
│    ✅ Thông báo: "Sản phẩm đã lưu!"   │
│    ✅ Status = Active                  │
└─────────────────────────────────────────┘
   ↓
   DATABASE INSERT:
   client_products {
     id: "prod-001",
     client_id: "user-123",
     name: "Arabica Beans",
     category: "coffee",
     monthly_capacity: 500,
     unit_price: 4.50,
     status: "active"
   }
```

### STEP 2: ADMIN Tìm Kiếm Sản Phẩm

```
┌─────────────────────────────────────────┐
│ ADMIN đăng nhập                         │
│ → Sidebar: click "Sản Phẩm" (📦)       │
│ → URL: /admin/products                  │
│                                         │
│ OPTION A: QUICK SEARCH                 │
│ ┌────────────────────────────────────┐ │
│ │ 🔎 Search: [Arabica_______]       │ │
│ │    [🔍 Search]                     │ │
│ └────────────────────────────────────┘ │
│       ↓                                │
│    QUERY:                              │
│    SELECT * FROM client_products       │
│    WHERE name ILIKE '%Arabica%'        │
│    AND status = 'active'               │
│                                         │
│ OPTION B: ADVANCED FILTER              │
│ ┌────────────────────────────────────┐ │
│ │ Category: [Coffee_______▼]         │ │
│ │ Min Capacity: [400______] kg/month │ │
│ │ Price Range: [$3.00 - $5.50]      │ │
│ │ FDA Status: [All_______▼]         │ │
│ │ [🔍 Tìm Kiếm]                    │ │
│ └────────────────────────────────────┘ │
│       ↓                                │
│    QUERY:                              │
│    SELECT * FROM client_products       │
│    WHERE category = 'coffee'           │
│      AND monthly_capacity >= 400       │
│      AND unit_price <= 5.50            │
│      AND status = 'active'             │
│    ORDER BY unit_price ASC             │
└─────────────────────────────────────────┘
   ↓
   ✅ RESULTS (2 MATCHES):
   
   ┌─────────────────────────────────────┐
   │ 1. ABC Coffee Trading               │
   │    Email: john@abccoffee.com        │
   │    Phone: +84 912 345 678           │
   │    📦 Arabica Beans (500kg/month)  │
   │       Price: $4.50/kg               │
   │       Min: 100kg                    │
   │    ✓ FDA Approved                   │
   │    [📧 Contact] [Create Deal]      │
   │                                     │
   │ 2. DEF Global Coffee                │
   │    Email: sales@defcoffee.com       │
   │    Phone: +84 987 654 321           │
   │    📦 Arabica Grade-A (600kg/month)│
   │       Price: $4.30/kg               │
   │       Min: 50kg                     │
   │    ✓ FDA Approved                   │
   │    [📧 Contact] [Create Deal]      │
   └─────────────────────────────────────┘
```

### STEP 3: ADMIN Tạo Deal Từ Kết Quả

```
┌─────────────────────────────────────────┐
│ Khi tìm thấy supplier phù hợp:         │
│ Click [Create Deal]                     │
│                                         │
│ Dialog mở lên:                         │
│ ┌────────────────────────────────────┐ │
│ │ Tạo Opportunity Mới                │ │
│ ├────────────────────────────────────┤ │
│ │ Buyer *: [XYZ Cafe Corporation__▼]│ │
│ │ Supplier: ABC Coffee Trading (auto)│ │
│ │ Product: Arabica Beans (auto)      │ │
│ │ Quantity *: [1000_____] kg         │ │
│ │ Unit Price: $4.50/kg (from product)│ │
│ │ Status: [Lead_____________▼]      │ │
│ │ [Hủy] [Tạo Opportunity]           │ │
│ └────────────────────────────────────┘ │
│       ↓ Click [Tạo Opportunity]       │
│       ↓                                │
│    ✅ Deal được tạo!                  │
└─────────────────────────────────────────┘
   ↓
   DATABASE INSERT:
   opportunities {
     id: "opp-001",
     buyer_id: "buyer-456",
     supplier_id: "user-123",
     product_id: "prod-001",  ← LINKED!
     quantity: 1000,
     unit_price: 4.50,
     status: "lead"
   }
   ↓
   ✓ Deal hiện trên Pipeline
   ✓ Product được track cụ thể
   ✓ Có thể theo dõi sales by product
```

---

## USE CASES - CÁC TÌM KIẾM THƯỜNG GẶP

### Use Case 1: Tìm Coffee Giá Rẻ

```
SCENARIO:
Buyer cần Arabica Coffee, đặt hàng lớn, muốn giá tốt nhất

ADMIN SEARCH:
1. Quick Search: "Arabica"
   OR
   Advanced Filter:
   - Category: Coffee
   - Min Capacity: 500 kg (cho đơn lớn)
   - Price: < $4.80/kg
   
2. Result: 3 suppliers
   ✓ Supplier A: $4.50/kg
   ✓ Supplier B: $4.30/kg ← BEST PRICE
   ✓ Supplier C: $4.70/kg
   
3. Click "Create Deal" cho Supplier B
```

### Use Case 2: Tìm Cocoa Nibs Organic

```
SCENARIO:
Buyer cần Cocoa Nibs Organic, chứng chỉ đầy đủ

ADMIN SEARCH:
1. Advanced Filter:
   - Category: Cocoa
   - Search: "Organic Nibs"
   
2. Result: 2 suppliers
   ✓ Supplier X: Organic cert ✓ $5.20/kg
   ✓ Supplier Y: Organic cert ✓ $5.50/kg
   
3. Click [Details] để xem chứng chỉ
4. Click "Create Deal"
```

### Use Case 3: Tìm Pepper Bất Kỳ

```
SCENARIO:
Buyer cần Pepper bất kỳ loại nào, 100kg/tháng

ADMIN SEARCH:
1. Advanced Filter:
   - Category: Pepper
   - Min Capacity: 100 kg
   
2. Result: 5 suppliers
   ✓ Black Pepper: Supplier A, B
   ✓ White Pepper: Supplier C
   ✓ Green Pepper: Supplier D, E
   
3. Chọn suppliers để liên hệ
```

---

## THỜI GIAN & LỢI ÍCH

### TRƯỚC Product Discovery:
```
Tìm supplier → Gọi điện → Chờ callback → Lặp lại
⏱️ 2-3 giờ per buyer
❌ Có thể quên số điện thoại
❌ Dữ liệu không organize
```

### SAU Product Discovery:
```
Tìm kiếm 30 giây → Xem 3 options → Tạo deal
⏱️ 5 phút per buyer
✅ Tất cả thông tin trong 1 dashboard
✅ Track được ai bán gì, bao nhiêu
✅ Dễ so sánh giá & chất lượng
```

---

## BENEFITS

| Nhóm | Lợi Ích |
|------|---------|
| **ADMIN** | ✓ Tìm supplier nhanh chóng<br>✓ Không phải gọi điện hỏi<br>✓ So sánh giá dễ dàng<br>✓ Track sales by product |
| **CLIENT** | ✓ Đăng ký 1 lần<br>✓ Được Admin tìm thấy<br>✓ Tự quản lý sản phẩm<br>✓ Xóa/sửa dễ dàng |
| **BUSINESS** | ✓ Tăng efficiency 500%<br>✓ Dữ liệu organize<br>✓ Có thể plan inventory<br>✓ Scale lên dễ hơn |

---

## NAVIGATION MAP

```
┌──────────────────┐
│  Vexim Bridge    │
│  Login Page      │
└────────┬─────────┘
         │
    ┌────┴────┐
    │          │
┌───▼──┐   ┌──▼───┐
│CLIENT│   │ADMIN │
│Login │   │Login │
└───┬──┘   └──┬───┘
    │         │
    │         ├─→ /admin/dashboard
    │         ├─→ /admin/clients
    │         ├─→ /admin/products ← NEW!
    │         ├─→ /admin/pipeline
    │         ├─→ /admin/buyers
    │         └─→ ...
    │
    ├─→ /client/dashboard
    ├─→ /client/products ← NEW!
    ├─→ /client/leads
    └─→ /settings
```

---

## KEYBOARD SHORTCUTS (Future)

```
Ctrl+K        - Open product search
Ctrl+P        - Quick product list
Ctrl+Shift+D  - Create deal from product
```

---

**Ready to use!** 🚀

Chỉ cần bấm vào "Sản Phẩm" trên sidebar và bắt đầu! ✨
