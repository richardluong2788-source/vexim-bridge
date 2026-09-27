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

/** Map buyer_action → buyer quan tâm hay không (dùng khi ghi item + gate). */
export function isInterestedAction(action: string | null | undefined): boolean | null {
  if (!action) return null
  if (action === "viewed_only") return null
  if (action === "declined") return false
  return true
}
