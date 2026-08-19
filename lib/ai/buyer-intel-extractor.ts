/**
 * Buyer Intel Extractor
 *
 * AE ghi lại ghi chú tự do sau khi liên lạc trực tiếp với buyer (điện thoại,
 * email, chat...). Module này dùng AI SDK để phân loại và trích xuất thông tin
 * có cấu trúc từ ghi chú đó: giá cả, chính sách thanh toán, hồ sơ/chứng từ,
 * kiểm nghiệm. Kết quả chỉ là GỢI Ý — AE tự xem lại và bấm "Áp dụng" để ghi
 * vào opportunity, AI không tự động ghi đè dữ liệu.
 */

import { generateText, Output } from "ai"
import { z } from "zod"

// ══════════════════════════════════════════════════════════════════════════════
// Schema for AI Output
// ══════════════════════════════════════════════════════════════════════════════

export const BuyerIntelExtractionSchema = z.object({
  category: z
    .enum(["pricing", "payment", "documents", "testing", "general"])
    .describe("Nhóm thông tin chính của ghi chú này"),

  summary: z
    .string()
    .describe("Tóm tắt ngắn gọn (1-2 câu, tiếng Việt) nội dung ghi chú"),

  pricing: z
    .object({
      mentioned: z.boolean().describe("Ghi chú có đề cập giá không"),
      priceValue: z.number().nullable().describe("Giá trị số nếu có, null nếu không rõ"),
      priceUnit: z.string().nullable().describe("Đơn vị giá, ví dụ USD/kg, USD/container"),
      incoterms: z.string().nullable().describe("Điều kiện giao hàng nếu có, ví dụ FOB, CIF"),
      note: z.string().nullable().describe("Chi tiết bổ sung về giá"),
    })
    .describe("Thông tin về giá đã trao đổi với buyer"),

  payment: z
    .object({
      mentioned: z.boolean().describe("Ghi chú có đề cập chính sách thanh toán không"),
      terms: z.string().nullable().describe("Điều khoản thanh toán, ví dụ TT 30/70, LC at sight"),
      note: z.string().nullable().describe("Chi tiết bổ sung về thanh toán"),
    })
    .describe("Thông tin về chính sách thanh toán"),

  documents: z
    .object({
      mentioned: z.boolean().describe("Ghi chú có đề cập hồ sơ/chứng từ không"),
      required: z.array(z.string()).describe("Danh sách hồ sơ/chứng từ buyer yêu cầu"),
      note: z.string().nullable().describe("Chi tiết bổ sung về hồ sơ"),
    })
    .describe("Thông tin về hồ sơ, chứng từ buyer yêu cầu"),

  testing: z
    .object({
      mentioned: z.boolean().describe("Ghi chú có đề cập kiểm nghiệm không"),
      requirements: z.array(z.string()).describe("Yêu cầu kiểm nghiệm cụ thể, ví dụ test kim loại nặng, chứng nhận organic"),
      note: z.string().nullable().describe("Chi tiết bổ sung về kiểm nghiệm"),
    })
    .describe("Thông tin về yêu cầu kiểm nghiệm, kiểm định chất lượng"),

  suggestedFieldUpdates: z
    .object({
      targetPriceUsd: z.number().nullable().describe("Giá trị đề xuất cập nhật cho field target_price_usd của opportunity, null nếu không có"),
      priceUnit: z.string().nullable().describe("Giá trị đề xuất cập nhật cho field price_unit"),
      incoterms: z.string().nullable().describe("Giá trị đề xuất cập nhật cho field incoterms"),
      paymentTerms: z.string().nullable().describe("Giá trị đề xuất cập nhật cho field payment_terms"),
    })
    .describe("Các field cụ thể trên opportunity có thể cập nhật, AE sẽ xác nhận trước khi áp dụng"),
})

export type BuyerIntelExtraction = z.infer<typeof BuyerIntelExtractionSchema>

// ══════════════════════════════════════════════════════════════════════════════
// Extraction
// ══════════════════════════════════════════════════════════════════════════════

export async function extractBuyerIntel(rawNote: string): Promise<BuyerIntelExtraction> {
  const prompt = `Bạn là trợ lý phân tích ghi chú nội bộ của nhân viên kinh doanh (AE) xuất khẩu Việt Nam.

AE vừa liên lạc trực tiếp với buyer (gọi điện, email, chat) và ghi lại một đoạn ghi chú tự do. Nhiệm vụ của bạn là đọc ghi chú, phân loại vào đúng nhóm và trích xuất thông tin có cấu trúc theo 4 nhóm: giá cả (pricing), chính sách thanh toán (payment), hồ sơ/chứng từ (documents), kiểm nghiệm (testing).

Nếu ghi chú không đề cập rõ một nhóm nào, đặt "mentioned": false cho nhóm đó và để các field liên quan là null/rỗng — KHÔNG bịa thông tin.

Với "suggestedFieldUpdates", chỉ điền giá trị khi ghi chú nêu RÕ RÀNG một số liệu hoặc điều khoản cụ thể có thể áp trực tiếp vào hồ sơ deal (ví dụ "giá chốt 1200 USD/tấn FOB" → targetPriceUsd: 1200, priceUnit: "USD/tấn", incoterms: "FOB"). Nếu chỉ là trao đổi sơ bộ, chưa chốt, để null.

## GHI CHÚ CỦA AE

"""
${rawNote}
"""`

  const { output } = await generateText({
    model: "openai/gpt-4o-mini",
    output: Output.object({
      schema: BuyerIntelExtractionSchema,
    }),
    prompt,
    temperature: 0.3,
  })

  if (!output) {
    throw new Error("AI không trả về kết quả phân tích ghi chú")
  }

  return output
}
