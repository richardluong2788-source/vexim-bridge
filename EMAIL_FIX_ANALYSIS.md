# Email Generator Fix - Complete Analysis

## Problem Statement

Email AI was generating **generic, weak emails** that lacked "ammunition" (specific, personalized details).

**Example of the problem:**
- Email shown: "As you explore options beyond your current suppliers, I wanted to introduce Vietnam as a compelling source..."
- Missing: Exact supplier names (Visimex Corp, Procesadora De Alimentos), specific years (2024→2025), specific volumes (16,800kg)

---

## Root Causes

### 1. **Data was not being EXTRACTED, only MENTIONED**
- `purchase_history` field existed: `"Mua của Visimex Corp Joint Stock Com (VN) từ năm 2024, năm 2025 mua của Procesadora De Alimentos Santa Isab (Chile) số lượng 16.800kg"`
- But AI was not reliably parsing it to extract:
  - Vietnam supplier name: `"Visimex Corp Joint Stock Com"`
  - Vietnam year: `"2024"`
  - Current supplier: `"Procesadora De Alimentos Santa Isab"`
  - Current year: `"2025"`
  - Volume: `"16,800 kg"`

### 2. **No data quality warnings for LRs**
- When LRs left `purchase_history` empty, the system didn't warn them
- AI then generated emails without the most critical personalization data

### 3. **System prompt was instructional but not ACTIONABLE**
- System prompt said "use exact names" but didn't provide pre-extracted values
- AI had to parse raw text, which was unreliable

---

## Solution Implemented

### 1. **Add Extraction Functions** (email-generator.ts, leads/actions.ts)
```typescript
function extractPurchaseHistoryDetails(text) {
  // Returns: {
  //   vietnamSupplier: "Visimex Corp Joint Stock Com",
  //   vietnamYear: "2024",
  //   currentSupplier: "Procesadora De Alimentos Santa Isab",
  //   currentYear: "2025",
  //   volume: "16,800 kg"
  // }
}
```

### 2. **Pass Extracted Fields to AI Context**
Instead of just passing raw `purchase_history`, now passing:
```json
{
  "purchase_history": "raw text...",
  "purchase_history_vietnam_supplier": "Visimex Corp Joint Stock Com",
  "purchase_history_vietnam_year": "2024",
  "purchase_history_current_supplier": "Procesadora De Alimentos Santa Isab",
  "purchase_history_current_year": "2025",
  "purchase_history_volume": "16,800 kg"
}
```

### 3. **Update System Prompt for SCENARIO B**
**Before:**
- "I noticed you worked with [vietnam_supplier] before..."

**After (MANDATORY):**
- "I noticed [buyer_company] previously sourced from [purchase_history_vietnam_supplier] in [purchase_history_vietnam_year], then shifted to [purchase_history_current_supplier] in [purchase_history_current_year] for your [purchase_history_volume] requirements."

### 4. **Add Data Quality Warnings in Form**
- When `purchaseHistory` is empty, show: ⚠️ "Empty purchase history = AI cannot personalize the email"
- When `topSuppliers` is empty, show: ⚠️ "Empty suppliers = AI loses Vietnam supplier leverage"

---

## Expected Results

### Email BEFORE Fix:
```
Dear L Richard,

As you explore options beyond your current suppliers, I wanted to introduce a compelling source for your Cashewnut Kernels needs. While your recent shipments have come from Procesadora De Alimentos in Chile, Vietnam remains a strong player in quality and pricing.

We may be new to the U.S. market, but we are not new to quality...
```

**Issues:**
- Generic opening ❌
- No mention of Vietnam supplier switch ❌
- No specific timeline ❌
- No volume info ❌

### Email AFTER Fix (Expected):
```
Dear L Richard,

I noticed American Cashew previously sourced from Visimex Corp in Vietnam during 2024, then shifted to Procesadora De Alimentos Santa Isab in Chile for your 16,800 kg requirements. 

With your Q2-Q3 season approaching, reconnecting with premium Vietnam cashews could offer compelling pricing alternatives worth evaluating.

We may be new to the U.S. market, but we are not new to quality. Our facility is FDA-registered and I'd be happy to share our recent Certificate of Analysis and factory video...
```

**Improvements:**
- Specific Vietnam supplier: "Visimex Corp" ✅
- Timeline: "2024 → 2025" ✅
- Current supplier: "Procesadora De Alimentos Santa Isab" ✅
- Volume: "16,800 kg" ✅
- Research credential: Shows we know their history ✅

---

## Files Modified

1. **lib/ai/email-generator.ts**
   - Added `extractPurchaseHistoryDetails()` function
   - Added 5 new extracted fields to context block
   - Updated SCENARIO B to use extracted field placeholders

2. **components/admin/smart-lead-form.tsx**
   - Added data quality checks for `purchaseHistory` and `topSuppliers`
   - Added visual warning indicators

3. **app/admin/leads/new/actions.ts**
   - Added `extractPurchaseHistoryData()` for optional lead creation

---

## Testing Checklist

- [ ] Generate email for American Cashew buyer
  - [ ] Email mentions "Visimex Corp" (Vietnam supplier)
  - [ ] Email mentions "2024" (year)
  - [ ] Email mentions "Procesadora De Alimentos" (current supplier)
  - [ ] Email mentions "16,800 kg" (volume)

- [ ] Form shows warning when purchase_history empty
- [ ] Form shows warning when top_suppliers empty

- [ ] Email generation still works for other scenarios (SCENARIO A, C)

---

## Why This Matters

The difference between a generic email and a personalized one is **specificity + research**.

A buyer sees:
- ❌ Generic: "We noticed you import cashews... interest in Vietnam sourcing?"
  → "Yeah, we get 100 of these emails"

- ✅ Specific: "We noticed you switched from Visimex Corp in Vietnam (2024) to Procesadora in Chile (2025) for your 16,800kg orders..."
  → "Wait, they actually did their homework. Let me take this seriously."

The extraction fix ensures AI emails have maximum specificity and credibility.
