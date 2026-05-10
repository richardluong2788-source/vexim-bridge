"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { assertOpportunityOwnership } from "@/lib/auth/ownership"
import type { BankDirectoryEntry, LCVerification } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate the structural shape of a SWIFT BIC code (ISO 9362).
 * 8 chars: AAAA + CC + LL  (bank + country + location)
 * 11 chars: AAAA + CC + LL + BBB (with branch)
 * Returns the normalised, uppercase BIC if valid; otherwise null.
 */
export async function normalizeBic(input: string): Promise<string | null> {
  const cleaned = input.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned)) return null
  return cleaned
}

const TIER_MAP: Record<1 | 2 | 3 | 4, { label: string; recommendation: string }> = {
  1: {
    label: "Tier 1 — An toàn",
    recommendation:
      "Ngân hàng top toàn cầu, có quan hệ đại lý với ngân hàng VN. L/C at sight chấp nhận được; vẫn yêu cầu nhận qua SWIFT MT700.",
  },
  2: {
    label: "Tier 2 — Trung bình",
    recommendation:
      "Ngân hàng có rating tốt nhưng cần thận trọng. KHUYẾN NGHỊ: Yêu cầu L/C confirmed bởi một bank Tier 1 (ví dụ HSBC, Citi, Standard Chartered).",
  },
  3: {
    label: "Tier 3 — Cao",
    recommendation:
      "Ngân hàng ở quốc gia rủi ro cao hoặc không có quan hệ đại lý với VN. BẮT BUỘC: L/C confirmed + 30% TT trước khi sản xuất. Cân nhắc từ chối nếu buyer không chấp nhận.",
  },
  4: {
    label: "Tier 4 — Cấm giao dịch",
    recommendation:
      "Ngân hàng nằm trong danh sách trừng phạt (OFAC/EU/UN) hoặc blacklist nội bộ. KHÔNG thực hiện giao dịch dưới mọi hình thức.",
  },
}

// ---------------------------------------------------------------------------
// Bank lookup (Layer 1 + 2 + 3)
// ---------------------------------------------------------------------------

export type BankLookupResult =
  | { ok: true; entry: BankDirectoryEntry; tierLabel: string; recommendation: string }
  | { ok: false; reason: "invalid_bic" | "not_found"; normalizedBic: string | null }

export async function lookupBank(rawBic: string): Promise<BankLookupResult> {
  const bic = await normalizeBic(rawBic)
  if (!bic) {
    return { ok: false, reason: "invalid_bic", normalizedBic: null }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bank_directory")
    .select("*")
    .eq("bic", bic)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, reason: "not_found", normalizedBic: bic }
  }

  const entry = data as BankDirectoryEntry
  const tierInfo = TIER_MAP[entry.tier]
  return {
    ok: true,
    entry,
    tierLabel: tierInfo.label,
    recommendation: tierInfo.recommendation,
  }
}

// ---------------------------------------------------------------------------
// Load + upsert L/C verification
// ---------------------------------------------------------------------------

export async function getLCVerification(
  opportunityId: string,
): Promise<{ ok: true; data: LCVerification | null } | { ok: false; error: string }> {
  const guard = await requireCap(CAPS.DEAL_VIEW)
  if (!guard.ok) return { ok: false, error: "unauthorized" }

  const ownership = await assertOpportunityOwnership(
    guard.admin,
    guard.role,
    guard.userId,
    opportunityId,
  )
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const { data, error } = await guard.admin
      .from("lc_verifications")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data as LCVerification | null) ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

export type LCVerificationPayload = {
  opportunity_id: string
  bank_bic: string | null
  received_via_swift: boolean
  bic_matches: boolean
  amount_matches_po: boolean
  description_matches_po: boolean
  shipment_date_reasonable: boolean
  no_soft_clauses: boolean
  lc_document_url: string | null
  rejection_reason: string | null
}

export async function saveLCVerification(
  payload: LCVerificationPayload,
): Promise<{ ok: true; data: LCVerification } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "Bạn cần đăng nhập." }

    // Resolve bank info if BIC provided
    let bankSnapshot: {
      bank_bic: string | null
      bank_name_snapshot: string | null
      bank_country_snapshot: string | null
      detected_tier: number | null
      detected_sanctioned: boolean | null
      recommendation: string | null
    } = {
      bank_bic: null,
      bank_name_snapshot: null,
      bank_country_snapshot: null,
      detected_tier: null,
      detected_sanctioned: null,
      recommendation: null,
    }

    if (payload.bank_bic) {
      const lookup = await lookupBank(payload.bank_bic)
      if (lookup.ok) {
        bankSnapshot = {
          bank_bic: lookup.entry.bic,
          bank_name_snapshot: lookup.entry.bank_name,
          bank_country_snapshot: lookup.entry.country_name ?? lookup.entry.country_code,
          detected_tier: lookup.entry.tier,
          detected_sanctioned: lookup.entry.is_sanctioned,
          recommendation: lookup.recommendation,
        }
      } else {
        // Still persist BIC even if not in directory, so staff can come back to it
        bankSnapshot.bank_bic = lookup.normalizedBic ?? payload.bank_bic
      }
    }

    const allChecksPassed =
      payload.received_via_swift &&
      payload.bic_matches &&
      payload.amount_matches_po &&
      payload.description_matches_po &&
      payload.shipment_date_reasonable &&
      payload.no_soft_clauses

    const isSanctioned = bankSnapshot.detected_sanctioned === true

    let verification_status: LCVerification["verification_status"] = "pending"
    if (isSanctioned) {
      verification_status = "rejected"
    } else if (allChecksPassed && bankSnapshot.detected_tier && bankSnapshot.detected_tier <= 3) {
      verification_status = "verified"
    }

    // Check if existing row
    const { data: existing } = await supabase
      .from("lc_verifications")
      .select("id, created_by, created_at")
      .eq("opportunity_id", payload.opportunity_id)
      .maybeSingle()

    const upsertData = {
      opportunity_id: payload.opportunity_id,
      ...bankSnapshot,
      received_via_swift: payload.received_via_swift,
      bic_matches: payload.bic_matches,
      amount_matches_po: payload.amount_matches_po,
      description_matches_po: payload.description_matches_po,
      shipment_date_reasonable: payload.shipment_date_reasonable,
      no_soft_clauses: payload.no_soft_clauses,
      lc_document_url: payload.lc_document_url,
      verification_status,
      rejection_reason: isSanctioned
        ? "Ngân hàng phát hành nằm trong danh sách trừng phạt — KHÔNG giao dịch."
        : payload.rejection_reason,
      updated_by: user.id,
    }

    if (existing) {
      const { data, error } = await supabase
        .from("lc_verifications")
        .update(upsertData)
        .eq("id", existing.id)
        .select()
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath("/admin/opportunities")
      return { ok: true, data: data as LCVerification }
    }

    const { data, error } = await supabase
      .from("lc_verifications")
      .insert({ ...upsertData, created_by: user.id })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    revalidatePath("/admin/opportunities")
    return { ok: true, data: data as LCVerification }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
