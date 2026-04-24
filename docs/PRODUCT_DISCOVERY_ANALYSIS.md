# Phân tích Vấn đề: Client chỉ biết ngành, không rõ sản phẩm cụ thể
**Ngày phân tích:** 2026-04-24  
**Tác giả:** V0 Analysis

---

## 📋 Tóm tắt vấn đề

Hiện tại, khi một **Buyer** (người mua từ Mỹ) hỏi về **một sản phẩm cụ thể** (ví dụ: "Bạn có cà phê rang mộc không?"), **Admin của ESH không có cách nào để:**
1. Biết được **Client nào** cung cấp sản phẩm đó
2. Tra cứu nhanh danh sách **những sản phẩm cụ thể** mà một Client đang cung cấp
3. Liên hệ Client đúng người cho Buyer tương ứng

**Root Cause:** Database chỉ lưu trữ thông tin rất chung chung về Client:
```
profiles (client role):
  - company_name: "Công ty Lê Hùng"
  - industry: "coffee" (TEXT đơn, không chi tiết)
  - fda_registration_number: "..."
```

Không có **danh sách cụ thể sản phẩm** mà mỗi client cung cấp.

---

## 🔍 Kiểm tra hiện tại trong hệ thống

### 1. Bảng `profiles` (Client)
```sql
CREATE TABLE profiles (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT, -- admin, staff, client, ...
  company_name TEXT,
  industry TEXT,         -- ❌ Chỉ 1 trường chung chung
  fda_registration_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP
);
```

**Vấn đề:** `industry` là TEXT duy nhất, không đủ để:
- Phân loại "cà phê" vs "cacao" vs "hạt điều" vs "ớt"
- Liệt kê cụ thể từng sản phẩm mà client cung cấp

### 2. Bảng `leads` 
```sql
CREATE TABLE leads (
  id UUID,
  company_name TEXT,
  contact_person TEXT,
  contact_email TEXT,
  industry TEXT,
  ...
  -- ❌ Không có `products_offered` hoặc danh sách sản phẩm
);
```

**Ghi chú:** Có cột `products_interested` ở bảng `opportunities` nhưng đó là **sản phẩm Buyer quan tâm**, không phải **sản phẩm Client cung cấp**.

### 3. Bảng `opportunities`
```sql
ALTER TABLE opportunities 
  ADD COLUMN products_interested TEXT; -- Đây là của Buyer, không phải Client!
```

---

## 🎯 Giải pháp đề xuất

### Giải pháp 1: **Bảng `client_products` (Recommended)**

**Mục tiêu:** Mỗi Client có thể đăng ký danh sách **sản phẩm cụ thể** mà họ cung cấp.

#### Schema:
```sql
-- Catalog sản phẩm của Client (1-N: 1 client : nhiều products)
CREATE TABLE client_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Tên sản phẩm/mã SKU
  product_name TEXT NOT NULL,
  product_code TEXT,
  
  -- Phân loại thêm
  category TEXT, -- "coffee", "cocoa", "cashew", "pepper", ...
  subcategory TEXT, -- "arabica", "robusta", "instant", ...
  
  -- Thông tin chi tiết
  description TEXT,
  hs_code TEXT, -- Harmonized System code (cải thiện hải quan)
  unit_of_measure TEXT, -- "kg", "lbs", "ton", ...
  
  -- Giá cơ bản (optional)
  min_unit_price DECIMAL(10, 2),
  max_unit_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Khả năng
  monthly_capacity_units INT, -- Sản lượng hàng tháng
  
  -- Trạng thái
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  
  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, product_code)
);

-- Index cho tìm kiếm nhanh
CREATE INDEX idx_client_products_category ON client_products(category);
CREATE INDEX idx_client_products_client_id ON client_products(client_id);
CREATE INDEX idx_client_products_status ON client_products(status);
```

#### RLS Policy:
```sql
ALTER TABLE client_products ENABLE ROW LEVEL SECURITY;

-- Admin/staff can view and manage all products
CREATE POLICY "Admins manage all client products"
  ON client_products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() 
    AND role IN ('admin', 'staff', 'super_admin')
  ));

-- Clients can manage their own products
CREATE POLICY "Clients manage own products"
  ON client_products FOR ALL
  USING (client_id = auth.uid());

-- Buyers (public route) can see active products only
CREATE POLICY "Public can see active products"
  ON client_products FOR SELECT
  USING (status = 'active');
```

---

### Giải pháp 2: **Product Catalog (Tùy chọn thêm)**

Nếu muốn quản lý **centralized product catalog** (để tái sử dụng, tiêu chuẩn hoá):

```sql
-- Danh sách sản phẩm toàn hệ thống (quản lý bởi admin)
CREATE TABLE product_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  hs_code TEXT,
  unit_of_measure TEXT,
  -- ...
);

-- Client chọn từ catalog này
CREATE TABLE client_product_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES product_catalog(id),
  
  -- Client-specific config
  supplier_sku TEXT,
  price_to_client DECIMAL(10, 2),
  monthly_capacity INT,
  
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(client_id, product_id)
);
```

**Ưu điểm:** Tiêu chuẩn hoá, dễ báo cáo, tìm kiếm.  
**Nhược điểm:** Setup phức tạp hơn, cần maintain catalog.

---

## 💡 Quy trình sử dụng (Workflow)

### Cho Client (Onboarding):
```
1. Client đăng ký tài khoản
2. Admin yêu cầu Client điền danh sách sản phẩm → form UI hoặc bulk import
3. Client nhập: "Cà phê Arabica", "Cacao Fermented", "Ớt Tây Ba Lan" vào bảng client_products
4. Mỗi sản phẩm có category, subcategory, giá, sản lượng
5. Trạng thái: active/inactive (tuỳ theo khả năng cung cấp)
```

### Cho Admin (Buyer inquiry):
```
1. Buyer: "Tôi cần tìm nhà cung cấp cà phê Arabica, sản lượng 500 kg/tháng"
2. Admin vào dashboard → tìm kiếm category="coffee", subcategory="arabica"
3. Hệ thống trả về: "Client X", "Client Y", "Client Z"
4. Admin kiểm tra monthly_capacity, status
5. Admin chọn Client phù hợp, tạo Lead/Opportunity
```

### Cho Buyer (Portal - optional):
```
1. Buyer có thể browse công khai danh sách sản phẩm từ tất cả Client (public view)
2. Filter theo: category, subcategory, min_capacity
3. Click → liên hệ Client qua form (nếu muốn self-serve)
```

---

## 📊 Ảnh hưởng đến các bảng khác

### 1. `opportunities` → Thêm referenece sản phẩm:
```sql
ALTER TABLE opportunities 
  ADD COLUMN client_product_id UUID 
  REFERENCES client_products(id) ON DELETE SET NULL;
  
-- Thay vì "products_interested" (TEXT) → sẽ liên kết đến sản phẩm cụ thể
```

### 2. `deals` → Tracking sản phẩm trong hợp đồng:
```sql
ALTER TABLE deals 
  ADD COLUMN product_id UUID REFERENCES client_products(id);
```

### 3. `activities` → Kiểm toán:
```
action_type = 'client_product_added'
action_type = 'client_product_updated'
```

---

## ✅ Checklist triển khai

**Phase 1 — Database & APIs:**
- [ ] Tạo migration 025: `025_client_products_schema.sql`
- [ ] Tạo bảng `client_products` + RLS policies
- [ ] Create Server Actions:
  - `addClientProductAction()`
  - `updateClientProductAction()`
  - `deleteClientProductAction()`
  - `listClientProductsAction()`

**Phase 2 — UI cho Client Portal:**
- [ ] Tạo page `/client/products` → list sản phẩm của mình
- [ ] Component: `ProductList`, `ProductForm` (add/edit)
- [ ] Bulk import CSV: `product_name, category, subcategory, price, capacity`

**Phase 3 — Admin Dashboard:**
- [ ] Product search widget → tìm Client theo sản phẩm
- [ ] Filter sidebar: category, capacity, client
- [ ] View detail Client → xem danh sách sản phẩm

**Phase 4 — Buyer Portal (optional):**
- [ ] Public endpoint `/api/products/search` → danh sách sản phẩm public
- [ ] UI: search/filter/contact form

**Phase 5 — Integration:**
- [ ] Update `opportunities` thêm `client_product_id`
- [ ] Update Lead form → gợi ý sản phẩm dựa trên client
- [ ] Email templates nhắc đến sản phẩm cụ thể

---

## 🔐 Bảo mật & Compliance

| Yêu cầu | Cách xử lý |
|---------|-----------|
| Client chỉ thấy sản phẩm của mình | RLS policy `client_id = auth.uid()` |
| Admin thấy tất cả | RLS policy role gate |
| Buyer thấy public products | RLS policy `status = 'active'` + public endpoint |
| Audit trail | Activity log: `client_product_added`, `client_product_updated` |
| Dữ liệu nhạy (giá internal) | Có trường `internal_notes` (chỉ admin xem) |

---

## 🚀 Ưu tiên & Timeline

| Giai đoạn | Công việc | Thời gian ước tính |
|----------|----------|------------------|
| Phase 1 | Schema + RLS + Server Actions | 2-3 ngày |
| Phase 2 | Client Portal UI | 2-3 ngày |
| Phase 3 | Admin Dashboard | 2-3 ngày |
| Phase 4 | Buyer Portal (optional) | 1-2 ngày |
| Phase 5 | Integration + Testing | 2-3 ngày |

**Tổng:** ~10-14 ngày cho full feature

---

## 📝 Kết luận

**Vấn đề hiện tại:** Hệ thống chỉ lưu "ngành" chung chung → admin không biết Client nào cung cấp sản phẩm cụ thể.

**Giải pháp:** Tạo bảng `client_products` để mỗi Client đăng ký danh sách sản phẩm chi tiết → Admin và Buyer có thể tìm kiếm dễ dàng.

**Lợi ích:**
✅ Admin tra cứu nhanh: "Cà phê Arabica? → Client X, Y, Z"  
✅ Client quản lý sản phẩm của mình (online catalog)  
✅ Buyer có thể duyệt public products (optional)  
✅ Audit trail đầy đủ  
✅ Mở rộng: pricing, capacity, supplier SKU tracking  

---

## 🔗 Tài liệu liên quan

- `docs/BUSINESS_FLOW_AUDIT.md` — Tổng quan hệ thống
- `scripts/002_phase2_schema.sql` — Schema hiện tại
- `app/admin/clients/` — UI quản lý Client
