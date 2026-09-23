"use server"

/**
 * Server actions for /admin/marketing-leads — the triage queue for submissions
 * that came in through public forms (app/api/consultation today, US-buyer
 * marketing forms later). See migration 082 for the table + RLS notes.
 *
 * These actions only move a lead along the queue. Creating a buyer (public.leads
 * + AI matching) or onboarding a supplier (client invite) stays in its own
 * gated flow on purpose — otherwise this page becomes a second, unpoliced
 * intake door into the pipeline that `runMatchingPipeline` guards.
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { isMarketingLeadStatus, type MarketingLeadStatus } from "@/lib/marketing/status"

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export async function updateMarketingLeadTriage(input: {
  id: string
  status: MarketingLeadStatus
  notes: string
}): Promise<ActionResult<null>> {
  const guard = await requireCap(CAPS.MARKETING_LEADS_TRIAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!input?.id || typeof input.id !== "string") {
    return { ok: false, error: "invalid_id" }
  }
  if (!isMarketingLeadStatus(input.status)) {
    return { ok: false, error: "invalid_status" }
  }
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 2000) : ""

  const now = new Date().toISOString()
  const patch: {
    status: MarketingLeadStatus
    notes: string
    triaged_at: string
    triaged_by: string
    last_contacted_at?: string
  } = {
    status: input.status,
    notes,
    triaged_at: now,
    triaged_by: userId,
  }
  // 'contacted' is the status response-time reporting reads, so stamp it from
  // the server instead of trusting whatever the client sends.
  if (input.status === "contacted") patch.last_contacted_at = now

  const { error } = await admin.from("marketing_leads").update(patch).eq("id", input.id)
  if (error) {
    console.error("[admin] updateMarketingLeadTriage failed:", error.code, error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath("/admin/marketing-leads")
  return { ok: true, data: null }
}

/**
 * Claim a lead. Assignment never changes status: the owner can sit on a 'new'
 * row and the queue count stays honest until they actually act on it.
 */
export async function assignMarketingLeadToMe(id: string): Promise<ActionResult<null>> {
  const guard = await requireCap(CAPS.MARKETING_LEADS_TRIAGE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin, userId } = guard

  if (!id || typeof id !== "string") return { ok: false, error: "invalid_id" }

  const { error } = await admin
    .from("marketing_leads")
    .update({ assigned_to: userId })
    .eq("id", id)

  if (error) {
    console.error("[admin] assignMarketingLeadToMe failed:", error.code, error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath("/admin/marketing-leads")
  return { ok: true, data: null }
}
