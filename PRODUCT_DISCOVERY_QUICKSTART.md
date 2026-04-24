# Product Discovery System - Quick Start

## 30-Second Overview

Admin searches for suppliers → Gets exact matches → Contacts supplier directly

**Before:** "Coffee suppliers" = 15 companies (need to call each one)  
**After:** "Arabica, 500kg/month, <$5/kg" = 2-3 exact matches (5 seconds)

---

## Get Started in 3 Steps

### Step 1: Deploy Migrations
```bash
# In Supabase SQL Editor, run:
scripts/023_client_products_schema.sql
scripts/024_integrate_client_products_to_opportunities.sql
```

### Step 2: Deploy Code
```bash
git push origin main
# Vercel auto-deploys
```

### Step 3: Test
- **Client:** Visit `/client/products` and add a product
- **Admin:** Visit `/admin/products` and search
- **API:** Test `/api/products/search?category=coffee`

---

## For Clients: Add Your Products

1. Login to client portal
2. Click **Menu → Products** or visit `/client/products`
3. Click **"+ Add Product"**
4. Fill out:
   - **Product Name:** "Arabica Grade A"
   - **Category:** Coffee
   - **Subcategory:** Arabica
   - **Capacity:** 1000 kg/month
   - **Price:** $3.50 - $4.80/kg
5. Click **"Save"**
6. Product is now searchable by admin

---

## For Admin: Find Suppliers

1. Login to admin panel
2. Click **Products** in sidebar or visit `/admin/products`
3. **Quick Search:** Type product name
4. **Advanced Filters:**
   - Category: Coffee
   - Capacity: 500+ kg/month
   - Max Price: $5.00/kg
5. Click **"Search"**
6. View matches:
   - Product details
   - Supplier company name & email
   - FDA registration status
7. Click to expand supplier info
8. Contact directly to create opportunity

---

## Database Changes

### New Table: `client_products`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Product ID |
| client_id | UUID | Which supplier |
| product_name | TEXT | "Arabica Grade A" |
| category | TEXT | "coffee" |
| subcategory | TEXT | "arabica" |
| monthly_capacity_units | INT | 1000 |
| min_unit_price | DECIMAL | 3.50 |
| max_unit_price | DECIMAL | 4.80 |
| status | TEXT | active/inactive |

### Updated Tables

**opportunities** - NEW column:
- `client_product_id` - Links to specific product

**deals** - NEW column:
- `product_id` - Tracks product sold

---

## Search Examples

### Example 1: Coffee Supplier
```
Buyer: "I need Arabica coffee, 500kg minimum, under $5/kg"

Admin search:
- Category: Coffee
- Subcategory: Arabica
- Min Capacity: 500
- Max Price: 5.00

Results: Công ty Lê Hùng (1000kg, $3.50-$4.80)
```

### Example 2: Cocoa Supplier
```
Buyer: "Fermented cocoa beans, 200kg/month"

Admin search:
- Category: Cocoa
- Subcategory: Fermented
- Min Capacity: 200

Results: [matching suppliers]
```

### Example 3: Open Search
```
Admin: "Who supplies cashews?"

Admin search:
- Category: Cashew

Results: [all cashew suppliers]
```

---

## API for Developers

### Public Product Search
```
GET /api/products/search?category=coffee&subcategory=arabica&min_capacity=500

Response:
{
  "success": true,
  "data": [
    {
      "product_name": "Arabica Grade A",
      "category": "coffee",
      "monthly_capacity_units": 1000,
      "min_unit_price": 3.50,
      "profiles": {
        "company_name": "Công ty Lê Hùng",
        "email": "info@lehung.vn"
      }
    }
  ],
  "count": 1
}
```

### Parameters
- `search` - product name/code/description
- `category` - coffee, cocoa, cashew, pepper, spices, fruits, vegetables, grains, other
- `subcategory` - varies by category
- `min_capacity` - minimum units per month
- `min_price` - minimum price USD
- `max_price` - maximum price USD
- `limit` - results per page (default 50)
- `offset` - pagination

---

## File Locations

### Client Portal
- Page: `app/client/products/page.tsx`
- Component: `components/client/client-products-list.tsx`
- Form: `components/client/client-product-dialog.tsx`

### Admin Dashboard
- Page: `app/admin/products/page.tsx`
- Widget: `components/admin/product-search-widget.tsx`

### Backend
- Actions: `app/admin/clients/products-actions.ts`
- API: `app/api/products/search/route.ts`

### Database
- Schema: `scripts/023_client_products_schema.sql`
- Integration: `scripts/024_integrate_client_products_to_opportunities.sql`

### Documentation
- Full Guide: `docs/PRODUCT_DISCOVERY_IMPLEMENTATION.md`
- Summary: `PRODUCT_DISCOVERY_SUMMARY.md`
- This File: `PRODUCT_DISCOVERY_QUICKSTART.md`

---

## Troubleshooting

### Products don't appear in search
**Check:**
- Product status is "active" (not inactive/suspended)
- Your user is admin/staff
- Client profile exists with correct role

### Search returns 0 results
**Check:**
- Category name matches (lowercase: coffee, not Coffee)
- Capacity filter is reasonable
- At least one product exists in database

### Permission denied error
**Check:**
- Admin: Your role should be 'admin' or 'staff'
- Client: You should be editing your own products only

### RLS Policy errors
**Solution:**
- Run migration 023_client_products_schema.sql again
- Verify RLS is enabled in Supabase dashboard

---

## Features by Role

| Feature | Client | Admin | Public |
|---------|--------|-------|--------|
| View own products | ✅ | ✅ | ❌ |
| View all products | ❌ | ✅ | ❌ |
| View active products | ❌ | ❌ | ✅ |
| Add product | ✅ | ✅ | ❌ |
| Edit product | ✅ own | ✅ all | ❌ |
| Delete product | ✅ own | ✅ all | ❌ |
| Search cross-client | ❌ | ✅ | ✅ |
| See supplier email | ❌ | ✅ | ✅ (via API) |
| Filter by price | ❌ | ✅ | ✅ |

---

## Next Steps

1. ✅ Deploy migrations
2. ✅ Deploy code
3. ✅ Test with sample product
4. ✅ Admin search works
5. ⭐ Train clients to add products
6. ⭐ Use for buyer matching
7. ⭐ Monitor activity logs
8. ⭐ Collect feedback for Phase 2

---

## Phase 2 Ideas (Future)

- Bulk CSV import for products
- Product variant tracking (sizes, grades)
- Certification links (organic, fair-trade)
- AI-powered supplier suggestions
- Auto-create opportunities for matches
- Volume-based pricing tiers
- Product sourcing analytics

---

**Need help?** See `docs/PRODUCT_DISCOVERY_IMPLEMENTATION.md` for full details.

**Ready?** Run the migrations and deploy!
