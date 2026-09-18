import type { CreateLeadWithAIMatchingInput } from "@/app/admin/leads/new/actions"
import type { BuyerAnalysisResult } from "@/lib/ai/buyer-analyzer"
import type { BuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

/**
 * Buyer Intelligence Brief — Markdown generator.
 *
 * REWRITTEN. The previous version interpolated ~13 fields that do not exist on
 * BuyerAnalysisResult / BuyerStrategy (`vietnamReadinessScore`,
 * `supplierLoyaltyScore`, `healthTrend`, `concentrationRisk`,
 * `volatilityLevel`, `productMatchVN`, `vnSupplierHistory`,
 * `asiaSupplierExperience`, `bestContactMonth`, `supplyChainInsights`,
 * `vietnamAdvantages`, `strategy.risks[].factor/.mitigation`), so whole
 * sections rendered "undefined" or silently took the `|| "fallback"` branch.
 * It also invented the single most quotable number in the document:
 *
 *     const yearsActive = lead.companyName ? Math.floor(Math.random() * 15 + 1) : 0
 *
 * Every metric here now traces to a real field. Where the old template
 * hard-coded a confident-sounding value ("Analysis Confidence: High",
 * "Status: Active", "Analysis Model: AI-Powered Buyer Intelligence System")
 * the real signal is used instead — `strategy.confidenceScore`, the last
 * shipment date, and the model that actually ran (or an explicit statement
 * that the heuristic fallback did).
 *
 * `generateBuyerBriefHTML()` was removed: zero callers, and its regex
 * markdown->HTML pass emitted invalid markup (table rows became
 * `<table><tr><td>`, `<p>` was closed without ever being opened). The repo
 * already renders markdown properly via react-markdown / lib/markdown-preview.
 */

export interface BuyerBriefData {
  /**
   * The flattened intake shape produced by transformImportYetiApiResponse().
   * Partial because that transform only fills the sections ImportYeti knows
   * about — contact details in particular are entered by the LR by hand.
   */
  lead: Partial<CreateLeadWithAIMatchingInput>
  analysis: BuyerAnalysisResult
  strategy: BuyerStrategy
  metadata?: {
    generatedDate?: string
    buyerId?: string
    documentId?: string
    /** Model that produced `strategy`, or null when the fallback ran. */
    model?: string | null
    strategySource?: "ai" | "fallback"
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const NA = "N/A"

function num(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return NA
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return NA
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`
}

function text(value: string | null | undefined): string {
  const v = value?.trim()
  return v ? v : NA
}

function bulletList(items: Array<string | null | undefined>): string {
  const kept = items.map((i) => i?.trim()).filter((i): i is string => Boolean(i))
  return kept.length > 0 ? kept.map((i) => `- ${i}`).join("\n") : `- ${NA}`
}

function healthLevel(score: number): string {
  if (score >= 75) return "Excellent"
  if (score >= 50) return "Good"
  if (score >= 25) return "Fair"
  return "Poor"
}

/** Loyalty is inverted: a HIGH score means the buyer is hard to approach. */
function loyaltyLevel(score: number): string {
  if (score >= 75) return "High Loyalty — hard to displace"
  if (score >= 50) return "Moderate Loyalty"
  return "Low Loyalty — shopping around"
}

function vietnamReadinessLevel(score: number): string {
  if (score >= 75) return "Highly Ready"
  if (score >= 50) return "Ready"
  if (score >= 25) return "Moderately Ready"
  return "Not Ready"
}

function riskLabel(level: BuyerAnalysisResult["healthBreakdown"]["riskLevel"]): string {
  return level === "low" ? "Low" : level === "high" ? "High" : "Moderate"
}

/**
 * stabilityScore is 0-25 (25 = perfectly even monthly volume).
 * Mapped back to a human label rather than exposed as a raw sub-score.
 */
function volatilityLabel(stabilityScore: number): string {
  if (stabilityScore >= 19) return "Low — steady monthly volume"
  if (stabilityScore >= 12) return "Normal"
  if (stabilityScore >= 6) return "Elevated — lumpy ordering"
  return "High — very irregular"
}

function concentrationLabel(concentrationPct: number): string {
  if (concentrationPct >= 80) return `High — top 3 suppliers hold ${concentrationPct.toFixed(0)}% of volume`
  if (concentrationPct >= 50) return `Moderate — top 3 hold ${concentrationPct.toFixed(0)}%`
  return `Low — sourcing is spread out (top 3 hold ${concentrationPct.toFixed(0)}%)`
}

function activityStatus(lastShipmentDate: string | null | undefined): string {
  if (!lastShipmentDate) return "Unknown — no shipment date on record"
  const then = new Date(lastShipmentDate).getTime()
  if (Number.isNaN(then)) return `Unknown — unparseable date "${lastShipmentDate}"`
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 90) return `Active — last shipment ${days}d ago`
  if (days <= 365) return `Slowing — last shipment ${days}d ago`
  return `Dormant — last shipment ${Math.round(days / 365)}y ago`
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive Markdown buyer intelligence brief.
 */
export function generateBuyerIntelligenceBrief(data: BuyerBriefData): string {
  const { lead, analysis, strategy, metadata = {} } = data

  const now = new Date()
  const generatedDate = metadata.generatedDate || now.toISOString().split("T")[0]
  const documentId = metadata.documentId || `BRIEF-${Date.now()}`

  const h = analysis.healthBreakdown
  const l = analysis.loyaltyBreakdown
  const v = analysis.vietnamBreakdown

  const modelLine =
    metadata.strategySource === "ai" && metadata.model
      ? metadata.model
      : "Heuristic fallback (LLM strategy unavailable)"

  const talkingPoints = strategy.talkingPoints?.length
    ? strategy.talkingPoints
        .slice(0, 5)
        .map((point, idx) => `${idx + 1}. **${point}**`)
        .join("\n\n")
    : `- ${NA}`

  const riskFactors = strategy.riskFactors?.length
    ? strategy.riskFactors.map((risk) => `- ${risk}`).join("\n")
    : "- No specific risks identified"

  const vnSuppliers = v.vnSuppliers?.length
    ? v.vnSuppliers
        .map(
          (s) =>
            `- **${s.name}** — ${num(s.shipments)} shipments` +
            (s.firstYear ? `, since ${s.firstYear}` : "") +
            (s.businessLength ? ` (${s.businessLength})` : ""),
        )
        .join("\n")
    : "- None on record"

  return `# BUYER INTELLIGENCE BRIEF

**Generated:** ${generatedDate}  
**Buyer Profile ID:** ${metadata.buyerId || "TBD"}  
**Document ID:** ${documentId}  
**Analysis Confidence:** ${strategy.confidenceScore ?? 0}/100 (${
    metadata.strategySource === "ai" ? "AI-generated strategy" : "heuristic fallback"
  })

---

## EXECUTIVE SUMMARY

**Buyer Name:** ${text(analysis.companyName || lead.companyName)}  
**Location:** ${text(lead.importAddress)}, ${text(lead.country)}  
**Website:** ${text(lead.website)}  
**Primary Product:** ${text(lead.mainProduct)} | HS Code: ${text(lead.hsCode)}  
**Years Active:** ${analysis.yearsActive > 0 ? `${analysis.yearsActive}` : NA}

**Quick Assessment:**
- **Health Status:** ${healthLevel(analysis.healthScore)} (${analysis.healthScore}/100, ${riskLabel(
    h.riskLevel,
  )} risk)
- **Import Activity:** ${num(analysis.totalShipments ?? lead.totalShipments)} shipments | ${
    lead.avgTeuPerMonth != null ? `${num(lead.avgTeuPerMonth, 1)} TEU/month avg` : NA
  }
- **Volume Trend:** ${pct(h.growthRate)} year over year
- **Vietnam Readiness:** ${vietnamReadinessLevel(analysis.vietnamReadiness)} (${
    analysis.vietnamReadiness
  }/100)
- **Recommended Approach:** ${text(strategy.recommendedAngle)}

> ${strategy.approachSummary || "No strategy summary available."}

---

## SECTION 1: BUYER PROFILE

### Company Information
| Field | Value |
|-------|-------|
| **Company Name** | ${text(analysis.companyName || lead.companyName)} |
| **Address** | ${text(lead.importAddress)} |
| **Country** | ${text(lead.country)} |
| **Website** | ${text(lead.website)} |
| **Phone** | ${text(lead.contactPhone)} |
| **Years in Business** | ${analysis.yearsActive > 0 ? analysis.yearsActive : NA} |

### Import Activity Timeline
- **Latest Shipment:** ${text(lead.lastShipmentDate)}
- **Status:** ${activityStatus(lead.lastShipmentDate)}
- **Source:** ${text(lead.importYetiLink)}

---

## SECTION 2: IMPORT VOLUME & TRENDS

### Historical Import Data
| Metric | Value |
|--------|-------|
| **Total Shipments** | ${num(analysis.totalShipments ?? lead.totalShipments)} |
| **Average TEU/Month** | ${lead.avgTeuPerMonth != null ? num(lead.avgTeuPerMonth, 1) : NA} |
| **Import Trend** | ${text(lead.importTrend)} |
| **YoY Volume Change** | ${pct(h.growthRate)} |

### Score Breakdown (health = sum of four 0-25 sub-scores)
| Component | Score |
|-----------|-------|
| Trend | ${num(h.trendScore, 1)} / 25 |
| Stability | ${num(h.stabilityScore, 1)} / 25 |
| Consistency | ${num(h.consistencyScore, 1)} / 25 |
| 3-Year Growth | ${num(h.growthScore, 1)} / 25 |

### Seasonal Patterns
**Peak Import Months:**
${bulletList([lead.topPeakMonths])}

**Low Import Months:**
${bulletList([lead.topLowMonths])}

**Data Year:** ${lead.peakMonthsDataYear ?? NA}

**📌 Best Contact Timing:** ${text(strategy.timingSuggestion)}

---

## SECTION 3: PRODUCTS & HS CODES

### Primary Product Category
| Category | HS Code | Description |
|----------|---------|-------------|
| **Main** | ${text(lead.hsCode)} | ${text(lead.mainProduct)} |

### Secondary Products
${bulletList([lead.secondaryHsCodes])}

### Latest Bill of Lading Description
${text(lead.bolDescription)}

---

## SECTION 4: SUPPLY CHAIN ANALYSIS

### Current Suppliers
${lead.topSuppliers ? `\`\`\`\n${lead.topSuppliers}\n\`\`\`` : `- ${NA}`}

### Sourcing Geography
${lead.mainImportCountries ? `**Primary Sources:** ${lead.mainImportCountries}` : `- ${NA}`}

### Purchase History
${text(lead.purchaseHistory)}

### Named Competitors
${text(lead.competitors)}

### Supplier Loyalty Analysis (score ${analysis.loyaltyScore}/100 — ${loyaltyLevel(
    analysis.loyaltyScore,
  )})
| Metric | Value |
|--------|-------|
| **Top Supplier** | ${text(l.topSupplierName)} (${text(l.topSupplierCountry)}) |
| **Top Supplier Tenure** | ${text(l.topSupplierTenure)} |
| **Concentration (top 3)** | ${concentrationLabel(l.concentration)} |
| **Switching Rate (12m)** | ${num(l.switchingRate, 1)}% of volume from newly-added suppliers |
| **New Supplier Rate** | ${num(l.newSupplierRate, 1)}% of the supplier base is new |
| **Interpretation** | ${
    l.switchingRate >= 30
      ? "Actively trialling new suppliers — receptive to outreach"
      : l.switchingRate >= 10
        ? "Some churn — worth an approach"
        : "Stable book of suppliers — expect a longer sales cycle"
  } |

---

## SECTION 5: LOGISTICS & OPERATIONS

### Import Ports
**Entry Ports:**
${bulletList([lead.destinationPorts])}

**Origin Ports:**
${bulletList([lead.originPorts])}

### Container Preferences
${bulletList([lead.containerTypes])}

---

## SECTION 6: BUYER HEALTH & RISK ASSESSMENT

### Buyer Health Score: ${analysis.healthScore}/100

**Status:** ${healthLevel(analysis.healthScore)}  
**Risk Level:** ${riskLabel(h.riskLevel)}

#### Assessment
- **Growth Trend:** ${pct(h.growthRate)} YoY (${
    h.growthRate > 5 ? "expanding" : h.growthRate < -5 ? "contracting" : "flat"
  })
- **Supply Concentration Risk:** ${concentrationLabel(l.concentration)}
- **Volatility:** ${volatilityLabel(h.stabilityScore)}
- **Ordering Consistency:** ${num(h.consistencyScore, 1)}/25 (${
    h.consistencyScore >= 19 ? "buys nearly every month" : h.consistencyScore >= 12 ? "regular buyer" : "sporadic"
  })

---

## SECTION 7: VIETNAM SOURCING READINESS

### Vietnam Readiness Score: ${analysis.vietnamReadiness}/100

**Readiness Level:** ${vietnamReadinessLevel(analysis.vietnamReadiness)}

#### Score Breakdown
| Component | Score |
|-----------|-------|
| Product match with VN export strength | ${num(v.productMatchScore, 1)} / 40 |
| Prior VN supplier history | ${num(v.vnHistoryScore, 1)} / 30 |
| Asia sourcing experience | ${num(v.asiaScore, 1)} / 30 |

#### Factors
- Product match with VN exports: ${
    v.productMatchScore > 0 ? `✅ Yes (${num(v.productMatchScore, 1)}/40)` : "❌ Limited"
  }
- Prior experience with VN suppliers: ${v.hasVnHistory ? "✅ Yes" : "❌ No"}
- Experience with Asian suppliers: ${
    v.asiaExperience?.length ? `✅ Yes — ${v.asiaExperience.join(", ")}` : "❌ No"
  }

#### Existing Vietnam Suppliers
${vnSuppliers}

---

## SECTION 8: STRATEGIC RECOMMENDATION

### Recommended Approach

**Primary Angle:** ${text(strategy.recommendedAngle)}

${strategy.approachSummary ? `**Summary:** ${strategy.approachSummary}` : ""}

### Talking Points

${talkingPoints}

### Risk Factors To Anticipate

${riskFactors}

### Best Contact Strategy

| Element | Recommendation |
|---------|-----------------|
| **Timing** | ${text(strategy.timingSuggestion)} |
| **Peak Months** | ${text(lead.topPeakMonths)} |
| **Contact Method** | Email + LinkedIn research first |
| **Suggested Opening** | Introduce VN alternative for ${text(lead.mainProduct)} |
| **Initial Offer** | Trial order: 1-2 containers |
| **Follow-up Timeline** | 2 weeks if no response |

---

## SECTION 9: QUICK REFERENCE CHECKLIST

### Pre-Sales Checklist
- [ ] Verify buyer still active (last shipment: ${text(lead.lastShipmentDate)})
- [ ] Research incumbent supplier: ${text(l.topSupplierName)}
- [ ] Confirm HS codes match our products: ${text(lead.hsCode)}
- [ ] Prepare samples for: ${text(lead.mainProduct)}
- [ ] Time outreach against: ${text(strategy.timingSuggestion)}

### Pitch Preparation
- [ ] Highlight competitive advantages
- [ ] Prepare case study: Vietnamese suppliers in ${text(lead.mainProduct)}
- [ ] Confirm LR-recorded priority rating: ${
    lead.priorityRating != null ? `${lead.priorityRating}/5` : NA
  }
- [ ] Confirm lead time and payment terms with the factory
- [ ] Gather certifications relevant to ${text(lead.country)}

---

## SECTION 10: KEY INSIGHTS

### Supply Chain Opportunities
${bulletList([
    l.switchingRate >= 30
      ? `Buyer put ${num(l.switchingRate, 1)}% of 12-month volume with newly-added suppliers — they are actively trialling.`
      : null,
    l.concentration >= 70
      ? `Top 3 suppliers hold ${num(l.concentration, 1)}% of volume — a single disruption makes them receptive to a backup source.`
      : null,
    h.growthRate > 10
      ? `Volume is up ${pct(h.growthRate)} YoY — capacity, not just price, is likely the pressure point.`
      : null,
    h.growthRate < -10
      ? `Volume is down ${pct(h.growthRate)} YoY — lead with flexibility and low MOQ rather than a big commitment.`
      : null,
    v.hasVnHistory
      ? `Already importing from Vietnam (${v.vnSuppliers.map((s) => s.name).join(", ")}) — position as an addition, not a replacement.`
      : `No Vietnam history yet — expect to spend the first call establishing credibility.`
  ])}

### Vietnam Fit Signals
${bulletList([
    v.productMatchScore >= 20
      ? `HS codes align strongly with VN export strength (${num(v.productMatchScore, 1)}/40).`
      : null,
    v.asiaExperience?.length
      ? `Comfortable sourcing from Asia: ${v.asiaExperience.join(", ")}.`
      : null,
    v.vnSuppliers?.length
      ? `${v.vnSuppliers.length} Vietnamese supplier(s) already in their book.`
      : null,
  ])}

---

## SECTION 11: CONTACT INFORMATION

| Type | Detail |
|------|--------|
| **Company Name** | ${text(analysis.companyName || lead.companyName)} |
| **Address** | ${text(lead.importAddress)} |
| **Contact Person** | ${text(lead.contactPerson)} |
| **Email** | ${lead.contactEmail ? text(lead.contactEmail) : "[Research via website/LinkedIn]"} |
| **Phone** | ${text(lead.contactPhone)} |
| **Website** | ${text(lead.website)} |

---

## SECTION 12: NEXT STEPS

### Immediate Actions (Week 1-2)
1. Research incumbent supplier pricing & quality standards (${text(l.topSupplierName)})
2. Prepare 2-3 product samples with specs for ${text(lead.mainProduct)}
3. Draft personalized pitch email around the "${text(strategy.recommendedAngle)}" angle
4. Compile customer references from VN

### Timeline to First Order (Week 3-8)
1. Initial outreach: Email + LinkedIn
2. First call: Product overview & trial offer
3. Sample sending: 2-week evaluation period
4. Follow-up call: Address the risk factors listed in Section 8
5. Trial PO: first container(s), confirm lead time and payment terms

---

## DATA SOURCES & NOTES

- **Data Source:** ImportYeti commercial database${
    lead.importYetiLink ? ` — ${lead.importYetiLink}` : ""
  }
- **Analysis Date:** ${generatedDate}
- **Document ID:** ${documentId}
- **Scoring Engine:** lib/ai/buyer-analyzer.ts (deterministic, no LLM)
- **Strategy Engine:** ${modelLine}
- **Confidence:** ${strategy.confidenceScore ?? 0}/100

**Important Notes:**
- Scores are computed from historical customs data and describe past behaviour,
  not a forecast.
- Every figure in this brief traces to a field on BuyerAnalysisResult,
  BuyerStrategy, or the ImportYeti record. "N/A" means the source data was
  genuinely absent — nothing here is estimated or invented.
- Market conditions and buyer preferences change; verify before committing.

---

**Generated by:** Vexim Trade Intelligence System  
**Classification:** Business Intelligence - Confidential  
**For:** Sales & Business Development Team
`
}

/**
 * Export brief as downloadable text file
 */
export function exportBuyerBriefAsText(
  brief: string,
  companyName: string,
): { filename: string; content: string } {
  const safe = (companyName || "buyer")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
  const filename = `Buyer-Brief-${safe}-${Date.now()}.md`
  return {
    filename,
    content: brief,
  }
}
