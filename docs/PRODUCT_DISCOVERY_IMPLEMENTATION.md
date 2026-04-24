# Product Discovery System - Implementation Guide

**Date:** April 24, 2026  
**Status:** Complete - Ready for Deployment  
**Phase:** 1-5 Complete

## Overview

This implementation adds a **Product Discovery System** to ESH, enabling:

- **Clients** to register and manage their product catalog
- **Admin** to quickly search for clients by specific products (not just industry)
- **Buyers** (optional) to browse public product directory
- **Full audit trail** of product modifications

### Problem Solved

**Before:** Admin only knows "Client X is in coffee industry" (15 companies match) → Takes hours to find the right supplier.

**After:** Admin searches "Arabica coffee, 500kg/month" → Gets 3 exact matches in 5 seconds.

---

## Implementation Summary

### Phase 1: Database Schema & RLS Setup ✅

**File:** `scripts/023_client_products_schema.sql`

Creates `client_products` table with:
- Product identification (name, code, category, subcategory)
- Product details (description, HS code, unit of measure)
- Pricing & capacity (min/max price, monthly capacity)
- Status tracking (active/inactive/suspended)
- Full audit trail (created_by, created_at, updated_at)

**RLS Policies:**
- Clients can manage their own products only
- Admin/Staff can view and manage all products
- Public can see active products (for public endpoint)

**Indexes:** Category, status, client_id for optimal query performance.

---

### Phase 2: Server Actions & API Routes ✅

#### Server Actions: `app/admin/clients/products-actions.ts`

- `addClientProductAction()` - Create new product
- `updateClientProductAction()` - Edit existing product
- `deleteClientProductAction()` - Remove product
- `listClientProductsAction()` - List client's products with filtering
- `searchClientProductsAction()` - Cross-client product search (admin only)

**Features:**
- Full permission checks (client vs admin)
- Automatic activity logging
- Input validation & error handling

#### API Route: `app/api/products/search/route.ts`

Public endpoint for product discovery:
```
GET /api/products/search?category=coffee&subcategory=arabica&min_capacity=500
```

Returns active products with client details (anonymized for public use).

---

### Phase 3: Client Portal - Product Management UI ✅

#### Page: `app/client/products/page.tsx`

Client-facing product management interface.

#### Component: `components/client/client-products-list.tsx`

- List all products with filtering
- View product details
- Add/edit/delete actions
- Status indicators (active/inactive/suspended)

#### Component: `components/client/client-product-dialog.tsx`

Form for adding/editing products with:
- Basic info (name, code, description)
- Categorization (category, subcategory, HS code)
- Pricing & capacity (unit price range, monthly capacity)
- Status management

**Supported Categories:**
- Coffee (Arabica, Robusta, Instant, Ground, Beans)
- Cocoa (Beans, Fermented, Powder, Butter)
- Cashew (Raw, Roasted, Kernel)
- Pepper (Black, White, Red)
- Spices, Fruits, Vegetables, Grains, Other

**Units:** kg, lbs, ton, piece, box

---

### Phase 4: Admin Dashboard - Product Search Widget ✅

#### Component: `components/admin/product-search-widget.tsx`

Powerful search interface with:

**Quick Search:**
- By product name, code, or description

**Advanced Filters:**
- Category & Subcategory
- Capacity (minimum units per month)
- Price range (min/max USD per unit)
- All active products by default

**Results Display:**
- Product name, code, category
- Capacity & price range
- HS code
- Supplier info (company, email, FDA registration)
- Status badges

#### Page: `app/admin/products/page.tsx`

Dedicated admin page for product discovery.

**URL:** `/admin/products`

**Access:** Admin & Staff only

---

### Phase 5: Integration & Polish ✅

#### Migration: `scripts/024_integrate_client_products_to_opportunities.sql`

**New Columns:**
- `opportunities.client_product_id` - Link opportunity to specific product
- `deals.product_id` - Track which product was sold

**New View:** `client_opportunities_with_products`

Joins opportunities with product details for easy reporting.

**Activity Logging:**
- `client_product_added` - When client adds product
- `client_product_updated` - When client edits product
- `client_product_deleted` - When client removes product

---

## Database Schema

### `client_products` Table

```sql
id                      UUID (PRIMARY KEY)
client_id               UUID (FOREIGN KEY → profiles.id)
product_name            TEXT NOT NULL
product_code            TEXT (UNIQUE with client_id)
category                TEXT
subcategory             TEXT
description             TEXT
hs_code                 TEXT
unit_of_measure         TEXT (default: 'kg')
min_unit_price          DECIMAL(10, 2)
max_unit_price          DECIMAL(10, 2)
currency                TEXT (default: 'USD')
monthly_capacity_units  INT
status                  TEXT (active|inactive|suspended)
created_by              UUID
created_at              TIMESTAMP
updated_at              TIMESTAMP

Indexes:
- client_id (quick client lookup)
- category (filtering by type)
- status (active/inactive filtering)
- (category, status) compound
```

### Relationships

```
profiles (1) ─── (N) client_products
                        │
                        ├─ opportunities (via client_product_id)
                        └─ deals (via product_id)
```

---

## User Workflows

### Client: Adding Products

```
1. Login to /client/products
2. Click "Add Product"
3. Fill form:
   - Product Name: "Arabica Grade A"
   - Category: Coffee
   - Subcategory: Arabica
   - Monthly Capacity: 1000 kg
   - Price Range: $3.50 - $4.80
   - Status: Active
4. Click "Save"
5. Product appears in list
6. Activity logged automatically
```

### Admin: Finding Suppliers for Buyer

```
1. Login to /admin/products
2. Buyer asks: "Need Arabica coffee, 500kg/month, under $5/kg"
3. Enter search parameters:
   - Search: "Arabica" (optional)
   - Category: Coffee
   - Subcategory: Arabica
   - Min Capacity: 500
   - Max Price: 5.00
4. Click "Search"
5. Results: Show matching clients with:
   - Product details
   - Supplier company & email
   - FDA registration status
6. Click supplier to view full details
7. Contact client to create opportunity
```

### Admin: Linking Product to Opportunity

*(Future enhancement - requires UI update)*

When creating/editing opportunity:
1. Select client
2. Auto-suggest products from that client
3. Select specific product
4. Opportunity now tracks `client_product_id`

---

## RLS Security

| User Type | Table | Access |
|-----------|-------|--------|
| Client | Own products | SELECT, INSERT, UPDATE, DELETE |
| Client | Other products | NONE |
| Admin/Staff | All products | SELECT, INSERT, UPDATE, DELETE |
| Public | Active products only | SELECT (via API) |

**Example Query (Client View):**
```sql
SELECT * FROM client_products
WHERE client_id = auth.uid()
```

**Example Query (Admin View):**
```sql
SELECT * FROM client_products
WHERE EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() 
  AND role IN ('admin', 'staff', 'super_admin')
)
```

---

## API Documentation

### Search Products (Public)

```
GET /api/products/search

Query Parameters:
- search (string) - Search in product name/code/description
- category (string) - Filter by category
- subcategory (string) - Filter by subcategory
- min_capacity (number) - Minimum monthly capacity
- min_price (number) - Minimum unit price (USD)
- max_price (number) - Maximum unit price (USD)
- limit (number, default: 50) - Results per page
- offset (number, default: 0) - Pagination offset

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product_name": "Arabica Grade A",
      "category": "coffee",
      "subcategory": "arabica",
      "monthly_capacity_units": 1000,
      "min_unit_price": 3.50,
      "max_unit_price": 4.80,
      "profiles": {
        "company_name": "Công ty Lê Hùng",
        "email": "info@lehung.vn",
        "fda_registration_number": "..."
      }
    }
  ],
  "count": 3,
  "limit": 50,
  "offset": 0
}
```

---

## Deployment Checklist

- [ ] Run migration `023_client_products_schema.sql` in Supabase
- [ ] Run migration `024_integrate_client_products_to_opportunities.sql`
- [ ] Deploy code changes
- [ ] Test client product management at `/client/products`
- [ ] Test admin product search at `/admin/products`
- [ ] Test API at `/api/products/search?category=coffee`
- [ ] Verify RLS policies work correctly
- [ ] Monitor activities table for product-related logs

---

## Future Enhancements

1. **Bulk Import:** CSV import for client products
2. **Product Wizard:** Guided product creation flow
3. **AI-Powered Matching:** Auto-suggest clients for buyer inquiries
4. **Product Variants:** Track SKU variants (sizes, qualities)
5. **Certification Tracking:** Link certifications to products
6. **Pricing Tiers:** Volume-based pricing
7. **Lead Auto-Routing:** Automatically create opportunities for matching requests
8. **Reporting:** Product sourcing, capacity, pricing analytics

---

## File Structure

```
scripts/
├── 023_client_products_schema.sql          (DB schema & RLS)
└── 024_integrate_client_products_to_opportunities.sql

app/
├── admin/
│   ├── clients/products-actions.ts         (Server actions)
│   ├── products/page.tsx                   (Admin search page)
│   └── ...
├── client/
│   ├── products/page.tsx                   (Client products page)
│   └── ...
├── api/
│   └── products/search/route.ts            (Public API)
└── ...

components/
├── admin/
│   └── product-search-widget.tsx           (Admin search widget)
└── client/
    ├── client-products-list.tsx            (Product list)
    ├── client-product-dialog.tsx           (Add/edit form)
    └── ...

docs/
└── PRODUCT_DISCOVERY_IMPLEMENTATION.md     (This file)
```

---

## Support

For questions or issues:
1. Check activity logs for product modifications
2. Review RLS policies in Supabase
3. Test with different user roles (client, admin, staff)
4. Monitor API responses for errors

---

**Implementation Status:** COMPLETE ✅  
**Last Updated:** April 24, 2026  
**Maintenance:** Active
