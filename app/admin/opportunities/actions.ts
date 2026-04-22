"use server"

import { revalidatePath } from "next/cache"
import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import type { Stage } from "@/lib/supabase/types"
import { stageRequiresSwift } from "@/lib/risk/country-risk"
import { assessCountryRiskDb } from "@/lib/risk/country-risk-db"

export interface UpdateOpportunityInput {
  id: string
  products_interested?: string | null
  quantity_required?: string | null
  target_price_usd?: number | null
  price_unit?: string | null
  incoterms?: string | null
  payment_terms?: string | null
  destination_port?: string | null
  target_close_date?: string | null // YYYY-MM-DD
  potential_value?: number | null
  next_step?: string | null
  client_action_required?: string | null
  client_action_due_date?: string | null // YYYY-MM-DD
  notes?: string | null
}

export interface UpdateOpportunityResult {
  ok: boolean
  error?: string
}

const MAX_TEXT = 5000
const MAX_SHORT = 200

/**
 * Update the commercial details of an opportunity.
 *
 * Security:
 *   - Caller must be authenticated AND have role admin/staff.
 *   - Uses service-role client for the write AFTER role verification.
 *
 * Only non-undefined fields are written so the UI can send partial updates.
 * Empty strings are normalised to NULL so "clearing" a field works.
 */
export async function updateOpportunityDetails(
  input: UpdateOpportunityInput,
): Promise<UpdateOpportunityResult> {
  if (!input?.id) return { ok: false, error: "invalidId" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || !["admin", "staff"].includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  // Build update payload with normalised values
  const payload: Record<string, unknown> = {}
  const setString = (key: keyof UpdateOpportunityInput, max = MAX_SHORT) => {
    const raw = input[key]
    if (raw === undefined) return
    if (raw === null) {
      payload[key] = null
      return
    }
    const str = String(raw).trim()
    if (str.length === 0) {
      payload[key] = null
      return
    }
    if (str.length > max) {
      payload[key] = str.slice(0, max)
      return
    }
    payload[key] = str
  }
  const setNumber = (key: keyof UpdateOpportunityInput) => {
    const raw = input[key]
    if (raw === undefined) return
    if (raw === null || raw === "") {
      payload[key] = null
      return
    }
    const n = typeof raw === "number" ? raw : Number(raw)
    if (Number.isFinite(n) && n >= 0) payload[key] = n
  }
  const setDate = (key: keyof UpdateOpportunityInput) => {
    const raw = input[key]
    if (raw === undefined) return
    if (raw === null || raw === "") {
      payload[key] = null
      return
    }
    // Accept YYYY-MM-DD strings; validate
    const s = String(raw)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) payload[key] = s
  }

  setString("products_interested", MAX_SHORT)
  setString("quantity_required", MAX_SHORT)
  setString("price_unit", 50)
  setString("incoterms", 20)
  setString("payment_terms", MAX_SHORT)
  setString("destination_port", MAX_SHORT)
  setString("next_step", MAX_TEXT)
  setString("client_action_required", MAX_TEXT)
  setString("notes", MAX_TEXT)
  setNumber("target_price_usd")
  setNumber("potential_value")
  setDate("target_close_date")
  setDate("client_action_due_date")

  if (Object.keys(payload).length === 0) {
    return { ok: true }
  }

  payload.last_updated = new Date().toISOString()

  const admin = createAdminClient()

  // Snapshot the BEFORE state so we can detect meaningful changes for the
  // notification dispatcher (e.g. next_step diff, new client_action_required).
  const { data: before } = await admin
    .from("opportunities")
    .select(
      "id, client_id, next_step, client_action_required, leads:lead_id ( company_name ), buyer_code",
    )
    .eq("id", input.id)
    .single()

  const { error } = await admin
    .from("opportunities")
    .update(payload)
    .eq("id", input.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  // Fire-and-forget notification to the client. Only triggers on user-visible
  // changes (next_step, client_action_required). Swallow failures — they must
  // never block the save.
  if (before?.client_id) {
    try {
      await maybeNotifyOpportunityUpdated({
        opportunityId: input.id,
        clientId: before.client_id,
        buyerCode: before.buyer_code ?? null,
        leadName:
          (before.leads as { company_name?: string | null } | null)?.company_name ?? null,
        beforeNextStep: before.next_step ?? null,
        beforeActionRequired: before.client_action_required ?? null,
        afterNextStep: normalizeStringField(payload.next_step),
        afterActionRequired: normalizeStringField(payload.client_action_required),
      })
    } catch (err) {
      console.error("[v0] notify opp-updated failed", err)
    }
  }

  revalidatePath("/admin")
  revalidatePath("/client")
  revalidatePath("/client/leads")
  return { ok: true }
}

/**
 * Helper: payload values can be `undefined` (untouched), `null` (cleared),
 * or a string. Normalise into string | null so the diff checks below are clean.
 */
function normalizeStringField(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v === "string") {
    const trimmed = v.trim()
    return trimmed.length === 0 ? null : trimmed
  }
  return null
}

interface NotifyOppUpdatedInput {
  opportunityId: string
  clientId: string
  buyerCode: string | null
  leadName: string | null
  beforeNextStep: string | null
  beforeActionRequired: string | null
  afterNextStep: string | null | undefined
  afterActionRequired: string | null | undefined
}

async function maybeNotifyOpportunityUpdated(input: NotifyOppUpdatedInput) {
  const {
    opportunityId,
    clientId,
    buyerCode,
    leadName,
    beforeNextStep,
    beforeActionRequired,
    afterNextStep,
    afterActionRequired,
  } = input

  const label = leadName ?? buyerCode ?? "lead"
  const linkPath = `/client/leads#${opportunityId}`

  // Case 1: a new action-required message appeared (or changed).
  // This is the most important notification for exporters — they are being
  // blocked by something and need to act.
  if (afterActionRequired !== undefined) {
    const before = (beforeActionRequired ?? "").trim()
    const after = (afterActionRequired ?? "").trim()
    if (after.length > 0 && after !== before) {
      await dispatchNotification({
        userId: clientId,
        category: "action_required",
        opportunityId,
        linkPath,
        dedupKey: `opp_action_required:${opportunityId}:${hashShort(after)}`,
        title: {
          vi: `Cần bạn xử lý: ${label}`,
          en: `Action needed on ${label}`,
        },
        body: {
          vi: `Đội ngũ cần bạn làm việc sau trước khi tiếp tục:\n\n${after}`,
          en: `Our team needs the following from you before we can move forward:\n\n${after}`,
        },
        ctaLabel: {
          vi: "Xem chi tiết",
          en: "Review details",
        },
      })
      return
    }
  }

  // Case 2: next_step changed materially → status update.
  if (afterNextStep !== undefined) {
    const before = (beforeNextStep ?? "").trim()
    const after = (afterNextStep ?? "").trim()
    if (after.length > 0 && after !== before) {
      await dispatchNotification({
        userId: clientId,
        category: "status_update",
        opportunityId,
        linkPath,
        dedupKey: `opp_next_step:${opportunityId}:${hashShort(after)}`,
        title: {
          vi: `Cập nhật tiến độ: ${label}`,
          en: `Status update on ${label}`,
        },
        body: {
          vi: `Bước tiếp theo đội ngũ đang triển khai:\n\n${after}`,
          en: `Here is what our team is working on next:\n\n${after}`,
        },
        ctaLabel: {
          vi: "Xem chi tiết",
          en: "View details",
        },
      })
    }
  }
}

/**
 * 32-bit fnv1a-ish hash to keep dedup keys short and stable. We only need
 * "same text ⇒ same key", not cryptographic strength.
 */
function hashShort(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16)
}

// ---------------------------------------------------------------------------
// updateOpportunityStage — called from the kanban board when a card is dragged
// into a new column. Replaces the old direct-from-client supabase.update so
// that we can enforce the same role check and dispatch a notification.
// ---------------------------------------------------------------------------

export interface UpdateStageResult {
  ok: boolean
  error?: string
}

const ALLOWED_STAGES: Stage[] = [
  "new",
  "contacted",
  "sample_requested",
  "sample_sent",
  "negotiation",
  "price_agreed",
  "production",
  "shipped",
  "won",
  "lost",
]

export async function updateOpportunityStage(
  opportunityId: string,
  newStage: Stage,
): Promise<UpdateStageResult> {
  if (!opportunityId || !ALLOWED_STAGES.includes(newStage)) {
    return { ok: false, error: "invalidInput" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "notAuthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || !["admin", "staff"].includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()

  // Fetch BEFORE state for notification context + activity log.
  // Also pull the buyer country so we can enforce the Swift verification
  // gate when moving into shipping/production for high-risk deals.
  const { data: before } = await admin
    .from("opportunities")
    .select(
      "id, client_id, stage, buyer_code, leads:lead_id ( company_name, country )",
    )
    .eq("id", opportunityId)
    .single()

  if (!before) return { ok: false, error: "notFound" }
  if (before.stage === newStage) return { ok: true }

  // ------------------------------------------------------------------
  // SWIFT VERIFICATION GATE (SOP Phase 3.3/3.4)
  // For medium/high-risk countries, the wire transfer must be admin-
  // verified before the deal may advance to production / shipped / won.
  // ------------------------------------------------------------------
  if (stageRequiresSwift(newStage)) {
    const leadData =
      (before.leads as { country?: string | null } | null) ?? null
    // R-04 — authoritative risk classification now lives in country_risk
    // table (admin-editable). DB call with a safe static fallback.
    const risk = await assessCountryRiskDb(leadData?.country ?? null)

    if (risk.requiresVerifiedSwift) {
      const { data: deal } = await admin
        .from("deals")
        .select("swift_verified")
        .eq("opportunity_id", opportunityId)
        .maybeSingle()

      if (!deal?.swift_verified) {
        return { ok: false, error: "swiftNotVerified" }
      }
    }
  }

  const { error: updateErr } = await admin
    .from("opportunities")
    .update({ stage: newStage, last_updated: new Date().toISOString() })
    .eq("id", opportunityId)

  if (updateErr) {
    return { ok: false, error: updateErr.message }
  }

  // Activity audit
  await admin.from("activities").insert({
    opportunity_id: opportunityId,
    action_type: "stage_changed",
    description: `${before.stage} → ${newStage}`,
    performed_by: user.id,
  })

  // Notify client
  try {
    const leadName =
      (before.leads as { company_name?: string | null } | null)?.company_name ?? null
    const label = leadName ?? before.buyer_code ?? "lead"
    const isClosed = newStage === "won" || newStage === "lost"

    await dispatchNotification({
      userId: before.client_id,
      category: isClosed ? "deal_closed" : "status_update",
      opportunityId,
      linkPath: `/client/leads#${opportunityId}`,
      dedupKey: `opp_stage:${opportunityId}:${before.stage}->${newStage}`,
      title: isClosed
        ? {
            vi: newStage === "won" ? `Thương vụ thành công: ${label}` : `Thương vụ kết thúc: ${label}`,
            en: newStage === "won" ? `Deal won: ${label}` : `Deal closed: ${label}`,
          }
        : {
            vi: `Giai đoạn mới: ${label}`,
            en: `Stage updated: ${label}`,
          },
      body: {
        vi: `Cơ hội vừa chuyển sang giai đoạn "${stageLabelVi(newStage)}".`,
        en: `This opportunity just moved to the "${stageLabelEn(newStage)}" stage.`,
      },
      ctaLabel: {
        vi: "Xem chi tiết",
        en: "View details",
      },
    })
  } catch (err) {
    console.error("[v0] notify stage-change failed", err)
  }

  revalidatePath("/admin")
  revalidatePath("/admin/pipeline")
  revalidatePath("/client")
  revalidatePath("/client/leads")
  return { ok: true }
}

// Labels kept inline so the server action is self-contained (no coupling to
// the client-only i18n dictionary). Keep in sync with the kanban board.
function stageLabelVi(stage: Stage): string {
  const map: Record<Stage, string> = {
    new: "Mới",
    contacted: "Đã liên hệ",
    sample_requested: "Yêu cầu mẫu",
    sample_sent: "Đã gửi mẫu",
    negotiation: "Đàm phán",
    price_agreed: "Đã chốt giá",
    production: "Đang sản xuất",
    shipped: "Đã giao hàng",
    won: "Thành công",
    lost: "Thất bại",
  }
  return map[stage]
}
function stageLabelEn(stage: Stage): string {
  const map: Record<Stage, string> = {
    new: "New",
    contacted: "Contacted",
    sample_requested: "Sample Requested",
    sample_sent: "Sample Sent",
    negotiation: "Negotiation",
    price_agreed: "Price Agreed",
    production: "In Production",
    shipped: "Shipped",
    won: "Won",
    lost: "Lost",
  }
  return map[stage]
}

// ---------------------------------------------------------------------------
// notifyLeadAssigned — tiny helper called from the client-side add-lead form
// after a lead+opportunity pair has been created. Kept server-only so we can
// hit the service-role dispatcher without exposing the admin client.
// ---------------------------------------------------------------------------

export interface NotifyLeadAssignedResult {
  ok: boolean
}

export async function notifyLeadAssigned(
  opportunityId: string,
): Promise<NotifyLeadAssignedResult> {
  if (!opportunityId) return { ok: false }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  // Role gate — same as the create flow.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!callerProfile || !["admin", "staff"].includes(callerProfile.role)) {
    return { ok: false }
  }

  const admin = createAdminClient()
  const { data: opp } = await admin
    .from("opportunities")
    .select("id, client_id, buyer_code, leads:lead_id ( company_name, industry )")
    .eq("id", opportunityId)
    .single()

  if (!opp?.client_id) return { ok: false }

  const lead = opp.leads as { company_name?: string | null; industry?: string | null } | null
  const label = lead?.company_name ?? opp.buyer_code ?? "new buyer"

  try {
    await dispatchNotification({
      userId: opp.client_id,
      category: "new_assignment",
      opportunityId,
      linkPath: `/client/leads#${opportunityId}`,
      dedupKey: `opp_assigned:${opportunityId}`,
      title: {
        vi: `Bạn vừa được giao lead mới: ${label}`,
        en: `New buyer assigned: ${label}`,
      },
      body: {
        vi: `Đội ngũ vừa giao cho bạn một cơ hội mới${
          lead?.industry ? ` trong ngành ${lead.industry}` : ""
        }. Hãy mở dashboard để xem chi tiết và chuẩn bị bước tiếp theo.`,
        en: `Our team just assigned a new opportunity to you${
          lead?.industry ? ` in the ${lead.industry} industry` : ""
        }. Open your dashboard to review the details.`,
      },
      ctaLabel: {
        vi: "Xem lead mới",
        en: "View lead",
      },
    })
  } catch (err) {
    console.error("[v0] notify new-assignment failed", err)
    return { ok: false }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// AI suggestion for "client_action_required"
// ---------------------------------------------------------------------------

export interface SuggestClientActionInput {
  opportunityId: string
  /**
   * Unsaved form values from the sheet. We trust these over DB values because
   * admin may have typed a new `next_step` but not saved yet.
   */
  nextStep: string
  incoterms?: string | null
  productsInterested?: string | null
  paymentTerms?: string | null
  destinationPort?: string | null
}

export type SuggestClientActionResult =
  | { ok: true; suggestion: string }
  | { ok: false; error: "forbidden" | "missingContext" | "notFound" | "generic" }

const SUGGESTION_SCHEMA = z.object({
  // Short actionable Vietnamese text shown to the client as a red banner.
  suggestion: z
    .string()
    .describe(
      "1–3 bullet points (max 200 chars total) in Vietnamese describing concrete things the Vietnamese exporter should prepare this week. Be specific and actionable. Do not greet. Do not use emojis.",
    ),
})

/**
 * Ask an LLM to suggest what the Vietnamese exporter (client) should prepare
 * next, based on the admin-written `next_step` and the deal context.
 *
 * The generated text is returned to the admin for review — it is NOT saved
 * automatically. The admin can edit or discard before saving the form.
 */
export async function suggestClientAction(
  input: SuggestClientActionInput,
): Promise<SuggestClientActionResult> {
  if (!input?.opportunityId) return { ok: false, error: "generic" }

  const nextStep = (input.nextStep ?? "").trim()
  if (!nextStep) return { ok: false, error: "missingContext" }

  // Auth + role check (same guard as updateOpportunityDetails)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "forbidden" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || !["admin", "staff"].includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  // Fetch the opportunity + related lead/client profile for richer context.
  // We intentionally read a minimal, non-sensitive projection.
  const { data: opp } = await supabase
    .from("opportunities")
    .select(
      `
        id,
        stage,
        potential_value,
        target_close_date,
        leads:lead_id ( industry, notes ),
        profiles:client_id ( company_name, industry, fda_registration_number )
      `,
    )
    .eq("id", input.opportunityId)
    .single()

  if (!opp) return { ok: false, error: "notFound" }

  const lead = opp.leads as { industry: string | null; notes: string | null } | null
  const client = opp.profiles as {
    company_name: string | null
    industry: string | null
    fda_registration_number: string | null
  } | null

  const context = {
    stage: opp.stage,
    potential_value_usd: opp.potential_value,
    target_close_date: opp.target_close_date,
    buyer_industry: lead?.industry ?? null,
    exporter_company: client?.company_name ?? null,
    exporter_industry: client?.industry ?? null,
    exporter_has_fda: Boolean(client?.fda_registration_number),
    products: input.productsInterested ?? null,
    incoterms: input.incoterms ?? null,
    payment_terms: input.paymentTerms ?? null,
    destination_port: input.destinationPort ?? null,
    admin_next_step: nextStep,
  }

  const system = [
    "You are a senior export-sales advisor helping a Vietnamese exporter prepare for the next step in a US buyer deal.",
    "Write in Vietnamese. Be concrete, actionable, and concise.",
    "Output must be 1 to 3 bullet points separated by line breaks, each starting with '- '. Max ~200 characters total.",
    "Base suggestions on the deal stage, commercial terms, and what the admin has just said they are doing next.",
    "If the exporter is missing an FDA registration and the stage requires it (e.g. negotiation or later), remind them to complete FDA registration first.",
    "Never invent facts. If essential context is missing, suggest the exporter confirm it with the admin.",
    "Do not greet. Do not use emojis.",
  ].join("\n\n")

  const userPrompt = [
    "Deal context (JSON):",
    JSON.stringify(context, null, 2),
    "",
    "Task: Suggest what the Vietnamese exporter should prepare next, in Vietnamese.",
  ].join("\n")

  try {
    const { experimental_output } = await generateText({
      model: "openai/gpt-4o-mini",
      system,
      prompt: userPrompt,
      experimental_output: Output.object({ schema: SUGGESTION_SCHEMA }),
    })

    const suggestion = experimental_output.suggestion?.trim()
    if (!suggestion) return { ok: false, error: "generic" }

    return { ok: true, suggestion }
  } catch (err) {
    console.error("[v0] suggestClientAction error:", err)
    return { ok: false, error: "generic" }
  }
}
