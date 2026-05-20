# Fix Report: Email Generator Missing "Ammunition"

**Date:** May 20, 2026  
**Status:** COMPLETED  
**Issue:** AI-generated emails were missing buyer intelligence (Vietnam supplier history) that should serve as the primary selling point.

---

## Problem Analysis

### What Was Wrong
The AI-generated email for American Cashew was "too safe" and generic:
- **Missing:** Reference to buyer's Vietnam sourcing history (Visimex purchase)
- **Result:** Email failed to open with the strongest hook: "I noticed you worked with Visimex on Cashewnut Kernels..."
- **Root Cause:** Three system gaps:
  1. Input data validation was weak—`purchaseHistory` field wasn't being validated as critical
  2. System prompt didn't emphasize `purchase_history` as #1 priority
  3. No quality checks to alert LRs when they were leaving fields empty

### The "Ammunition" That Was Lost
```
BEFORE (Generic):
"Are rising costs from your current suppliers starting to squeeze your margins on cashewnut kernels?"

AFTER (Personalized with ammunition):
"I noticed American Cashew worked with Visimex on Cashewnut Kernels before shifting sourcing to Chile recently. With your Q2-Q3 season approaching, we'd love to reconnect you with premium Vietnam cashews..."
```

The second version uses **3 pieces of ammunition:**
1. **Specific supplier name** (Visimex)
2. **Timeline** (worked in past, switched recently)
3. **Business context** (upcoming season = timely)

---

## Fixes Applied

### 1. **Form-Level Data Quality Warnings** (`smart-lead-form.tsx`)
**What was changed:**
- Added state tracking: `isPurchaseHistoryEmpty` and `isTopSuppliersEmpty`
- Section 6 (GHI CHÚ CHO AI) now displays **prominent warnings** if critical fields are empty
- Updated Card styling to highlight when data is missing
- Changed description from "optional but very valuable" → "**CRITICAL for AI to write personalized emails**"

**Impact:**
- LRs now get visual feedback BEFORE submitting the form
- Prevents "blind" data entry that results in generic AI emails
- Warnings appear in both EN and VI

```jsx
{(isPurchaseHistoryEmpty || isTopSuppliersEmpty) && (
  <div className="flex gap-2 rounded-sm bg-chart-5/10 p-2 text-xs text-chart-5">
    <AlertCircle className="h-4 w-4" />
    <div>
      {isPurchaseHistoryEmpty && <p>⚠️ Empty purchase history = AI cannot personalize</p>}
      {isTopSuppliersEmpty && <p>⚠️ Empty suppliers = AI loses Vietnam supplier angle</p>}
    </div>
  </div>
)}
```

### 2. **System Prompt Restructuring** (`email-generator.ts`)
**What was changed:**
- Added **⚠️⚠️⚠️ CRITICAL - HIGHEST PRIORITY FIELD ⚠️⚠️⚠️** section at the top of PERSONALIZATION INTELLIGENCE
- Explicitly states: "purchase_history" is THE MOST POWERFUL data source
- Added warning: "If purchase_history is NULL/EMPTY → Email will be GENERIC and WEAK"
- Emphasized: "The difference between A+ emails and mediocre ones IS purchase_history data"

**Impact:**
- AI now treats `purchase_history` as primary source of truth (not secondary)
- Prevents AI from ignoring this field
- Creates urgency: AI knows weak data = weak email

### 3. **Data Quality Logging** (`email-generator.ts`)
**What was changed:**
- Added validation checks that trigger BEFORE generating the email
- Log warnings when:
  - `purchase_history` is empty or too short (< 10 chars)
  - `top_suppliers` is empty
- Logs include buyer company name for easy tracking

```typescript
const hasPurchaseHistory = purchaseHistoryStr?.trim() && purchaseHistoryStr.trim().length > 10
if (!hasPurchaseHistory) {
  console.warn(
    "[v0] Email Generator WARNING: purchase_history is empty for lead",
    lead["company_name"],
    "→ Email will lack personalization 'ammunition'"
  )
}
```

**Impact:**
- Support/admins can now see which leads have insufficient data
- Enables data quality feedback loop
- Creates audit trail of weak data entries

---

## How This Fixes the American Cashew Email

### Before Fix:
1. LR enters lead for American Cashew
2. LR leaves `purchaseHistory` field empty (no warning)
3. Email generator gets `null` purchase_history
4. AI sees no Vietnam supplier data to leverage
5. Email defaults to generic "Are rising costs squeezing your margins?"

### After Fix:
1. LR enters lead for American Cashew
2. **FORM SHOWS WARNING:** "Empty purchase history = AI cannot personalize"
3. LR is prompted to fill in: "Mua của Visimex Corp (VN) từ năm 2024, năm 2025 mua của Chile..."
4. Email generator gets populated `purchase_history` field
5. **SYSTEM PROMPT SAYS:** "purchase_history = YOUR MOST POWERFUL DATA. USE IT AGGRESSIVELY."
6. AI opens with: "I noticed American Cashew worked with Visimex..."
7. **LOG SHOWS SUCCESS:** `hasPurchaseHistory = true` ✅

---

## Testing the Fix

To verify this works:

1. **Create a lead** with empty `purchaseHistory` → Form should show red warning
2. **Fill in real `purchaseHistory`** → Warning should disappear
3. **Generate an email** with populated data → Should use Vietnam supplier angle in opening
4. **Check console logs** → Should show `[v0] Email Generator WARNING` for weak entries

---

## Database Schema Note

All fields are already in the database (via migrations 033 and others):
- `purchase_history` (TEXT)
- `top_suppliers` (JSONB array of {name, country})
- `main_import_countries` (TEXT)

No schema changes required. This fix is purely about:
1. Making LRs aware of data quality importance
2. Making AI prioritize this data
3. Making weak data visible to the team

---

## Files Modified

- `/lib/ai/email-generator.ts` - System prompt & data quality checks
- `/components/admin/smart-lead-form.tsx` - Form validation warnings

---

## Next Steps (Optional Enhancements)

1. **Add form-level validation** on submit to block creation if `purchaseHistory` is empty
2. **Add analytics** to track what % of leads have empty `purchaseHistory`
3. **Add a tooltip** with examples of what good purchase history looks like
4. **Add ImportYeti data extraction** to auto-populate `purchaseHistory` from customs data

---

## Summary

✅ **Problem:** AI emails were missing "ammunition" due to weak data entry  
✅ **Root Cause:** Form didn't emphasize data importance; System prompt wasn't prioritizing it; No validation  
✅ **Solution:** Visual warnings + system prompt emphasis + logging  
✅ **Result:** LRs now aware of data criticality; AI now prioritizes `purchase_history`; Weak data now visible
