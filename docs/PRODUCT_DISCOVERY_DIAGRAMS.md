# Sơ đồ minh hoạ: Giải pháp Product Discovery

---

## 📊 1. Tình huống hiện tại (Vấn đề)

```
┌────────────────────────────────────────────────────────────────┐
│                        HỆ THỐNG HIỆN TẠI                       │
└────────────────────────────────────────────────────────────────┘

BUYER (Mỹ):
  "Tôi cần tìm nhà cung cấp cà phê Arabica, 500kg/tháng"
         │
         │ INQUIRY
         ▼
    ┌─────────────────┐
    │   ADMIN (ESH)   │
    │                 │
    │ Database Query: │
    │ SELECT * FROM   │
    │ profiles        │
    │ WHERE role=     │
    │ 'client' AND    │
    │ industry=       │
    │ 'coffee'        │
    └────────┬────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ RESULT: 15 công ty (ngành coffee) │
    │ • Công ty Lê Hùng                │
    │ • Coffee Export Co.              │
    │ • Farmer Group 123               │
    │ • ...                            │
    │                                  │
    │ ❌ KHÔNG BIẾT ai cung cấp        │
    │    Arabica cụ thể!               │
    │                                  │
    │ ❌ KHÔNG BIẾT ai có sản lượng     │
    │    500kg/tháng!                  │
    │                                  │
    │ ❌ KHÔNG BIẾT ai bán giá bao      │
    │    nhiêu!                        │
    └──────────────────────────────────┘
```

### ❌ Vấn đề:
- Database chỉ lưu `industry: "coffee"` (TEXT duy nhất, quá chung chung)
- Không có danh sách **cụ thể** sản phẩm mỗi client cung cấp
- Admin phải thủ công liên hệ từng client để hỏi

---

## 🎯 2. Giải pháp: Thêm bảng `client_products`

```
┌────────────────────────────────────────────────────────────────┐
│                    KIẾN TRÚC ĐƯỢC CẢI THIỆN                   │
└────────────────────────────────────────────────────────────────┘

DATABASE SCHEMA:

┌──────────────────┐
│   profiles       │  (Client)
│ ────────────     │
│ id (PK)          │
│ email            │
│ company_name     │
│ industry         │
│ fda_reg_number   │
│ ...              │
└────────┬─────────┘
         │ 1
         │
         │ N
         ▼
┌──────────────────────────────┐
│    client_products (NEW)     │  ← Solution!
│ ──────────────────────────   │
│ id (PK)                      │
│ client_id (FK)               │  Links to client
│ product_name                 │  "Cà phê Arabica"
│ product_code                 │  "ARB-001"
│ category                     │  "coffee"
│ subcategory                  │  "arabica"
│ description                  │
│ hs_code                      │
│ unit_of_measure              │  "kg"
│ min_unit_price               │  USD 3.50
│ max_unit_price               │  USD 4.80
│ monthly_capacity_units       │  500 (kg/month)
│ status                       │  "active" / "inactive"
│ created_at                   │
│ updated_at                   │
└──────────────────────────────┘
```

---

## 🔍 3. Query mới (Tìm kiếm sản phẩm)

### ❌ Cách cũ:
```sql
-- Chỉ biết ngành "coffee"
SELECT * FROM profiles 
WHERE role = 'client' AND industry = 'coffee';
-- Kết quả: 15 công ty, nhưng không biết ai cung cấp gì!
```

### ✅ Cách mới:
```sql
-- Tìm sản phẩm cụ thể + Client cung cấp
SELECT 
  cp.id AS product_id,
  cp.product_name,
  cp.category,
  cp.subcategory,
  cp.monthly_capacity_units,
  cp.min_unit_price,
  cp.max_unit_price,
  p.id AS client_id,
  p.company_name,
  p.email,
  p.fda_registration_number
FROM client_products cp
JOIN profiles p ON cp.client_id = p.id
WHERE 
  cp.category = 'coffee'
  AND cp.subcategory = 'arabica'
  AND cp.monthly_capacity_units >= 500
  AND cp.status = 'active'
ORDER BY cp.max_unit_price ASC;

-- RESULT:
-- ┌──────────────────┬────────────────┬────────────────┐
-- │ Product          │ Capacity       │ Client         │
-- ├──────────────────┼────────────────┼────────────────┤
-- │ Arabica Premium  │ 1000 kg/month  │ Công ty Lê Hùng│
-- │ Arabica Grade A  │ 750 kg/month   │ Coffee Export  │
-- │ Arabica Single   │ 500 kg/month   │ Farmer Group   │
-- └──────────────────┴────────────────┴────────────────┘
```

---

## 🏗️ 4. Data Model: Client vs Product vs Opportunity

```
                    CURRENT DESIGN
                        ▼
┌─────────────┐                ┌──────────────┐
│  profiles   │◄───────────────│ opportunities│
│  (Client)   │  client_id     │ (Buyer Link) │
│             │                │              │
│ company_name│                │ lead_id      │
│ industry    │                │ stage        │
└─────────────┘                │ products_    │
                               │ interested   │
                               │ (TEXT)       │
                               └──────────────┘
                                    │
                                    │ lead_id
                                    ▼
                                ┌──────────────┐
                                │    leads     │
                                │ (Buyer info) │
                                │              │
                                │ company_name │
                                │ contact_info │
                                └──────────────┘


                    IMPROVED DESIGN (WITH client_products)
                             ▼

┌──────────────┐
│   profiles   │
│  (Client)    │
│              │
│ company_name │
│ industry     │
└──────┬───────┘
       │ 1:N
       │
       ▼
┌────────────────────────┐
│ client_products (NEW)  │◄──┐
│                        │   │
│ product_name           │   │
│ category               │   │
│ subcategory            │   │
│ monthly_capacity       │   │
│ min_unit_price         │   │ Can reference
│ max_unit_price         │   │ specific product
│ status                 │   │
└────────┬───────────────┘   │
         │                   │
         │ product_id        │
         │                   │
         ▼                   │
    ┌─────────────────────────────┐
    │    opportunities (Updated)   │
    │                             │
    │ client_id ──► (which client) │
    │ lead_id ──────► (which buyer) │
    │ client_product_id ──────────┘ (which product)
    │                             │
    │ stage                       │
    │ ...                         │
    └─────────────────────────────┘
         │
         │ lead_id
         ▼
    ┌─────────────┐
    │   leads     │
    │  (Buyer)    │
    └─────────────┘
```

---

## 👥 5. User Journey: Client Setup Products

```
┌─────────────────────────────────────────────────────────────┐
│          CLIENT PORTAL: PRODUCT MANAGEMENT                  │
└─────────────────────────────────────────────────────────────┘

Step 1: Client Login
      │
      ▼
   ┌────────────────────┐
   │ /client/products   │
   │ (List page)        │
   │                    │
   │ [+ Add Product]    │◄──── Click to add
   │ [+ Bulk Import]    │◄──── Or import CSV
   │                    │
   │ My Products:       │
   │ ─────────────────  │
   │ ☑ Arabica Grade A  │ Status: Active
   │ ☑ Cacao Fermento   │ Status: Active
   │ ☐ Instant Coffee   │ Status: Inactive
   │ 3 products total   │
   └────────────────────┘
           │
           │ Click [+ Add Product]
           ▼
   ┌─────────────────────────────┐
   │   ADD PRODUCT FORM          │
   │                             │
   │ Product Name:               │
   │ [___ Arabica Grade A _____] │
   │                             │
   │ Product Code (SKU):         │
   │ [___ ARB-A-001 ___________] │
   │                             │
   │ Category:                   │
   │ [Dropdown] coffee           │
   │                             │
   │ Subcategory:                │
   │ [Dropdown] arabica          │
   │                             │
   │ Description:                │
   │ [____ 100% specialty ... ___│
   │                             │
   │ HS Code:                    │
   │ [___ 0901 __________________│
   │                             │
   │ Unit of Measure:            │
   │ [Dropdown] kg               │
   │                             │
   │ Min Unit Price (USD):        │
   │ [___ 3.50 __________________│
   │                             │
   │ Max Unit Price (USD):        │
   │ [___ 4.80 __________________│
   │                             │
   │ Monthly Capacity (units):    │
   │ [___ 1000 __________________│
   │                             │
   │ Status: ☑ Active ☐ Inactive│
   │                             │
   │       [Save] [Cancel]       │
   └─────────────────────────────┘
           │
           │ Click [Save]
           ▼
   Activity Log:
   ✓ "Arabica Grade A" added by client
   → INSERT INTO client_products (...)
   → INSERT INTO activities (action_type='client_product_added', ...)
```

---

## 🔎 6. Admin Dashboard: Product Search

```
┌─────────────────────────────────────────────────────────┐
│      ADMIN DASHBOARD: BUYER INQUIRY → PRODUCT MATCH    │
└─────────────────────────────────────────────────────────┘

Step 1: Buyer inquiry arrives
      │
      ▼
   ┌─────────────────────────────────────┐
   │  [Buyer Inquiry Modal]              │
   │  "I need Arabica coffee, 500kg min"  │
   │                                     │
   │  [Search Products]  [Filter]        │
   └──────────┬──────────────────────────┘
              │
              │ Click [Search Products] or [Filter]
              ▼
   ┌────────────────────────────────────┐
   │ SEARCH/FILTER BAR                  │
   │                                    │
   │ Category: [coffee       ] ▼         │
   │ Subcategory: [arabica  ] ▼         │
   │ Min Capacity: [500     ] kg        │
   │ Price Range: [3.00 - 5.00] USD     │
   │ Status: ☑Active ☐Inactive         │
   │                                    │
   │              [Search] [Reset]      │
   └────────────────────────────────────┘
              │
              ▼
   ┌────────────────────────────────────────────────────┐
   │  SEARCH RESULTS (3 matches)                        │
   │                                                    │
   │  ┌─────────────────────────────────────────────┐  │
   │  │ ✓ Arabica Premium (ARB-001)                │  │
   │  │   Client: Công ty Lê Hùng                  │  │
   │  │   Capacity: 1000 kg/month                  │  │
   │  │   Price: USD 3.80 - USD 4.50               │  │
   │  │   FDA: .... valid ✓                        │  │
   │  │   [View Details] [Contact Client]          │  │
   │  └─────────────────────────────────────────────┘  │
   │                                                    │
   │  ┌─────────────────────────────────────────────┐  │
   │  │ ✓ Arabica Grade A (ARB-A-001)              │  │
   │  │   Client: Coffee Export Co.                │  │
   │  │   Capacity: 750 kg/month                   │  │
   │  │   Price: USD 3.50 - USD 4.20               │  │
   │  │   FDA: .... valid ✓                        │  │
   │  │   [View Details] [Contact Client]          │  │
   │  └─────────────────────────────────────────────┘  │
   │                                                    │
   │  ┌─────────────────────────────────────────────┐  │
   │  │ ✓ Arabica Single Origin (ARB-SO)           │  │
   │  │   Client: Farmer Group 123                 │  │
   │  │   Capacity: 500 kg/month                   │  │
   │  │   Price: USD 4.00 - USD 4.80               │  │
   │  │   FDA: .... valid ✓                        │  │
   │  │   [View Details] [Contact Client]          │  │
   │  └─────────────────────────────────────────────┘  │
   └────────────────────────────────────────────────────┘
```

---

## 🌍 7. Optional: Buyer Public Portal

```
┌────────────────────────────────────────────────┐
│     PUBLIC PRODUCT CATALOG (Optional)          │
│     /products/search (No auth required)        │
└────────────────────────────────────────────────┘

Buyer (not logged in):
      │
      ▼
   ┌─────────────────────────────────┐
   │  ESH Product Directory          │
   │  (Browse Vietnamese exports)    │
   │                                 │
   │ [Search] [coffee_________]      │
   │                                 │
   │ FILTERS:                        │
   │ ☑ Coffee                        │
   │ ☐ Cocoa                         │
   │ ☐ Cashew                        │
   │ ☐ Pepper                        │
   │                                 │
   │ Subcategory:                    │
   │ ☑ Arabica ☑ Robusta ☐ Instant │
   │                                 │
   │ Min Capacity: [100] kg/month    │
   │                                 │
   │       [Search]                  │
   └─────────────────────────────────┘
              │
              ▼
   ┌────────────────────────────────────────┐
   │  RESULTS (public view - no email yet)   │
   │                                        │
   │  Arabica Premium                       │
   │  Vietnam - Coffee category             │
   │  Capacity: 1000 kg/month available     │
   │  Price range: 3.80 - 4.50 USD/kg       │
   │                                        │
   │  [Contact Supplier via ESH] ◄──────┐   │
   │                                    │   │
   │  Arabica Grade A                   │   │ Anonymized
   │  Vietnam - Coffee category         │   │ (no direct email)
   │  ...                               │   │
   │                                    │   │
   └────────────────────────────────────────┘
              │
              │ Click [Contact Supplier]
              ▼
   ┌─────────────────────────────────┐
   │  INQUIRY FORM                   │
   │  (Email sent to ESH admin)      │
   │                                 │
   │ Your Name: [________]           │
   │ Your Email: [________]          │
   │ Company: [__________]           │
   │ Message: [__________]           │
   │                                 │
   │   [Submit] [Cancel]             │
   └─────────────────────────────────┘
              │
              │ ESH admin reviews
              │ → Match with Client
              │ → Create Opportunity
              ▼
```

---

## 📋 8. Data Flow: From Client Products → Deal

```
┌────────────────────────────────────────────────────────────┐
│         FULL DATA FLOW: CLIENT SETUP → CLOSING            │
└────────────────────────────────────────────────────────────┘

[1] CLIENT SETUP PHASE
    ─────────────────
    Client logs in
         │
         ▼
    Add Products:
    • Product_ID: P-001
      client_id: C-123
      name: "Arabica Grade A"
      capacity: 500 kg/month
         │
         ▼
    Table: client_products
    ┌───────────────────────────────┐
    │ id: UUID                      │
    │ client_id: C-123              │
    │ product_name: "Arabica Grade A"
    │ monthly_capacity: 500         │
    │ ...                           │
    └───────────────────────────────┘


[2] BUYER INQUIRY PHASE
    ──────────────────
    Buyer: "Need Arabica, 300kg"
         │
         ▼
    Admin searches:
    SELECT * FROM client_products
    WHERE category='coffee' AND subcategory='arabica'
    AND monthly_capacity >= 300
         │
         ▼
    Result: Found C-123 (Công ty Lê Hùng)
    Admin decides to create opportunity


[3] OPPORTUNITY CREATION
    ──────────────────
    Admin creates:
    Table: opportunities
    ┌─────────────────────────────┐
    │ id: O-456                   │
    │ client_id: C-123            │
    │ lead_id: L-789              │
    │ client_product_id: P-001 ◄──┼─── NEW FIELD
    │ stage: "new"                │
    │ ...                         │
    └─────────────────────────────┘


[4] DEAL CLOSING PHASE
    ──────────────────
    Admin creates deal:
    Table: deals
    ┌─────────────────────────────┐
    │ id: D-999                   │
    │ opportunity_id: O-456       │
    │ product_id: P-001 ◄─────────┼─── Track which product
    │ invoice_value: USD 3000     │
    │ commission_amount: USD 150  │
    │ stage: "won"                │
    │ ...                         │
    └─────────────────────────────┘
```

---

## 🔐 9. RLS Policy: Who sees what?

```
┌─────────────────────────────────────┐
│  RLS POLICIES FOR client_products    │
└─────────────────────────────────────┘

CLIENT (role='client'):
  ├─ Can SELECT own products (client_id = auth.uid())
  ├─ Can INSERT/UPDATE/DELETE own products
  └─ Cannot see other clients' products

ADMIN / STAFF (role='admin' or 'staff'):
  ├─ Can SELECT all products
  ├─ Can INSERT/UPDATE/DELETE any product
  └─ Can filter by category, capacity, etc.

PUBLIC / UNAUTHENTICATED:
  ├─ Can SELECT products WHERE status='active'
  ├─ Via public endpoint /api/products/search
  └─ Cannot see inactive products or internal prices

Example SQL:

-- Client view
SELECT * FROM client_products
WHERE client_id = auth.uid()
  AND status IN ('active', 'inactive');

-- Admin view
SELECT * FROM client_products
WHERE EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid() AND role IN ('admin', 'staff')
);

-- Public view
SELECT 
  product_name, category, subcategory,
  monthly_capacity_units, unit_of_measure,
  (min_unit_price + max_unit_price) / 2 AS avg_price
FROM client_products
WHERE status = 'active'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = client_id AND role = 'client'
  );
```

---

## 📈 10. Reporting Benefits

```
Sau khi implement:

REPORTS ENABLE:

✓ Product Sourcing Report
  "Bao nhiêu công ty cung cấp Arabica?"
  → Query: SELECT COUNT(DISTINCT client_id) 
           FROM client_products WHERE category='coffee'

✓ Capacity Planning
  "Tổng sản lượng Arabica/tháng?"
  → SELECT SUM(monthly_capacity_units) FROM client_products 
    WHERE category='coffee' AND status='active'

✓ Price Comparison
  "Ai có giá Arabica tốt nhất?"
  → SELECT client_id, avg(min_unit_price) 
    FROM client_products GROUP BY client_id

✓ Lead Matching (Automated)
  "Buyer X cần sản phẩm Y → suggest Client Z"

✓ Audit Trail
  "Ai thêm sản phẩm gì, khi nào?"
  → activities table: action_type='client_product_added'
```

---

## 🎯 Summary

| Trước (Problem) | Sau (Solution) |
|-----------------|----------------|
| Chỉ biết client ngành "coffee" (15 công ty) | Biết chính xác ai cung cấp "Arabica Grade A", 500kg/tháng |
| Phải thủ công hỏi client | Admin tìm kiếm tự động trong 5 giây |
| Không biết giá, sản lượng | Lưu trữ chi tiết: giá, capacity, HS code |
| Không audit trail | Ghi lại ai thêm/sửa sản phẩm khi nào |
| Không public portal | Optional: Buyer có thể duyệt sản phẩm công khai |

