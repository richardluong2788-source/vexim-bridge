"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normaliseRole } from "@/lib/auth/permissions"
import { ownershipScopeFor, assertOpportunityOwned } from "@/lib/auth/scope"
import { extractBuyerIntel, type BuyerIntelExtraction } from "@/lib/ai/buyer-intel-extractor"

const MAX_NOTE = 5000
const ALLOWED_ROLES = ["admin", "super_admin", "staff", "account_executive", "lead_researcher"]

export interface BuyerIntelNote {
  id: string
  opportunity_id: string
  category: "pricing" | "payment" | "documents" | "testing" | "general"
  raw_note: string
  ai_summary: string | null
  ai_extracted: BuyerIntelExtraction | null
  applied_to_opportunity: boolean
  created_by: string | null
  created_at: string
}

interface AuthResult {
  ok: boolean
  error?: string
  userId?: string
  role?: string
}

async function authorizeForOpportunity(opportunityId: string): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!callerProfile || !ALLOWED_ROLES.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const role = normaliseRole(callerProfile.role)
  if (role) {
    const scope = ownershipScopeFor(role, user.id)
    const own = await assertOpportunityOwned(scope, createAdminClient(), opportunityId)
    if (!own.ok) return { ok: false, error: own.error }
  }

  return { ok: true, userId: user.id, role: callerProfile.role }
}

/**
 * AE gõ ghi chú tự do sau khi liên lạc với buyer. AI phân loại + trích xuất
 * ngay tại thời điểm lưu, nhưng KHÔNG tự động ghi vào opportunities — AE phải
 * tự bấm "Áp dụng" (applyBuyerIntelToOpportunity) để chuyển field đề xuất vào
 * hồ sơ deal.
 */
export async function createBuyerIntelNote(
  opportunityId: string,
  rawNote: string,
): Promise<{ ok: boolean; error?: string; note?: BuyerIntelNote }> {
  if (!opportunityId) return { ok: false, error: "invalidId" }
  const trimmed = rawNote?.trim()
  if (!trimmed) return { ok: false, error: "emptyNote" }

  const auth = await authorizeForOpportunity(opportunityId)
  if (!auth.ok) return { ok: false, error: auth.error }

  const clipped = trimmed.slice(0, MAX_NOTE)

  let extraction: BuyerIntelExtraction | null = null
  try {
    extraction = await extractBuyerIntel(clipped)
  } catch (err) {
    console.error("[v0] buyer intel extraction failed", err)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("buyer_intel_notes")
    .insert({
      opportunity_id: opportunityId,
      category: extraction?.category ?? "general",
      raw_note: clipped,
      ai_summary: extraction?.summary ?? null,
      ai_extracted: extraction ?? null,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin")
  return { ok: true, note: data as BuyerIntelNote }
}

export async function listBuyerIntelNotes(
  opportunityId: string,
): Promise<{ ok: boolean; error?: string; notes?: BuyerIntelNote[] }> {
  if (!opportunityId) return { ok: false, error: "invalidId" }

  const auth = await authorizeForOpportunity(opportunityId)
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("buyer_intel_notes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: error.message }

  return { ok: true, notes: (data ?? []) as BuyerIntelNote[] }
}

/**
 * AE xác nhận áp dụng các field gợi ý từ một note vào opportunity. Chỉ ghi
 * đè những field mà AE chọn (fields), giữ nguyên các field khác.
 */
export async function applyBuyerIntelToOpportunity(
  noteId: string,
  opportunityId: string,
  fields: {
    target_price_usd?: number | null
    price_unit?: string | null
    incoterms?: string | null
    payment_terms?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!noteId || !opportunityId) return { ok: false, error: "invalidId" }

  const auth = await authorizeForOpportunity(opportunityId)
  if (!auth.ok) return { ok: false, error: auth.error }

  const payload: Record<string, unknown> = {}
  if (fields.target_price_usd !== undefined) payload.target_price_usd = fields.target_price_usd
  if (fields.price_unit !== undefined) payload.price_unit = fields.price_unit
  if (fields.incoterms !== undefined) payload.incoterms = fields.incoterms
  if (fields.payment_terms !== undefined) payload.payment_terms = fields.payment_terms

  if (Object.keys(payload).length === 0) return { ok: false, error: "nothingToApply" }

  payload.last_updated = new Date().toISOString()

  const admin = createAdminClient()

  const { error: updateError } = await admin.from("opportunities").update(payload).eq("id", opportunityId)
  if (updateError) return { ok: false, error: updateError.message }

  const { error: markError } = await admin
    .from("buyer_intel_notes")
    .update({ applied_to_opportunity: true })
    .eq("id", noteId)
  if (markError) return { ok: false, error: markError.message }

  revalidatePath("/admin")
  return { ok: true }
}

export async function deleteBuyerIntelNote(
  noteId: string,
  opportunityId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!noteId || !opportunityId) return { ok: false, error: "invalidId" }

  const auth = await authorizeForOpportunity(opportunityId)
  if (!auth.ok) return { ok: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin.from("buyer_intel_notes").delete().eq("id", noteId).eq("opportunity_id", opportunityId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin")
  return { ok: true }
}
