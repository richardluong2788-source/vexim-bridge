import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Pre-kanban funnel metrics for a CLIENT (the exporter/supplier side).
 *
 * The client-visible kanban (`opportunities`) only appears once an AE
 * converts a buyer engagement — i.e. after the buyer has been sourced,
 * qualified, offered a shortlist of 3–5 suppliers, and explicitly reacted.
 * Everything before that moment lives in:
 *
 *   buyer_engagements                (AE ↔ buyer work, stages 0..converted)
 *   buyer_engagement_shortlist_versions  (immutable snapshots, status='sent')
 *   buyer_engagement_shortlist_items (per-supplier row: was this client on
 *                                    the shortlist + the buyer's reaction)
 *   shortlist_share_links            (buyer open/view signal)
 *
 * PRIVACY — the pre-kanban equivalent of the R-07 masking rule:
 * these metrics are ALWAYS anonymous. No buyer name, email, country or
 * other identity leaves this module — only counts per client. Buyer
 * identity is disclosed only after conversion into an `opportunity`,
 * which is what the existing weekly report already masks until
 * price_agreed+.
 */

type AdminSB = ReturnType<typeof createAdminClient>

/** Buyer reactions that count as soft interest. */
const SOFT_ACTIONS = ["requested_info", "interested_no_details"] as const
/** Buyer reactions that need the supplier to DO something (prep samples, take a meeting, quote). */
const STRONG_ACTIONS = [
  "requested_sample",
  "requested_meeting",
  "requested_order_discussion",
] as const
const INTEREST_ACTIONS = [...SOFT_ACTIONS, ...STRONG_ACTIONS] as const

const CLOSED_ENGAGEMENT_STAGES = new Set(["converted", "dropped"])

export interface PreFunnelMetrics {
  /** Distinct buyers whose SENT shortlist included this client in the window. */
  introducedInWindow: number
  /** Distinct buyers that opened the shortlist (incl. this client) in the window. */
  viewedInWindow: number
  /** Distinct buyers that asked for info / showed generic interest in the window. */
  infoInWindow: number
  /** Distinct buyers that requested a sample, a meeting or order discussion. */
  strongInWindow: number
  /** Stock: on the live shortlist, buyer has not reacted yet, no opportunity exists. */
  pendingResponse: number
  /** Stock: on the live shortlist, buyer showed interest, negotiation not started. */
  activeInterest: number
}

export const EMPTY_PRE_FUNNEL: PreFunnelMetrics = {
  introducedInWindow: 0,
  viewedInWindow: 0,
  infoInWindow: 0,
  strongInWindow: 0,
  pendingResponse: 0,
  activeInterest: 0,
}

interface VersionRow {
  id: string
  engagement_id: string
  status: string
  sent_at: string | null
}
interface ItemRow {
  id: string
  version_id: string
  buyer_action: string | null
  buyer_responded_at: string | null
}
interface LinkRow {
  engagement_id: string
  version_id: string | null
  last_viewed_at: string | null
}
interface EngagementRow {
  id: string
  lead_id: string
  stage: string
}

function inWindow(
  iso: string | null | undefined,
  start: Date | null,
  end: Date | null,
): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  if (start && t < start.getTime()) return false
  if (end && t > end.getTime()) return false
  return true
}

/**
 * Build pre-funnel metrics for one client.
 *
 * @param windowStart inclusive, or null = no lower time bound
 * @param windowEnd   inclusive, or null = no upper time bound
 *
 * The two *_stock counters are always point-in-time regardless of the
 * window; the four *_inWindow counters are event counts over it.
 */
export async function buildPreFunnelMetrics(
  admin: AdminSB,
  clientId: string,
  windowStart: Date | null,
  windowEnd: Date | null,
): Promise<PreFunnelMetrics> {
  // These tables aren't part of the generated Supabase types — same
  // `as never` loose-table pattern used across the SLA/engagement code.
  const [versionsRes, itemsRes, linksRes, engagementsRes, oppRes] =
    await Promise.all([
      admin
        .from("buyer_engagement_shortlist_versions" as never)
        .select("id, engagement_id, status, sent_at")
        .eq("status", "sent") as unknown as Promise<{
        data: VersionRow[] | null
      }>,
      admin
        .from("buyer_engagement_shortlist_items" as never)
        .select("id, version_id, buyer_action, buyer_responded_at")
        .eq("client_id", clientId) as unknown as Promise<{
        data: ItemRow[] | null
      }>,
      admin
        .from("shortlist_share_links" as never)
        .select("engagement_id, version_id, last_viewed_at")
        .not("last_viewed_at", "is", null) as unknown as Promise<{
        data: LinkRow[] | null
      }>,
      admin
        .from("buyer_engagements" as never)
        .select("id, lead_id, stage") as unknown as Promise<{
        data: EngagementRow[] | null
      }>,
      admin
        .from("opportunities")
        .select("lead_id")
        .eq("client_id", clientId),
    ])

  const versions = (versionsRes?.data ?? []) as VersionRow[]
  const items = (itemsRes?.data ?? []) as ItemRow[]
  const links = (linksRes?.data ?? []) as LinkRow[]
  const engagements = (engagementsRes?.data ?? []) as EngagementRow[]

  if (items.length === 0) return { ...EMPTY_PRE_FUNNEL }

  const versionById = new Map(versions.map((v) => [v.id, v]))
  const engagementById = new Map(engagements.map((e) => [e.id, e]))
  // Leads this client already has a kanban row for (any stage) — those are
  // no longer "pre-funnel".
  const kanbanLeadIds = new Set<string>(
    ((oppRes?.data ?? []) as Array<{ lead_id: string | null }>)
      .map((o) => o.lead_id)
      .filter((x): x is string => !!x),
  )

  // Sent versions that include THIS client, grouped per buyer engagement.
  const versionsByEngagement = new Map<
    string,
    { version: VersionRow; item: ItemRow }[]
  >()
  for (const item of items) {
    const version = versionById.get(item.version_id)
    if (!version?.sent_at) continue
    const list = versionsByEngagement.get(version.engagement_id) ?? []
    list.push({ version, item })
    versionsByEngagement.set(version.engagement_id, list)
  }

  // Latest SENT version per engagement across ALL suppliers — the "live"
  // shortlist the buyer currently sees.
  const latestSentByEngagement = new Map<string, VersionRow>()
  for (const v of versions) {
    if (!v.sent_at) continue
    const cur = latestSentByEngagement.get(v.engagement_id)
    if (!cur || Date.parse(v.sent_at) > Date.parse(cur.sent_at!)) {
      latestSentByEngagement.set(v.engagement_id, v)
    }
  }

  // Buyer open events keyed by version (and engagement for pre-052 links
  // without version_id).
  const viewAtByVersion = new Map<string, string[]>()
  const viewAtByEngagement = new Map<string, string[]>()
  for (const l of links) {
    if (!l.last_viewed_at) continue
    if (l.version_id) {
      const arr = viewAtByVersion.get(l.version_id) ?? []
      arr.push(l.last_viewed_at)
      viewAtByVersion.set(l.version_id, arr)
    } else {
      const arr = viewAtByEngagement.get(l.engagement_id) ?? []
      arr.push(l.last_viewed_at)
      viewAtByEngagement.set(l.engagement_id, arr)
    }
  }

  const metrics = { ...EMPTY_PRE_FUNNEL }
  const flag = (key: keyof PreFunnelMetrics) => {
    metrics[key] = (metrics[key] as number) + 1
  }

  for (const [engagementId, entries] of versionsByEngagement) {
    const engagement = engagementById.get(engagementId)
    const isActive = engagement
      ? !CLOSED_ENGAGEMENT_STAGES.has(engagement.stage)
      : true
    const alreadyInKanban = engagement
      ? kanbanLeadIds.has(engagement.lead_id)
      : false

    // ---- Window events (distinct per buyer engagement) -----------------
    let introduced = false
    let viewed = false
    let info = false
    let strong = false

    for (const { version, item } of entries) {
      if (inWindow(version.sent_at, windowStart, windowEnd)) {
        introduced = true
      }

      const viewTimestamps = [
        ...(viewAtByVersion.get(version.id) ?? []),
        // Older links pre version_id: attribute an engagement-level view
        // to any sent version containing this client.
        ...(version.id === latestSentByEngagement.get(engagementId)?.id
          ? (viewAtByEngagement.get(engagementId) ?? [])
          : []),
      ]
      if (viewTimestamps.some((t) => inWindow(t, windowStart, windowEnd))) {
        viewed = true
      }

      if (
        item.buyer_action &&
        inWindow(item.buyer_responded_at, windowStart, windowEnd)
      ) {
        if ((STRONG_ACTIONS as readonly string[]).includes(item.buyer_action)) {
          strong = true
        } else if ((SOFT_ACTIONS as readonly string[]).includes(item.buyer_action)) {
          info = true
        }
      }
    }

    if (introduced) flag("introducedInWindow")
    if (viewed) flag("viewedInWindow")
    if (info) flag("infoInWindow")
    if (strong) flag("strongInWindow")

    // ---- Stocks (live shortlist only) ----------------------------------
    if (!isActive || alreadyInKanban) continue
    const liveVersion = latestSentByEngagement.get(engagementId)
    const liveItem = liveVersion
      ? entries.find((e) => e.version.id === liveVersion.id)?.item
      : undefined
    if (!liveItem) continue // client was removed from the current shortlist

    if (
      liveItem.buyer_action &&
      (INTEREST_ACTIONS as readonly string[]).includes(liveItem.buyer_action)
    ) {
      flag("activeInterest")
    } else if (!liveItem.buyer_action) {
      flag("pendingResponse")
    }
  }

  return metrics
}

/** True when a metrics block has nothing to show the client. */
export function isPreFunnelEmpty(m: PreFunnelMetrics): boolean {
  return Object.values(m).every((v) => v === 0)
}
