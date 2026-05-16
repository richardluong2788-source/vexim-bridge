# Option A Implementation: Public Company Profile

## Overview

This implementation provides a **public-facing company profile system** (Option A) that allows suppliers/clients to showcase their company information to potential buyers while maintaining privacy controls.

## What Gets Displayed ✅

The public profile shows:
- **Company Name & Logo** - Central identity
- **Cover Image** - Professional header
- **Company Description** - About the company
- **Products** - All active client products with pricing and capacity
- **Production Statistics** - JSON-based metrics (capacity, certifications, etc.)
- **Factory/Company Video** - Embedded video showcase
- **Certifications** - FDA certificates and Certificates of Analysis (COA)
- **Industry & FDA Status** - Professional credibility indicators

## What Gets Hidden ❌

The following sensitive information is **never displayed** on public profiles:
- **Email Address** - Can be optionally shown if selected
- **Phone Number** - Can be optionally shown if selected
- **Website** - Can be optionally shown if selected
- **Exact Factory Address** - Can be optionally shown if selected
- **Financial Data** - Pricing, margins, costs (production stats visible only, not financials)

## Call-to-Action (CTA)

Instead of exposing contact details, visitors use:
- **"Request Quote" Button** - Sends inquiries through ESH system
- **No direct email/phone collection** - All leads route through official channels

---

## Database Schema Changes

### New Fields in `profiles` table:
```sql
logo_url TEXT              -- Company logo image
cover_url TEXT             -- Cover/header image
company_description TEXT   -- About company text
production_stats JSONB     -- Stats like capacity, certifications, etc.
company_video_url TEXT     -- Embedded video URL
is_public_profile BOOLEAN  -- Toggle to make profile public
```

### New Table: `company_public_profiles`

Controls visibility and privacy for each company:

```sql
CREATE TABLE company_public_profiles (
  id UUID PRIMARY KEY,
  company_id UUID UNIQUE REFERENCES profiles(id),
  
  is_visible BOOLEAN           -- Master visibility toggle
  show_email BOOLEAN           -- Allow email to be shown
  show_phone BOOLEAN           -- Allow phone to be shown
  show_website BOOLEAN         -- Allow website to be shown
  show_factory_address BOOLEAN -- Allow factory address to be shown
  
  share_token TEXT UNIQUE      -- For token-based shares (future)
  share_token_expires_at TIMESTAMP
  
  view_count INT               -- Analytics: profile views
  last_viewed_at TIMESTAMP     -- Analytics: last view time
  
  created_at TIMESTAMP
  updated_at TIMESTAMP
)
```

---

## File Structure

### New Routes

#### 1. **Public Profile Display**
```
/app/share/profile/[company-id]/page.tsx
```
- Displays public company profile
- Shows products, certifications, videos, stats
- Respects privacy settings
- No authentication required
- Admin client queries (bypasses RLS for public viewing)

#### 2. **Client Management UI**
```
/app/client/public-profile/page.tsx
```
- Client dashboard to manage their public profile
- Upload logo, cover, video URLs
- Toggle visibility settings
- Copy public profile link
- Manage contact info privacy
- Requires authentication (client role)

### Database Migration
```
/scripts/036_public_company_profile_schema.sql
```
- Creates new table with RLS policies
- Adds fields to profiles table
- Sets up indexes for performance

### Type Definitions
```
/lib/supabase/types.ts
```
- Updated `profiles` Row/Insert/Update types
- Added `company_public_profiles` table types
- Maintains TypeScript type safety

---

## Features

### For Clients/Suppliers

✅ **Control What's Public**
- Toggle overall visibility (public/private)
- Choose which contact details to expose
- Upload professional media (logo, cover, video)
- Add company description

✅ **Manage Content**
- Products automatically display from `client_products` table
- Certifications pull from compliance docs
- Production stats shown as key metrics
- Company video embeds directly on profile

✅ **Generate Share Links**
- Direct URL: `/share/profile/[company-id]`
- Copy-to-clipboard button
- Shareable on business cards, social media, etc.

### For Buyers/Visitors

✅ **View Company Info**
- Browse products and pricing
- See production capacity and stats
- Review certifications
- Watch company video
- View professional company info

✅ **Contact Company**
- "Request Quote" button (always visible)
- Routes through ESH system
- No direct email/phone unless shared
- Maintains lead tracking

✅ **Privacy Maintained**
- Factory address hidden by default
- Phone/email hidden unless explicitly shared
- Specific contact person info never shown
- Only public profile data visible

---

## User Flows

### Client Setup Flow
```
1. Client logs into dashboard
2. Navigates to "Public Profile" section
3. Uploads logo and cover images
4. Writes company description
5. Adds factory video URL
6. Toggles which contact info to show
7. Clicks "Make Profile Public"
8. Copies shareable link
9. Shares profile on website/LinkedIn/etc.
```

### Buyer Discovery Flow
```
1. Buyer receives share link: /share/profile/[company-id]
2. Views company info, products, certifications
3. Clicks "Request Quote"
4. Routed to inquiry form
5. Inquiry tracked in ESH system
6. Company receives notification
7. Conversation continues in platform
```

---

## Security & Privacy

### Row-Level Security (RLS)

**profiles table:**
- Public can view only profiles where `is_public_profile = TRUE`
- Clients can view/edit only their own profile
- Admins can view/edit any profile

**company_public_profiles table:**
- Public can view only where `is_visible = TRUE`
- Clients can manage only their own profile
- Admins can manage any profile
- Token-based shares create temporary access

### Data Protection

- Direct database queries for public data use admin client (app-level filtering)
- No credentials exposed in URLs
- All contact routing through official channels
- Activity logging for view counts
- Token expiration for temporary shares

---

## Implementation Checklist

- [x] Database schema migration created (`036_public_company_profile_schema.sql`)
- [x] TypeScript types updated for new fields
- [x] Public profile display page created (`/share/profile/[company-id]`)
- [x] Client management page created (`/client/public-profile`)
- [ ] Run migration script in Supabase console
- [ ] Test public profile display
- [ ] Test client management UI
- [ ] Add to client navigation menu (sidebar link)
- [ ] Style components (if needed)
- [ ] Test mobile responsiveness
- [ ] Add analytics (view count tracking)
- [ ] Create admin panel for viewing public profiles

---

## Next Steps

### Immediate (Deploy)
1. Apply database migration
2. Test public profile viewing
3. Test client management interface

### Soon (Enhancement)
1. Add image upload directly (instead of URLs)
2. Add analytics dashboard showing view counts
3. Create admin panel to manage public profiles
4. Add category/search indexing for profile discovery
5. Add testimonials/reviews section

### Future (Advanced)
1. Token-based temporary shares
2. Public profile analytics
3. SEO optimization for public profiles
4. Social media integration
5. Multi-language support for profiles

---

## Comparison: Option A vs Alternatives

| Feature | Option A | Direct Email | Anonymous |
|---------|----------|--------------|-----------|
| Company Identity | ✅ Full | ✅ Full | ❌ Hidden |
| Products Shown | ✅ Yes | ✅ Yes | ❌ No |
| Contact Exposed | ❌ Hidden | ✅ Exposed | ❌ Hidden |
| Privacy Control | ✅ Client choice | ❌ No | ✅ Complete |
| Lead Tracking | ✅ Yes | ❌ No | ❌ Limited |
| Professional | ✅ High | ❌ Raw | ⚠️ Medium |

Option A provides **best balance** of professional presentation with privacy protection.
