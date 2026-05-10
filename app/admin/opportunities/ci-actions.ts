"use server"

/**
 * Server actions for Commercial Intelligence (per-opportunity research).
 *
 * Allowed roles: admin / super_admin / account_executive / lead_researcher
 * (anyone with DEAL_VIEW for read; DEAL_QUANTITY_WRITE for write).
 *
 * Sprint client-management-for-AE — scoped roles (AE / lead_researcher /
 * staff) may only touch CI rows attached to opportunities owned by clients
 * they personally manage.
 */

import { requireCap, requireAnyCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { assertOpportunityOwnership } from "@/lib/auth/ownership"
import type { CommercialIntelligence } from "@/lib/supabase/types"

export async function getCIByOpportunityId(
  opportunityId: string
): Promise<{ ok: true; ci: CommercialIntelligence | null } | { ok: false; error: string }> {
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
      .from("commercial_intelligence")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (error) throw error

    return { ok: true, ci: data }
  } catch (err) {
    console.error("[CI] Error fetching CI:", err)
    return { ok: false, error: "fetch_failed" }
  }
}

export async function createOrUpdateCI({
  opportunityId,
  main_hs_code,
  import_history_summary,
  main_competitors,
}: {
  opportunityId: string
  main_hs_code: string | null
  import_history_summary: string | null
  main_competitors: string | null
}): Promise<
  { ok: true; ci: CommercialIntelligence }
  | { ok: false; error: string }
> {
  // Both AE and lead_researcher should be able to maintain CI for their
  // own clients — gate on a write capability they share via DEAL/BUYER.
  const guard = await requireAnyCap([
    CAPS.DEAL_QUANTITY_WRITE,
    CAPS.BUYER_WRITE,
  ])
  if (!guard.ok) return { ok: false, error: "unauthorized" }

  const ownership = await assertOpportunityOwnership(
    guard.admin,
    guard.role,
    guard.userId,
    opportunityId,
  )
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    // Try to get existing CI record
    const { data: existing } = await guard.admin
      .from("commercial_intelligence")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (existing) {
      // UPDATE
      const { data, error } = await guard.admin
        .from("commercial_intelligence")
        .update({
          main_hs_code,
          import_history_summary,
          main_competitors,
          updated_by: guard.userId,
        })
        .eq("opportunity_id", opportunityId)
        .select()
        .single()

      if (error) throw error
      return { ok: true, ci: data }
    } else {
      // INSERT
      const { data, error } = await guard.admin
        .from("commercial_intelligence")
        .insert({
          opportunity_id: opportunityId,
          main_hs_code,
          import_history_summary,
          main_competitors,
          created_by: guard.userId,
        })
        .select()
        .single()

      if (error) throw error
      return { ok: true, ci: data }
    }
  } catch (err) {
    console.error("[CI] Error saving CI:", err)
    return { ok: false, error: "save_failed" }
  }
}
