# AI Pricing Suggestion Engine

## Overview

Tính năng AI Pricing Suggestion giúp AE tự động nhận được gợi ý giá cạnh tranh khi tạo proposal cho buyer. Hệ thống sử dụng:

- **Lead Data Mapping**: Dữ liệu LR đã nhập (sản phẩm, khối lượng, cảng)
- **Historical Pricing**: Giá từ các deals tương tự trong quá khứ
- **AI Analysis**: Claude/GPT xem xét context và gợi ý giá tối ưu
- **Training Data**: Lưu lại suggestion để AI học từ pattern

## How It Works

### 1. Khi AE Click "Suggest Pricing"

```
Flow:
1. AE nhập sản phẩm và chi tiết (trong Commercial section)
2. Click "Suggest Pricing" button (Sparkles icon)
3. System gọi /api/pricing/suggestions endpoint
4. AI engine chạy:
   - Fetch historical deals với cùng sản phẩm
   - Build context từ lead data + buyer profile
   - Call OpenAI với context này
   - AI suggest giá + incoterm + payment terms
5. Form tự động fill suggestion
6. AE có thể edit hoặc approve suggestion
```

### 2. AI Context Includes

```
- Product name & industry
- Volume (TEU/month, shipments)
- Origin/Destination ports
- Top suppliers (nếu có)
- Historical deals (5 most similar)
- Pricing guidelines by incoterm
```

### 3. AI Output

```json
{
  "suggestedPriceUsd": 2.45,
  "priceUnit": "kg",
  "incoterm": "FOB",
  "paymentTerms": "50% prepay, 50% on sight",
  "rationale": "Based on 8 comparable deals, similar volume commands 15% discount",
  "confidenceLevel": "high"
}
```

## Database Schema

### Table: `opportunity_pricing_suggestions`

```sql
- id (UUID)
- opportunity_id (FK)
- created_by (FK to profiles)
- suggested_price_usd (numeric)
- price_unit (kg, ton, container, etc)
- incoterm (FOB, CIF, CFR)
- payment_terms (text)
- rationale (text)
- confidence_level (high/medium/low)
- comparable_deals_count (int)
- product_name (indexed for training)
- ai_model (which model was used)
- created_at, updated_at
```

### Utility Function: `get_product_pricing_stats(product_name)`

Fetch pricing statistics for a product:

```sql
SELECT get_product_pricing_stats('Arabica Coffee');
-- Returns:
-- total_suggestions: 12
-- avg_price_usd: $2.38
-- min/max_price_usd: $2.10 - $2.80
-- most_common_unit: kg
-- avg_confidence_score: 0.82
-- last_suggested_at: 2026-05-20
```

## Files Structure

```
lib/pricing/
├── suggestions.ts          # Main pricing engine
└── types.ts               # TypeScript interfaces (if needed)

app/api/pricing/
└── suggestions/
    └── route.ts           # API endpoint

components/admin/
└── opportunity-detail-sheet.tsx  # UI button + suggestion display

scripts/
└── 044_pricing_suggestions_schema.sql  # Database migration
```

## API Endpoint

### POST `/api/pricing/suggestions`

**Request:**
```json
{
  "opportunityId": "uuid",
  "productName": "Arabica Coffee",
  "quantity": "20 FCL/month",
  "destinationPort": "Long Beach, CA",
  "incoterm": "FOB",
  "industry": "Food & Beverage"
}
```

**Response:**
```json
{
  "suggestedPriceUsd": 2.45,
  "priceUnit": "kg",
  "incoterm": "FOB",
  "paymentTerms": "50% prepay, 50% on sight",
  "rationale": "Based on 8 comparable deals...",
  "confidenceLevel": "high",
  "comparableDeals": 8
}
```

## Usage in Component

```tsx
// In OpportunityDetailSheet.tsx
const [pricingSuggestion, setPricingSuggestion] = useState<any>(null)

async function handleSuggestPricing() {
  const response = await fetch("/api/pricing/suggestions", {
    method: "POST",
    body: JSON.stringify({
      opportunityId: opportunity.id,
      productName: form.products_interested,
      // ... other fields
    }),
  })
  
  const suggestion = await response.json()
  setPricingSuggestion(suggestion)
  
  // Auto-fill form
  setForm(p => ({
    ...p,
    target_price_usd: suggestion.suggestedPriceUsd.toString(),
    incoterms: suggestion.incoterm,
    payment_terms: suggestion.paymentTerms,
  }))
}
```

## Machine Learning Training Data

Mỗi pricing suggestion được lưu lại để:

1. **Historical Analysis**: Xem những giá nào convert tốt nhất
2. **Pattern Recognition**: AI học pattern giá theo product/port/industry
3. **Win/Loss Analysis**: Correlate suggested price → deal won/lost
4. **Model Improvement**: Fine-tune AI recommendations

### Queries for Analysis

```sql
-- Find which pricing suggestions led to won deals
SELECT 
  ops.product_name,
  AVG(ops.suggested_price_usd) as avg_suggested,
  COUNT(CASE WHEN o.stage = 'won' THEN 1 END) as wins,
  ROUND(100.0 * COUNT(CASE WHEN o.stage = 'won' THEN 1 END) 
    / COUNT(*), 1) as win_rate
FROM opportunity_pricing_suggestions ops
JOIN opportunities o ON ops.opportunity_id = o.id
GROUP BY ops.product_name
ORDER BY win_rate DESC;

-- Find pricing by incoterm
SELECT 
  incoterm,
  COUNT(*) as suggestions,
  AVG(suggested_price_usd) as avg_price,
  STDDEV(suggested_price_usd) as price_variance
FROM opportunity_pricing_suggestions
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY incoterm;
```

## Future Enhancements

1. **Real-time Market Data**: Integrate ImportYeti API cho current market rates
2. **Competitor Pricing**: Auto-track competitor prices từ email threads
3. **Margin Calculation**: Suggest giá dựa trên target margin
4. **Volume Discounts**: Automatic calculation theo volume tiers
5. **Seasonality**: Factor in seasonal price variations
6. **Risk Adjustments**: Adjust price based on buyer/country risk scores

## Benefits

| Aspect | Benefit |
|--------|---------|
| **AE Productivity** | Save 5-10 min per deal on pricing research |
| **Pricing Accuracy** | Data-driven vs manual guessing |
| **Deal Velocity** | Faster quote turnaround → higher close rate |
| **AI Training** | Build historical data for better ML models |
| **Competitive Edge** | Systematic vs ad-hoc pricing |
| **Analytics** | Track which prices win vs lose by product/port |

