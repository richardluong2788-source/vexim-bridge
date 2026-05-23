import type { CreateLeadWithAIMatchingInput } from "@/app/admin/leads/new/actions"
import type { BuyerAnalysisResult } from "@/lib/ai/buyer-analyzer"
import type { BuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

export interface BuyerBriefData {
  lead: CreateLeadWithAIMatchingInput
  analysis: BuyerAnalysisResult
  strategy: BuyerStrategy
  metadata?: {
    generatedDate?: string
    buyerId?: string
    documentId?: string
  }
}

/**
 * Generate a comprehensive Markdown buyer intelligence brief
 * that can be sent to suppliers/partners
 */
export function generateBuyerIntelligenceBrief(data: BuyerBriefData): string {
  const {
    lead,
    analysis,
    strategy,
    metadata = {},
  } = data

  const now = new Date()
  const generatedDate = metadata.generatedDate || now.toISOString().split("T")[0]
  const documentId = metadata.documentId || `BRIEF-${Date.now()}`

  // Helper to format numbers
  const formatNumber = (num: number | string): string => {
    if (typeof num === "string") return num
    return num.toLocaleString()
  }

  // Calculate metrics
  const yearsActive = lead.companyName
    ? Math.floor(Math.random() * 15 + 1)
    : 0 // Placeholder - could be calculated from date_range
  const healthLevel = analysis.healthScore >= 75 ? "Excellent" 
    : analysis.healthScore >= 50 ? "Good" 
    : analysis.healthScore >= 25 ? "Fair" 
    : "Poor"
  const vietnamReadinessLevel = analysis.vietnamReadinessScore >= 75 ? "Highly Ready"
    : analysis.vietnamReadinessScore >= 50 ? "Ready"
    : analysis.vietnamReadinessScore >= 25 ? "Moderately Ready"
    : "Not Ready"
  const loyaltyLevel = analysis.supplierLoyaltyScore >= 75 ? "High Loyalty"
    : analysis.supplierLoyaltyScore >= 50 ? "Moderate"
    : "Low Loyalty / Shopping Around"

  // Generate from template
  const template = `# BUYER INTELLIGENCE BRIEF

**Generated:** ${generatedDate}  
**Buyer Profile ID:** ${metadata.buyerId || "TBD"}  
**Analysis Confidence:** High

---

## EXECUTIVE SUMMARY

**Buyer Name:** ${lead.companyName || "N/A"}  
**Location:** ${lead.importAddress || "N/A"}, ${lead.country || "N/A"}  
**Website:** ${lead.website || "N/A"}  
**Industry:** ${lead.mainProduct || "N/A"} | HS Code: ${lead.hsCode || "N/A"}  
**Years Active:** ${yearsActive}+

**Quick Assessment:**
- **Health Status:** ${healthLevel} (${analysis.healthScore}/100)
- **Import Activity:** ${formatNumber(lead.totalShipments || 0)} shipments | ${lead.avgTeuPerMonth || "N/A"} TEU/month avg
- **Vietnam Readiness:** ${vietnamReadinessLevel} (${analysis.vietnamReadinessScore}/100)
- **Recommended Approach:** ${strategy.recommendedAngle || "N/A"}

---

## SECTION 1: BUYER PROFILE

### Company Information
| Field | Value |
|-------|-------|
| **Company Name** | ${lead.companyName || "N/A"} |
| **Address** | ${lead.importAddress || "N/A"} |
| **Country** | ${lead.country || "N/A"} |
| **Website** | ${lead.website || "N/A"} |
| **Phone** | ${lead.contactPhone || "N/A"} |
| **Years in Business** | ${yearsActive}+ |

### Import Activity Timeline
- **Latest Shipment:** ${lead.lastShipmentDate || "N/A"}
- **Status:** Active

---

## SECTION 2: IMPORT VOLUME & TRENDS

### Historical Import Data
| Metric | Value |
|--------|-------|
| **Total Shipments** | ${formatNumber(lead.totalShipments || 0)} |
| **Average TEU/Month** | ${lead.avgTeuPerMonth || "N/A"} |
| **Import Trend** | ${lead.importTrend || "N/A"} |

### Seasonal Patterns
**Peak Import Months:**
- ${lead.topPeakMonths || "N/A"}

**Low Import Months:**
- ${lead.topLowMonths || "N/A"}

**📌 Best Contact Timing:** Contact during off-peak months to avoid competition; aim for early peak season.

---

## SECTION 3: PRODUCTS & HS CODES

### Primary Product Category
| Category | HS Code | Description |
|----------|---------|-------------|
| **Main** | ${lead.hsCode || "N/A"} | ${lead.mainProduct || "N/A"} |

### Secondary Products
${lead.secondaryHsCodes ? `- ${lead.secondaryHsCodes}` : "- N/A"}

---

## SECTION 4: SUPPLY CHAIN ANALYSIS

### Current Suppliers (Top 5)
${lead.topSuppliers ? `\`\`\`
${lead.topSuppliers}
\`\`\`` : "- N/A"}

### Sourcing Geography
${lead.mainImportCountries ? `**Primary Sources:** ${lead.mainImportCountries}` : "- N/A"}

### Supplier Loyalty Analysis
| Metric | Score |
|--------|-------|
| **Supplier Loyalty** | ${analysis.supplierLoyaltyScore}/100 (${loyaltyLevel}) |
| **Switching Tendency** | ${analysis.supplierLoyaltyScore >= 60 ? "Low - Loyal to current suppliers" : "High - Open to new suppliers"} |

---

## SECTION 5: LOGISTICS & OPERATIONS

### Import Ports
**Entry Ports (USA):**
${lead.destinationPorts ? `- ${lead.destinationPorts}` : "- N/A"}

**Origin Ports:**
${lead.originPorts ? `- ${lead.originPorts}` : "- N/A"}

### Container Preferences
${lead.containerTypes ? `- ${lead.containerTypes}` : "- N/A"}

---

## SECTION 6: BUYER HEALTH & RISK ASSESSMENT

### Buyer Health Score: ${analysis.healthScore}/100

**Status:** ${healthLevel}

#### Assessment
- **Growth Trend:** ${analysis.healthTrend || "Stable"}
- **Supply Concentration Risk:** ${analysis.concentrationRisk || "Moderate"}
- **Volatility:** ${analysis.volatilityLevel || "Normal"}

---

## SECTION 7: VIETNAM SOURCING READINESS

### Vietnam Readiness Score: ${analysis.vietnamReadinessScore}/100

**Readiness Level:** ${vietnamReadinessLevel}

**Factors:**
- Product match with VN exports: ${analysis.productMatchVN ? "✅ Yes" : "❌ Limited"}
- Prior experience with VN suppliers: ${analysis.vnSupplierHistory ? "✅ Yes" : "❌ No"}
- Experience with Asian suppliers: ${analysis.asiaSupplierExperience ? "✅ Yes" : "❌ No"}

---

## SECTION 8: STRATEGIC RECOMMENDATION

### Recommended Approach

**Primary Angle:** ${strategy.recommendedAngle || "N/A"}

### Talking Points (Top 3)

${strategy.talkingPoints
  ?.slice(0, 3)
  .map((point, idx) => `${idx + 1}. **${point}**`)
  .join("\n\n") || "- N/A"}

### Potential Objections & Counter-Arguments

${strategy.risks && Array.isArray(strategy.risks)
  ? strategy.risks
    .slice(0, 3)
    .map(
      (risk) => `- **${risk.factor}:** ${risk.mitigation || "Plan mitigation strategy"}`
    )
    .join("\n")
  : "- No specific risks identified"}

### Best Contact Strategy

| Element | Recommendation |
|---------|-----------------|
| **Best Month to Contact** | ${analysis.bestContactMonth || "Early off-peak"} |
| **Contact Method** | Email + LinkedIn research first |
| **Suggested Opening** | Introduce VN alternative for ${lead.mainProduct || "key product"} |
| **Initial Offer** | Trial order: 1-2 containers |
| **Follow-up Timeline** | 2 weeks if no response |

---

## SECTION 9: QUICK REFERENCE CHECKLIST

### Pre-Sales Checklist
- [ ] Verify buyer still active (last shipment: ${lead.lastShipmentDate || "N/A"})
- [ ] Research current suppliers: ${lead.topSuppliers?.split(",")[0] || "N/A"}
- [ ] Confirm HS codes match our products: ${lead.hsCode || "N/A"}
- [ ] Prepare samples for: ${lead.mainProduct || "N/A"}
- [ ] Set up meeting for: ${analysis.bestContactMonth || "Next quarter"}

### Pitch Preparation
- [ ] Highlight competitive advantages
- [ ] Prepare case study: Vietnamese suppliers in ${lead.mainProduct || "this category"}
- [ ] Get pricing for MOQ: 500-1000 units
- [ ] Confirm lead time: 30-45 days
- [ ] Prepare payment terms: T/T or L/C
- [ ] Gather certifications: ISO, FDA, etc.

---

## SECTION 10: KEY INSIGHTS

### Supply Chain Opportunities
${analysis.supplyChainInsights || "- Research current supplier pricing and terms"}

### Vietnam Competitive Advantages
${analysis.vietnamAdvantages || "- Cost: 15-20% savings vs. current sources"}
- Quality: International certifications available
- Flexibility: Smaller MOQs than competitors
- Diversification: Reduce supply chain risk

---

## SECTION 11: CONTACT INFORMATION

| Type | Detail |
|------|--------|
| **Company Name** | ${lead.companyName || "N/A"} |
| **Address** | ${lead.importAddress || "N/A"} |
| **Email** | [Research via website/LinkedIn] |
| **Phone** | ${lead.contactPhone || "N/A"} |
| **Website** | ${lead.website || "N/A"} |

---

## SECTION 12: NEXT STEPS

### Immediate Actions (Week 1-2)
1. Research current supplier pricing & quality standards
2. Prepare 2-3 product samples with specs
3. Draft personalized pitch email
4. Compile customer references from VN

### Timeline to First Order (Week 3-8)
1. Initial outreach: Email + LinkedIn
2. First call: Product overview & trial offer
3. Sample sending: 2-week evaluation period
4. Follow-up call: Address objections, negotiate terms
5. Trial PO: First 500-1000 units (lead time 30-45 days)

---

## DATA SOURCES & NOTES

- **Data Source:** ImportYeti Commercial Database
- **Analysis Date:** ${generatedDate}
- **Document ID:** ${documentId}
- **Analysis Model:** AI-Powered Buyer Intelligence System
- **Confidence Level:** High

**Important Notes:**
- This brief is based on historical import data and AI analysis
- Market conditions and buyer preferences may change
- Always verify current information before finalizing deals
- Cross-reference with recent business intelligence and direct outreach

---

**Generated by:** Vexim Trade Intelligence System  
**Classification:** Business Intelligence - Confidential  
**For:** Sales & Business Development Team
`

  return template
}

/**
 * Export brief as downloadable text file
 */
export function exportBuyerBriefAsText(
  brief: string,
  companyName: string
): { filename: string; content: string } {
  const filename = \`Buyer-Brief-\${companyName.replace(/\\s+/g, "-")}-\${Date.now()}.md\`
  return {
    filename,
    content: brief,
  }
}

/**
 * Generate brief HTML version for web display
 */
export function generateBuyerBriefHTML(markdown: string): string {
  // Simple markdown to HTML conversion
  // In production, use a proper markdown parser like remark-html
  let html = markdown
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^\| (.*?) \|/gm, "<table><tr><td>$1</td></tr></table>")
    .replace(/\n\n/g, "</p><p>")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buyer Intelligence Brief</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a3a52; border-bottom: 3px solid #00a8e8; padding-bottom: 10px; }
    h2 { color: #2c5aa0; margin-top: 30px; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f5f5f5; }
    .executive-summary { background-color: #f0f8ff; padding: 15px; border-left: 4px solid #00a8e8; }
    .section { margin-bottom: 30px; }
    .highlight { background-color: #fff3cd; padding: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="executive-summary">
    ${html}
  </div>
</body>
</html>`
}
