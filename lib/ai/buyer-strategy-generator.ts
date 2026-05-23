/**
 * Buyer Strategy Generator
 * 
 * Uses AI SDK 6 to generate strategic approach recommendations
 * based on buyer analysis data.
 */

import { generateText, Output } from "ai"
import { z } from "zod"
import type { BuyerAnalysisResult } from "./buyer-analyzer"
import type { ImportYetiAPIData } from "@/lib/importyeti/api-transformer"

// ══════════════════════════════════════════════════════════════════════════════
// Schema for AI Output
// ══════════════════════════════════════════════════════════════════════════════

export const BuyerStrategySchema = z.object({
  recommendedAngle: z.string().describe("Main approach angle: price, quality, diversification, reliability, or capacity"),
  
  riskFactors: z.array(z.string()).describe("List of 2-4 risk factors to be aware of when approaching this buyer"),
  
  talkingPoints: z.array(z.string()).describe("List of 3-5 key talking points to use when contacting this buyer"),
  
  timingSuggestion: z.string().describe("When is the best time to contact this buyer based on their import patterns"),
  
  approachSummary: z.string().describe("2-3 sentence summary of the recommended approach strategy in Vietnamese"),
  
  confidenceScore: z.number().min(0).max(100).describe("Confidence level in this strategy recommendation"),
})

export type BuyerStrategy = z.infer<typeof BuyerStrategySchema>

export interface FullBuyerAnalysis {
  analysis: BuyerAnalysisResult
  strategy: BuyerStrategy
}

// ══════════════════════════════════════════════════════════════════════════════
// Prompt Builder
// ══════════════════════════════════════════════════════════════════════════════

function buildStrategyPrompt(
  analysis: BuyerAnalysisResult,
  rawData: ImportYetiAPIData
): string {
  // Extract key data points
  const topSuppliers = rawData.suppliers_table?.slice(0, 5).map(s => ({
    name: s.supplier_name,
    country: s.supplier_address_country,
    shipments: s.total_shipments_company,
    tenure: s.business_length,
    isNew: s.is_new_supplier,
  })) || []

  const topHsCodes = rawData.hs_codes?.slice(0, 5).map(hs => ({
    code: hs.hs_code,
    description: hs.description,
    shipments: hs.shipments,
  })) || []

  const recentBols = rawData.recent_bols?.slice(0, 3).map(bol => ({
    date: bol.date_formatted,
    supplier: bol.Shipper_Name,
    product: bol.Product_Description?.substring(0, 100),
    country: bol.supplier_address_country,
  })) || []

  // Build peak months info
  const timeSeries = rawData.time_series || {}
  const monthlyData = Object.entries(timeSeries)
    .map(([date, data]) => ({ date, teu: data.teu }))
    .sort((a, b) => b.teu - a.teu)
  const peakMonths = monthlyData.slice(0, 3).map(m => m.date)

  return `
Bạn là chuyên gia tư vấn xuất khẩu Việt Nam. Phân tích buyer sau và đề xuất chiến lược tiếp cận.

## THÔNG TIN BUYER

**Tên công ty:** ${analysis.companyName}
**Quốc gia:** ${rawData.country}
**Hoạt động:** ${analysis.yearsActive} năm
**Tổng lô hàng:** ${analysis.totalShipments.toLocaleString()}

## ĐIỂM PHÂN TÍCH

| Metric | Score | Chi tiết |
|--------|-------|----------|
| Health Score | ${analysis.healthScore}/100 | Growth: ${analysis.healthBreakdown.growthRate}% YoY, Risk: ${analysis.healthBreakdown.riskLevel} |
| Supplier Loyalty | ${analysis.loyaltyScore}/100 | Top supplier: ${analysis.loyaltyBreakdown.topSupplierName} (${analysis.loyaltyBreakdown.topSupplierCountry}) - ${analysis.loyaltyBreakdown.topSupplierTenure} |
| Vietnam Readiness | ${analysis.vietnamReadiness}/100 | ${analysis.vietnamBreakdown.hasVnHistory ? `Đã mua từ VN: ${analysis.vietnamBreakdown.vnSuppliers.map(s => s.name).join(", ")}` : "Chưa có lịch sử mua từ VN"} |

## TOP SUPPLIERS HIỆN TẠI

${topSuppliers.map((s, i) => `${i + 1}. ${s.name} (${s.country}) - ${s.shipments.toLocaleString()} lô hàng, ${s.tenure}${s.isNew ? " [MỚI]" : ""}`).join("\n")}

## SẢN PHẨM CHÍNH (HS CODES)

${topHsCodes.map((hs, i) => `${i + 1}. ${hs.code}: ${hs.description} (${hs.shipments.toLocaleString()} lô)`).join("\n")}

## LÔ HÀNG GẦN ĐÂY

${recentBols.map((bol, i) => `${i + 1}. ${bol.date} - ${bol.supplier} (${bol.country}): ${bol.product}`).join("\n")}

## THÔNG TIN LOGISTICS

- Cảng nhập: ${Object.keys(rawData.map_table?.entry_ports || {}).slice(0, 3).join(", ")}
- Cảng xuất: ${Object.keys(rawData.map_table?.exit_ports || {}).slice(0, 3).join(", ")}
- Peak months: ${peakMonths.join(", ")}
- Asia experience: ${analysis.vietnamBreakdown.asiaExperience.join(", ") || "Limited"}

## YÊU CẦU

Dựa trên dữ liệu trên, hãy đề xuất:

1. **Góc tiếp cận** phù hợp nhất (giá, chất lượng, đa dạng hóa nguồn cung, độ tin cậy, năng lực sản xuất)
2. **Các rủi ro** cần lưu ý khi tiếp cận buyer này
3. **Điểm nói chuyện** quan trọng khi liên hệ
4. **Thời điểm liên hệ** tốt nhất dựa trên mùa nhập hàng
5. **Tóm tắt chiến lược** bằng tiếng Việt

Lưu ý:
- Nếu buyer đã có supplier VN, focus vào expand hoặc thay thế
- Nếu buyer rất loyal với 1 supplier, đề xuất angle diversification/backup
- Nếu buyer đang giảm volume, thận trọng với dự đoán
- Nếu Vietnam Readiness cao, nhấn mạnh VN capabilities
`
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Generator Function
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate AI-powered approach strategy for a buyer
 */
export async function generateBuyerStrategy(
  analysis: BuyerAnalysisResult,
  rawData: ImportYetiAPIData
): Promise<BuyerStrategy> {
  
  const prompt = buildStrategyPrompt(analysis, rawData)
  
  const result = await generateText({
    model: "openai/gpt-4o-mini",
    output: Output.object({
      schema: BuyerStrategySchema,
    }),
    prompt,
    temperature: 0.7,
  })

  // Extract the parsed object from result
  const strategy = result.object

  if (!strategy) {
    // Return fallback strategy if AI fails
    return generateFallbackStrategy(analysis)
  }

  return strategy
}

/**
 * Fallback strategy when AI is unavailable
 */
function generateFallbackStrategy(analysis: BuyerAnalysisResult): BuyerStrategy {
  const { healthBreakdown, loyaltyBreakdown, vietnamBreakdown } = analysis
  
  // Determine angle based on scores
  let recommendedAngle = "diversification"
  if (analysis.loyaltyScore > 70) {
    recommendedAngle = "diversification"
  } else if (analysis.vietnamReadiness > 60) {
    recommendedAngle = "quality"
  } else if (healthBreakdown.growthRate > 10) {
    recommendedAngle = "capacity"
  } else {
    recommendedAngle = "price"
  }
  
  // Build risk factors
  const riskFactors: string[] = []
  if (analysis.loyaltyScore > 70) {
    riskFactors.push(`Buyer rất loyal với ${loyaltyBreakdown.topSupplierName} (${loyaltyBreakdown.topSupplierTenure})`)
  }
  if (healthBreakdown.riskLevel === "high") {
    riskFactors.push(`Volume đang giảm (${healthBreakdown.growthRate}% YoY) - buyer có thể đang thu hẹp`)
  }
  if (!vietnamBreakdown.hasVnHistory) {
    riskFactors.push("Chưa có lịch sử mua từ Việt Nam - cần thuyết phục nhiều hơn")
  }
  if (loyaltyBreakdown.concentration > 80) {
    riskFactors.push(`${loyaltyBreakdown.concentration.toFixed(0)}% hàng từ top 3 supplier - khó chen chân`)
  }
  
  // Build talking points
  const talkingPoints: string[] = []
  if (vietnamBreakdown.hasVnHistory) {
    talkingPoints.push(`Đã có kinh nghiệm với supplier VN: ${vietnamBreakdown.vnSuppliers.map(s => s.name).join(", ")}`)
  }
  if (vietnamBreakdown.asiaExperience.length > 0) {
    talkingPoints.push(`Có kinh nghiệm mua từ Asia: ${vietnamBreakdown.asiaExperience.join(", ")}`)
  }
  if (healthBreakdown.growthRate > 0) {
    talkingPoints.push(`Đang tăng trưởng ${healthBreakdown.growthRate.toFixed(1)}% - có thể cần thêm supplier`)
  }
  talkingPoints.push("Vietnam có giá cạnh tranh và chất lượng ngày càng cải thiện")
  talkingPoints.push("Đa dạng hóa nguồn cung giảm rủi ro supply chain")
  
  return {
    recommendedAngle,
    riskFactors: riskFactors.slice(0, 4),
    talkingPoints: talkingPoints.slice(0, 5),
    timingSuggestion: "Liên hệ 1-2 tháng trước mùa cao điểm để có thời gian đàm phán và sample",
    approachSummary: `Buyer này ${analysis.loyaltyScore > 60 ? "khá loyal với supplier hiện tại" : "có thể mở với supplier mới"}. ${vietnamBreakdown.hasVnHistory ? "Đã có kinh nghiệm VN nên focus vào mở rộng hợp tác." : "Chưa có kinh nghiệm VN nên cần giới thiệu kỹ capabilities."} Đề xuất tiếp cận theo hướng ${recommendedAngle}.`,
    confidenceScore: 65,
  }
}

/**
 * Combined function: Analyze buyer + Generate strategy
 */
export async function analyzeAndGenerateStrategy(
  analysis: BuyerAnalysisResult,
  rawData: ImportYetiAPIData
): Promise<FullBuyerAnalysis> {
  try {
    const strategy = await generateBuyerStrategy(analysis, rawData)
    return { analysis, strategy }
  } catch (error) {
    console.error("[BuyerStrategyGenerator] AI generation failed, using fallback:", error)
    const fallbackStrategy = generateFallbackStrategy(analysis)
    return { analysis, strategy: fallbackStrategy }
  }
}
