# Product Discovery System - Deployment Checklist

## Pre-Deployment

- [ ] Read `PRODUCT_DISCOVERY_QUICKSTART.md`
- [ ] Review `PRODUCT_DISCOVERY_IMPLEMENTATION.md`
- [ ] Ensure Supabase connection is active
- [ ] Backup current database
- [ ] All team members notified

---

## Database Deployment

### Phase 1: Schema & RLS

- [ ] Open Supabase SQL Editor
- [ ] Copy content from `scripts/023_client_products_schema.sql`
- [ ] Execute query
- [ ] Verify completion (no errors)
- [ ] Check table created:
  ```sql
  SELECT * FROM client_products LIMIT 1;
  ```

### Phase 2: Integration

- [ ] Copy content from `scripts/024_integrate_client_products_to_opportunities.sql`
- [ ] Execute query
- [ ] Verify completion (no errors)
- [ ] Check columns added:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'opportunities' AND column_name = 'client_product_id';
  ```

---

## Code Deployment

### Deploy to Production

```bash
# 1. Commit all changes
git add .
git commit -m "feat: add product discovery system

- Add client_products table and RLS policies
- Add server actions for product management
- Add client portal product management UI
- Add admin product search dashboard
- Add public product search API
- Add comprehensive documentation"

# 2. Push to main
git push origin main

# 3. Wait for Vercel build to complete
# 4. Check deployment status in Vercel dashboard
```

---

## Feature Testing

### Client Portal Tests

- [ ] **Login as Client**
  - [ ] Navigate to `/client/products`
  - [ ] Page loads without errors
  - [ ] "Add Product" button visible

- [ ] **Add Product**
  - [ ] Click "Add Product"
  - [ ] Form dialog opens
  - [ ] All fields present and functional
  - [ ] Product saves successfully
  - [ ] Appears in product list

- [ ] **Edit Product**
  - [ ] Click "Edit" on product
  - [ ] Dialog opens with current data
  - [ ] Can modify fields
  - [ ] Changes save successfully

- [ ] **Product List**
  - [ ] All products display
  - [ ] Status badges show correctly
  - [ ] Price/capacity display properly
  - [ ] Sorting/filtering works (if implemented)

- [ ] **Empty State**
  - [ ] New client sees "No products yet"
  - [ ] Can add first product

### Admin Dashboard Tests

- [ ] **Login as Admin**
  - [ ] Navigate to `/admin/products`
  - [ ] Page loads without errors
  - [ ] Search widget visible

- [ ] **Quick Search**
  - [ ] Type in search box
  - [ ] Results appear/update
  - [ ] Matching works correctly

- [ ] **Advanced Filters**
  - [ ] Click "Filters" button
  - [ ] All filter options visible:
    - [ ] Category dropdown
    - [ ] Min Capacity input
    - [ ] Min Price input
    - [ ] Max Price input
  - [ ] Filters apply correctly
  - [ ] Results update when filters change

- [ ] **Search Results**
  - [ ] Product info displays (name, category, price)
  - [ ] Supplier info shows (company, email, FDA)
  - [ ] Status badge displays
  - [ ] Results are accurate

- [ ] **No Results**
  - [ ] Empty state displays correctly
  - [ ] Can adjust filters to get results

### Public API Tests

- [ ] **Basic Query**
  ```bash
  curl "https://yourdomain.com/api/products/search?category=coffee"
  ```
  - [ ] Returns 200 status
  - [ ] JSON format correct
  - [ ] Data includes product details

- [ ] **Filtered Query**
  ```bash
  curl "https://yourdomain.com/api/products/search?category=coffee&min_capacity=500&max_price=5.00"
  ```
  - [ ] Filters applied correctly
  - [ ] Results match criteria

- [ ] **Pagination**
  ```bash
  curl "https://yourdomain.com/api/products/search?limit=10&offset=0"
  ```
  - [ ] Limit parameter works
  - [ ] Offset works for pagination
  - [ ] Count returned is accurate

---

## Security & Permission Tests

### RLS Policy Tests

- [ ] **Client can see own products**
  - [ ] Login as Client A
  - [ ] View products added by Client A
  - [ ] Should see all own products

- [ ] **Client can't see others' products**
  - [ ] Login as Client A
  - [ ] Try to view Client B's products via DB query
  - [ ] Should get RLS error or empty result

- [ ] **Admin sees all products**
  - [ ] Login as Admin
  - [ ] Search returns ALL active products
  - [ ] Can see products from all clients

- [ ] **Public sees only active**
  - [ ] Test API without authentication
  - [ ] Returns only status='active' products
  - [ ] No inactive/suspended products shown

### Data Validation Tests

- [ ] **Invalid category rejected** (if validation added)
- [ ] **Negative capacity rejected** (if validation added)
- [ ] **Required fields enforced** (name, category required)
- [ ] **Unique product codes per client** (if required)

---

## Activity Logging Tests

- [ ] **Product added logged**
  - [ ] Client adds product
  - [ ] Check `activities` table
  - [ ] `action_type = 'client_product_added'`
  - [ ] `performed_by` = correct user

- [ ] **Product updated logged**
  - [ ] Client edits product
  - [ ] Check `activities` table
  - [ ] `action_type = 'client_product_updated'`

- [ ] **Product deleted logged**
  - [ ] Client deletes product
  - [ ] Check `activities` table
  - [ ] `action_type = 'client_product_deleted'`

---

## Performance Tests

### Database Performance

- [ ] **Search query < 1 second** (with indexes)
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM client_products 
  WHERE category = 'coffee' AND status = 'active'
  ORDER BY created_at DESC;
  ```

- [ ] **Indexes exist and are used**
  - [ ] Check index sizes reasonable
  - [ ] No sequential scans in EXPLAIN

### UI Performance

- [ ] **Product list loads quickly** (< 2 seconds)
- [ ] **Search widget responsive** (instant filter updates)
- [ ] **Dialog opens/closes smoothly** (no lag)
- [ ] **No N+1 queries** (check Network tab)

---

## Browser Compatibility

- [ ] **Chrome/Chromium** - Test on latest
- [ ] **Firefox** - Test on latest
- [ ] **Safari** - Test on latest
- [ ] **Mobile browsers** - Responsive design works

---

## Edge Cases & Error Handling

- [ ] **Empty inputs** - Form validation works
- [ ] **Very long product names** - Text truncates properly
- [ ] **Many products** - List pagination/scroll works
- [ ] **Slow network** - Loading states display
- [ ] **API errors** - User-friendly error messages
- [ ] **Session timeout** - Redirects to login
- [ ] **Role changes** - Permissions update immediately

---

## Documentation Review

- [ ] **PRODUCT_DISCOVERY_QUICKSTART.md**
  - [ ] Clear and concise
  - [ ] All 3 steps work
  - [ ] Examples are accurate

- [ ] **PRODUCT_DISCOVERY_IMPLEMENTATION.md**
  - [ ] Technical details correct
  - [ ] Workflows match implementation
  - [ ] API docs accurate

- [ ] **DEPLOYMENT_CHECKLIST.md** (this file)
  - [ ] All items complete
  - [ ] Instructions clear

---

## Training & Communication

- [ ] **Client communication sent**
  - [ ] Explain new product management feature
  - [ ] How to access `/client/products`
  - [ ] How to add products
  - [ ] Benefits explained

- [ ] **Admin training**
  - [ ] Explain `/admin/products` search
  - [ ] How filters work
  - [ ] Use cases for buyer matching
  - [ ] Show API endpoint

- [ ] **Support docs created**
  - [ ] FAQ for common issues
  - [ ] Video tutorial (optional)
  - [ ] Step-by-step guides

---

## Monitoring & Rollback Plan

### Post-Deployment Monitoring

- [ ] **Error monitoring active**
  - [ ] Check error logs in Supabase
  - [ ] Check application error logs
  - [ ] Monitor slow queries

- [ ] **Usage monitoring**
  - [ ] Track product creation rate
  - [ ] Monitor search usage
  - [ ] Check API call volume

- [ ] **Performance monitoring**
  - [ ] Page load times
  - [ ] API response times
  - [ ] Database query performance

### Rollback Plan

If critical issues found:

1. **Code Rollback** (if app issue)
   ```bash
   git revert <commit-hash>
   git push origin main
   # Vercel auto-deploys
   ```

2. **Database Rollback** (if schema issue)
   ```sql
   -- Drop new columns
   ALTER TABLE opportunities DROP COLUMN client_product_id;
   ALTER TABLE deals DROP COLUMN product_id;
   
   -- Drop new table
   DROP TABLE client_products CASCADE;
   ```

3. **Communication**
   - [ ] Notify team of rollback
   - [ ] Explain what went wrong
   - [ ] Plan for re-deployment

---

## Sign-Off

- [ ] Tech Lead Reviews: _________________ Date: _______
- [ ] Product Owner Approves: ___________ Date: _______
- [ ] Deployment Complete: _____________ Date: _______

---

## Post-Deployment (Day 1)

- [ ] Monitor error logs every 30 minutes
- [ ] Check search functionality manually
- [ ] Verify at least 1 client added product
- [ ] Verify admin search works
- [ ] Check activity logs for entries
- [ ] Get initial feedback from users

---

## Post-Deployment (Week 1)

- [ ] All clients have added products (goal: 80%+)
- [ ] Admin using search feature
- [ ] No critical issues reported
- [ ] Performance metrics healthy
- [ ] Database queries optimized
- [ ] Document any bug fixes

---

## Success Criteria

- [ ] System is stable (zero critical errors)
- [ ] Search accuracy > 95%
- [ ] Response times < 2 seconds
- [ ] Users can add products without help
- [ ] Admin finding suppliers in < 1 minute
- [ ] Positive user feedback received

---

**Date Deployed:** ________________
**Deployed By:** ________________
**Any Issues:** ________________
**Notes:** ________________

---

For questions, refer to the implementation guide or troubleshooting section.
