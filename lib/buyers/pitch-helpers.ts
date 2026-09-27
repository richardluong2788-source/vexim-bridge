// Pitch-first flow (Phase 1, migration 093) — pure helpers.
//
// Mô hình: thay vì gửi buyer một danh sách Option A/B/C, AE gửi DUY NHẤT 1
// supplier được chọn giúp (primary) kèm lý do; các ứng viên khác nằm trong
// bench của AE (buyer không thấy). Flow danh sách cũ được giữ làm ngoại lệ.
//
// Module này cố tình pure: không import DB/AI/React — test được bằng node thuần
// (scripts/campaign-tests/pitch.test.js) và dùng được ở cả server actions lẫn UI.

export type PitchMode = "pitch" | "list"

/** Vai trò của 1 item trong version (cột buyer_engagement_shortlist_items.role). */
export type ShortlistItemRole = "primary" | "bench" | "option"

/** Role mà trang share BÊN BUYER được render — bench tuyệt đối không lọt. */
export const BUYER_FACING_ITEM_ROLES: readonly ShortlistItemRole[] = ["primary", "option"]

export function isBuyerFacingItem(role: string | null | undefined): boolean {
  return BUYER_FACING_ITEM_ROLES.includes((role ?? "option") as ShortlistItemRole)
}

/**
 * Validate lựa chọn pitch: đúng 1 primary, tối đa 2 bench, không trùng.
 * Trả về mảng clientIds theo thứ tự [primary, ...bench] để ghi position.
 */
export function validatePitchSelection(
  primaryId: string | null | undefined,
  benchIds: string[],
): { ok: true; ordered: string[] } | { ok: false; error: string } {
  if (!primaryId) return { ok: false, error: "pitch_primary_required" }
  const bench = benchIds.filter(Boolean)
  if (new Set(bench).size !== bench.length) return { ok: false, error: "pitch_bench_duplicate" }
  if (bench.includes(primaryId)) return { ok: false, error: "pitch_bench_contains_primary" }
  if (bench.length > 2) return { ok: false, error: "pitch_bench_max_2" }
  return { ok: true, ordered: [primaryId, ...bench] }
}

/**
 * Re-pitch gate: tách ứng viên thành đủ điều kiện / bị chặn.
 * Buyer đã bấm "declined" với một supplier thì KHÔNG được đề xuất lại supplier
 * đó trong cùng engagement — mỗi lần quay lại phải là một nhà máy khác kèm
 * lý do mới (học từ lý do chê là việc của Phase 2).
 */
export function filterRepitchEligible<T extends { clientId: string }>(
  candidates: T[],
  declinedClientIds: ReadonlySet<string>,
): { eligible: T[]; blocked: T[] } {
  const eligible: T[] = []
  const blocked: T[] = []
  for (const c of candidates) {
    ;(declinedClientIds.has(c.clientId) ? blocked : eligible).push(c)
  }
  return { eligible, blocked }
}

/**
 * Soạn pitch note (buyer-facing, EN) từ dữ liệu AI đã chấm — deterministic
 * template trên match reasoning, KHÔNG gọi LLM thêm. AE xem/sửa trước khi
 * duyệt gửi (nguyên tắc shadow: AI soạn, người duyệt).
 */
export function buildPitchNote(input: {
  supplierName: string
  highlights?: string[]
  matchReasoning?: string | null
  requirements?: { products?: string | null; moq?: string | null }
}): string {
  const parts: string[] = []
  const hl = (input.highlights ?? []).filter(Boolean).slice(0, 3)
  if (input.requirements?.products) {
    parts.push(
      `Based on your requirement for ${input.requirements.products}, we reviewed our vetted factories and recommend ${input.supplierName}.`,
    )
  } else {
    parts.push(`We reviewed our vetted factories and recommend ${input.supplierName} for you.`)
  }
  if (hl.length > 0) {
    parts.push(`Why this one: ${hl.join("; ")}.`)
  } else if (input.matchReasoning) {
    parts.push(`Why this one: ${input.matchReasoning}`)
  }
  parts.push(
    "If this direction looks right, I can arrange the next step (spec review, samples, or a call with the factory team).",
  )
  return parts.join(" ")
}

/**
 * Block "sản phẩm đề xuất" trong snapshot (v1, KHÔNG giá).
 *
 * Nguyên tắc: chỉ gắn khi match TỰ ĐỘNG đạt điều kiện — eligible (FDA ok,
 * chưa gắn buyer) và matchScore >= 70 (tránh match nhiễu trên catalog dài).
 * Match thủ công (không có match) hoặc score thấp → null → share page giữ
 * card công ty như cũ. Giá cố tình không đưa vào: catalog do supplier tự
 * nhập, giá dễ cũ — giá là sân của AE ở bước quote.
 */
export const MATCHED_PRODUCT_MIN_SCORE = 70

export interface MatchedProductSnapshot {
  product_name: string
  key_specifications: string | null
  /** MOQ ở cấp SẢN PHẨM (khác MOQ indicative cấp công ty). */
  moq: string | null
  lead_time: string | null
  incoterm: string | null
}

export function buildMatchedProductSnapshot(
  product:
    | {
        product_name: string
        key_specifications?: string | null
        moq_value?: number | null
        moq_unit?: string | null
        lead_time?: string | null
        incoterm?: string | null
      }
    | null
    | undefined,
  matchScore: number | null | undefined,
  eligible: boolean | null | undefined,
): MatchedProductSnapshot | null {
  if (!product?.product_name) return null
  if (!eligible) return null
  if ((matchScore ?? 0) < MATCHED_PRODUCT_MIN_SCORE) return null
  const moq =
    product.moq_value != null
      ? `${product.moq_value}${product.moq_unit ? ` ${product.moq_unit}` : ""}`
      : null
  return {
    product_name: product.product_name,
    key_specifications: product.key_specifications ?? null,
    moq,
    lead_time: product.lead_time ?? null,
    incoterm: product.incoterm ?? null,
  }
}

/**
 * Stage khởi đầu khi AE claim buyer (luồng claim → engagement).
 *
 * Buyer CHỦ ĐỘNG (inbound, `has_active_inquiry` = true — migration 068): nhu
 * cầu là do buyer tự đưa ra qua kênh ngoài (Zalo/email/hội chợ…), LR đã ghi
 * nhận đầy đủ và claimBuyer prefill vào engagement → không qua stage
 * "claimed — chưa hỏi nhu cầu", vào thẳng `requirements_received` để AE thấy
 * ngay nút primary "Chọn supplier (AI gợi ý)" thay vì phải bấm Save form
 * ghi nhận nhu cầu (đã điền sẵn) chỉ để nhảy stage.
 *
 * Buyer nghiên cứu (outbound, ImportYeti): giữ nguyên path cũ `claimed`.
 */
export function claimInitialStage(
  hasActiveInquiry: boolean | null | undefined,
): "claimed" | "requirements_received" {
  return hasActiveInquiry ? "requirements_received" : "claimed"
}

/** Giá trị contact_channel trên buyer_engagements (đồng bộ với engagement-actions). */
export type ContactChannelValue = "system_email" | "linkedin" | "whatsapp" | "phone" | "other"

/**
 * Map kênh inquiry của buyer (068, 8 giá trị) → contact_channel của engagement
 * (5 giá trị). Enum contact_channel không có "zalo"/"trade_fair"/"referral" —
 * các kênh đó về "other"; chi tiết kênh gốc vẫn được giữ trong
 * other_requirements ("Kênh: Zalo"…) nên không mất thông tin.
 * null (lạ — has inquiry mà không ghi kênh) → "other".
 */
export function mapInquiryChannelToContactChannel(
  channel: string | null | undefined,
): ContactChannelValue {
  switch (channel) {
    case "email":
      return "system_email"
    case "phone":
      return "phone"
    case "whatsapp":
      return "whatsapp"
    case "linkedin":
      return "linkedin"
    default:
      // zalo, trade_fair, referral, other, null
      return "other"
  }
}

/** Map buyer_action → buyer quan tâm hay không (dùng khi ghi item + gate). */
export function isInterestedAction(action: string | null | undefined): boolean | null {
  if (!action) return null
  if (action === "viewed_only") return null
  if (action === "declined") return false
  return true
}
