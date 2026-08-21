/**
 * Re-match "shared inbox" buyers.
 *
 * When `runMatchingPipeline` finds zero AEs covering a buyer's industry,
 * it routes the buyer to `routeToSharedInbox()` — a pending
 * `ae_match_inbox` row for *every* AE, first-to-claim-wins, with no
 * `ae_match_scores` rows at all (see orchestrator.ts). That routing only
 * ever runs once, at the moment the buyer is first matched. If no AE
 * covered the industry back then, the buyer just sits there — even after
 * an AE later gains a matching client — until someone manually re-runs
 * matching or notices it in the shared inbox.
 *
 * This module closes that gap by re-running `runMatchingPipeline` for
 * every buyer still sitting unclaimed in the shared inbox, so a
 * newly-eligible AE gets scored (and possibly auto-assigned, or dropped
 * into their personal inbox) automatically.
 *
 * Called from:
 *   1. `app/admin/clients/new/actions.ts` — right after a new client is
 *      onboarded with an industry, scoped to just that industry, so the
 *      AE who created the client sees the buyer immediately.
 *   2. `app/api/cron/rematch-unassigned/route.ts` — a daily sweep across
 *      every industry, as a safety net for any other path that changes
 *      AE coverage.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeIndustry } from "@/lib/constants/industries"
import { runMatchingPipeline } from "./orchestrator"

export interface RematchOptions {
  /**
   * Restrict the sweep to buyers in these industries only. Omit to scan
   * every open shared-inbox buyer (used by the daily cron sweep).
   */
  industries?: string[]
  /**
   * Free-text audit label (e.g. "cron:rematch-unassigned" or a real AE
   * user id). Never written to a UUID FK column — see
   * `toUuidOrNull` in orchestrator.ts.
   */
  triggeredBy: string
  /** Safety cap on how many leads get re-run in a single call. */
  limit?: number
}

export interface RematchSummary {
  /** Buyers found sitting open in the shared inbox and re-scored. */
  scanned: number
  /** Of those, how many got auto-assigned to an AE. */
  autoAssigned: number
  /** Of those, how many moved into a normal per-AE inbox (needs an AE to pick a client). */
  movedToPerAeInbox: number
  /** Of those, how many are still unmatched (still no AE covers the industry). */
  stillUnmatched: number
  errors: { leadId: string; error: string }[]
}

const DEFAULT_LIMIT = 200

export async function rematchOpenSharedInboxLeads(
  options: RematchOptions
): Promise<RematchSummary> {
  const admin = createAdminClient()
  const limit = options.limit ?? DEFAULT_LIMIT

  const leadIds = await findOpenSharedInboxLeadIds(admin, options.industries, limit)

  const summary: RematchSummary = {
    scanned: leadIds.length,
    autoAssigned: 0,
    movedToPerAeInbox: 0,
    stillUnmatched: 0,
    errors: [],
  }

  for (const leadId of leadIds) {
    try {
      const result = await runMatchingPipeline(
        { leadId, triggeredBy: options.triggeredBy, useLLMAugmentation: false },
        // Service-role client — this runs with no logged-in session
        // (cron, or right after a server action already finished its own
        // auth check), so it must bypass RLS the same way other crons do.
        { client: admin }
      )

      if (result.autoAssigned) {
        summary.autoAssigned++
      } else if (result.inboxItems.length > 0) {
        summary.movedToPerAeInbox++
      } else {
        summary.stillUnmatched++
      }
    } catch (err) {
      summary.errors.push({
        leadId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary
}

/**
 * A buyer is "open in the shared inbox" when:
 *   - it has at least one pending `ae_match_inbox` row, AND
 *   - it has ZERO `ae_match_scores` rows — the shared-inbox path never
 *     scores anyone (that's the whole point: no eligible AE existed at
 *     the time), which is exactly what distinguishes it from a normal
 *     per-AE inbox item (those always have scores behind them), AND
 *   - nobody has claimed it yet: no `buyer_engagements` row and no
 *     `opportunities` row exists for it.
 */
async function findOpenSharedInboxLeadIds(
  admin: ReturnType<typeof createAdminClient>,
  industries: string[] | undefined,
  limit: number
): Promise<string[]> {
  const { data: inboxRows } = await admin
    .from("ae_match_inbox")
    .select("lead_id")
    .eq("status", "pending")

  const inboxLeadIds = Array.from(
    new Set((inboxRows ?? []).map((r: { lead_id: string }) => r.lead_id))
  )
  if (inboxLeadIds.length === 0) return []

  const { data: scoredRows } = await admin
    .from("ae_match_scores")
    .select("lead_id")
    .in("lead_id", inboxLeadIds)
  const scoredLeadIds = new Set(
    (scoredRows ?? []).map((r: { lead_id: string }) => r.lead_id)
  )

  const sharedInboxLeadIds = inboxLeadIds.filter((id) => !scoredLeadIds.has(id))
  if (sharedInboxLeadIds.length === 0) return []

  const [{ data: engagedRows }, { data: oppRows }] = await Promise.all([
    (admin.from("buyer_engagements") as any)
      .select("lead_id")
      .in("lead_id", sharedInboxLeadIds),
    admin.from("opportunities").select("lead_id").in("lead_id", sharedInboxLeadIds),
  ])
  const claimedLeadIds = new Set<string>([
    ...((engagedRows ?? []) as { lead_id: string }[]).map((r) => r.lead_id),
    ...((oppRows ?? []) as { lead_id: string }[]).map((r) => r.lead_id),
  ])

  let openLeadIds = sharedInboxLeadIds.filter((id) => !claimedLeadIds.has(id))
  if (openLeadIds.length === 0) return []

  if (industries && industries.length > 0) {
    const normalizedTargets = new Set(
      industries.map((i) => normalizeIndustry(i)).filter((v): v is string => !!v)
    )
    if (normalizedTargets.size === 0) return []

    const { data: leadRows } = await admin
      .from("leads")
      .select("id, industry")
      .in("id", openLeadIds)

    openLeadIds = (leadRows ?? [])
      .filter((l) => {
        const norm = normalizeIndustry(l.industry)
        return norm ? normalizedTargets.has(norm) : false
      })
      .map((l) => l.id)
  }

  return openLeadIds.slice(0, limit)
}
