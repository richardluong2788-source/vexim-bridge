# 🎯 Product Discovery - Quick Reference Card

## FOR CLIENT (Nhà Cung Cấp)

### Quick Start
```
1. Login → Click "Sản Phẩm" (📦) on sidebar
2. Click "[+ Thêm Sản Phẩm]"
3. Fill: Name, Category, Capacity, Price
4. Click "[Lưu Sản Phẩm]"
5. Done! Admin can now find you
```

### What Happens?
```
Your sản phẩm is saved with status = "Active"
→ Admin can search & find you
→ Create deals directly from your product
→ You get contacted about sales
```

### Key Buttons
```
[+ Thêm Sản Phẩm]  → Add new product
[Edit]             → Change product info
[Delete]           → Hide product (inactive)
[Download]         → Export product list as PDF
```

### Required Fields (*)
```
✓ Product Name
✓ Category (Coffee, Cocoa, Pepper, etc.)
✓ Monthly Capacity (kg)
✓ Min Order (kg)
✓ Price per Unit (USD)
```

### Optional Fields
```
○ Packaging (e.g., "25kg bags")
○ Origin (e.g., "Vietnam")
○ FDA/Certification (upload file)
○ Notes (additional info)
```

---

## FOR ADMIN (Người Tìm Kiếm)

### Quick Start
```
1. Login → Click "Sản Phẩm" (📦) on sidebar
2. OPTION A: Type in search box "Arabica"
   OR
   OPTION B: Use filters (Category, Price, Capacity)
3. Click [🔍 Search]
4. See suppliers who match
5. Click [Create Deal] → Auto-fill form
6. Create opportunity!
```

### What You Find?
```
For each supplier:
✓ Company name & email
✓ Phone number
✓ Product name & specs
✓ Monthly capacity
✓ Price per unit
✓ FDA status
✓ Contact & create deal buttons
```

### Key Buttons
```
[Search]         → Find suppliers
[Contact]        → See email/phone
[Create Deal]    → Auto-fill opportunity form
[Details]        → View full supplier info
[Download]       → Export results as PDF
```

### Search Methods
```
QUICK SEARCH (Top box)
  → Type: "Arabica" or "Coffee Trading"
  → Shows all matching products

ADVANCED FILTER (Below)
  → Category: [Select type]
  → Min Capacity: [kg/month]
  → Price Range: [$min - $max]
  → FDA Status: [Filter]
  → [Search]
```

---

## URL CHEAT SHEET

```
CLIENT SIDE:
/client              → Dashboard
/client/products     → Products page (NEW!)
/client/leads        → Leads
/settings            → Settings

ADMIN SIDE:
/admin               → Dashboard
/admin/products      → Product search (NEW!)
/admin/clients       → Clients list
/admin/pipeline      → Pipeline/deals
/admin/buyers        → Buyers
/admin/finance       → Finance

API:
/api/products/search → Public search API
```

---

## COMMON WORKFLOWS

### Workflow 1: Client Adding 3 Products (10 min)
```
Step 1: Click "Sản Phẩm" on sidebar
Step 2: Click "+ Thêm Sản Phẩm"
Step 3: 
  Product 1: "Arabica Beans", Coffee, 500kg, $4.50
Step 4: Save
Step 5: Repeat for Products 2 & 3
Step 6: See all 3 in list
Result: Admin can find all 3 products
```

### Workflow 2: Admin Finding Supplier (2 min)
```
Step 1: Click "Sản Phẩm" on sidebar
Step 2: 
  Category: Coffee
  Min Capacity: 400 kg
  Price: < $5/kg
Step 3: Click [🔍 Search]
Step 4: See 2-3 suppliers match
Step 5: Click [Create Deal]
Result: Opportunity created with product linked
```

### Workflow 3: Client Editing Product (1 min)
```
Step 1: Click "Sản Phẩm" → See list
Step 2: Click [Edit] on product
Step 3: Change price from $4.50 → $4.30
Step 4: Click [Lưu]
Result: Price updated, admin sees new price
```

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "Added product but can't find" | Check status = Active, try search |
| "Search returns too many" | Use filters (price, capacity) |
| "Can't edit product" | Refresh page, check login |
| "Product shows for me not admin" | Wait 30 sec, try admin refresh |
| "FDA upload failed" | Use PDF/JPG, < 5MB file |

---

## CATEGORIES

```
✓ Coffee & Tea
✓ Cocoa & Chocolate
✓ Cashew
✓ Pepper & Spices
✓ Grain & Cereal
✓ Other
```

---

## TIPS & TRICKS

### For CLIENT:
```
💡 Add all your products - the more, the more visibility
💡 Update prices monthly - keep data fresh
💡 Upload FDA cert - buyers trust certified suppliers
💡 Be specific in notes - "Premium grade, harvest 2024"
```

### For ADMIN:
```
💡 Use Category filter first - narrows down fast
💡 Try price range filters - find budget suppliers
💡 Check FDA status - shows compliance level
💡 Click "Details" for full supplier history
💡 Create deals right from search - saves time
```

---

## PERFORMANCE TIPS

```
CLIENT:
  ✓ Products load in < 1 sec
  ✓ Add product saves instantly
  ✓ Edit/delete works immediately
  ✓ Max 100 products per supplier (rarely needed)

ADMIN:
  ✓ Search returns in < 2 sec
  ✓ Can filter by price range
  ✓ Can sort by price ascending/descending
  ✓ Shows top results first
```

---

## KEYBOARD SHORTCUTS

```
(Coming soon in v1.1)
Ctrl+K      Open quick search
Ctrl+P      Product list
Ctrl+Shift+D  Create deal
```

---

## FILE UPLOADS

```
Supported:
  ✓ PDF (FDA cert, quality docs)
  ✓ JPG/PNG (product photos)
  
Limits:
  ✓ Max 5 MB per file
  ✓ Max 10 files per product
```

---

## NOTIFICATIONS

```
CLIENT receives email when:
  ✓ Admin creates deal for your product
  ✓ Buyer shows interest
  ✓ Product gets searched

ADMIN can see:
  ✓ All active products
  ✓ Search history
  ✓ Deal creation log
```

---

## DATA RETENTION

```
Products stay active:
  ✓ Until you click [Delete]
  ✓ Or 12 months of no activity
  ✓ Can be reactivated

Deleted products:
  ✓ Set to "inactive"
  ✓ Admin can still see (archived)
  ✓ Won't show in public search
```

---

## FREQUENTLY ASKED

```
Q: How long to add a product?
A: 2-3 minutes

Q: When can admin find my product?
A: Instantly after you save

Q: Can I edit after adding?
A: Yes, click [Edit] anytime

Q: What if I want to hide a product?
A: Click [Delete] to set as inactive

Q: Can admin see deleted products?
A: No, they're archived

Q: What if I need to change capacity?
A: Edit product, change capacity, save

Q: Can I upload images?
A: Yes, JPG/PNG up to 5MB
```

---

## SUPPORT

**Having issues?** Check these docs:
1. `PRODUCT_DISCOVERY_USER_GUIDE.md` - Full guide (410 lines)
2. `PRODUCT_DISCOVERY_FLOW.md` - Visual workflows (370 lines)  
3. `PRODUCT_DISCOVERY_IMPLEMENTATION.md` - Technical (390 lines)
4. `ARCHITECTURE_OVERVIEW.md` - System design (545 lines)

---

## REMEMBER

```
CLIENT:
  ✓ Add products once
  ✓ Admin will find you
  ✓ Get contacted about sales
  
ADMIN:
  ✓ Search = instant results
  ✓ No need to call suppliers
  ✓ Create deals in seconds
```

---

**Print this card & post on your desk!** 📌

*Product Discovery v1.0 - Ready to use!* ✨
