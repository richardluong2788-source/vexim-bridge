/**
 * Sidebar notification-count badges — one number per nav item, computed
 * with the exact same scoping/definition each destination page already
 * uses for its own "pending" state, so the badge never disagrees with
 * what the AE sees after clicking through:
 *
 *   - "Buyer của tôi" (/admin/ae-inbox)   → pending ae_match_inbox rows
 *     (mirrors app/admin/ae-inbox/page.tsx's inboxQuery)
 *   - "Đang xử lý" (/admin/engagements)   → open buyer_engagements that
 *     either (a) are freshly claimed and still waiting on the AE to send
 *     the opening/requirement email (stage === "claimed"), or (b) have at
 *     least one unread buyer_replies row (mirrors the unread badge shown
 *     on each card in engagement-list.tsx). This ensures claiming a buyer
 *     from "Buyer của tôi" immediately bumps this badge, even before any
 *     buyer reply exists.
 *   - "Pipeline" (/admin/pipeline)        → open opportunities with at
 *     least one unread buyer_replies row (mirrors the kanban board's
 *     unreadReplyCountByOpp in app/admin/pipeline/page.tsx)
 *   - "Buyer" (/admin/buyers)             → total buyers visible to this
 *     user (mirrors app/admin/buyers/page.tsx's allowedLeadIds scoping)
 *
 * AE/staff only ever count their own rows; every other admin-shell role
 * (admin, super_admin, lead_researcher) sees the org-wide number, matching
 * each page's own role branch.
 */
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"
import { createAdminClient } from "@/lib/supabase/admin"

type AdminSB = ReturnType<typeof createAdminClient>

export interface SidebarBadgeCounts {
  myBuyers: number
  inProgress: number
  pipeline: number
  buyers: number
}

const EMPTY_COUNTS: SidebarBadgeCounts = {
  myBuyers: 0,
  inProgress: 0,
  pipeline: 0,
  buyers: 0,
}

export async function getSidebarBadgeCounts(): Promise<SidebarBadgeCounts> {
  const current = await getCurrentRole()
  if (!current) return EMPTY_COUNTS
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)
  const isAE = role === "account_executive"

  const [myBuyers, inProgress, pipeline, buyers] = await Promise.all([
    countMyBuyers(admin, isAE, userId),
    countInProgressWithUnread(admin, isAE, userId),
    countPipelineWithUnread(admin, scope),
    countBuyers(admin, role, userId),
  ])

  return { myBuyers, inProgress, pipeline, buyers }
}

// ---------------------------------------------------------------------------
// 1. "Buyer của tôi" — pending AI-match inbox items.
// ---------------------------------------------------------------------------
async function countMyBuyers(
  admin: AdminSB,
  isAE: boolean,
  userId: string,
): Promise<number> {
  let q = admin
    .from("ae_match_inbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
  if (isAE) q = q.eq("account_manager_id", userId)
  const { count } = await q
  return count ?? 0
}

// ---------------------------------------------------------------------------
// 2. "Đang xử lý" — open engagements (claimed, not yet converted/dropped)
//    that have a buyer email waiting to be read.
// ---------------------------------------------------------------------------
async function countInProgressWithUnread(
  admin: AdminSB,
  isAE: boolean,
  userId: string,
): Promise<number> {
  let engQ = admin
    .from("buyer_engagements")
    .select("id, stage")
    .not("stage", "in", "(converted,dropped)")
  if (isAE) engQ = engQ.eq("account_manager_id", userId)
  const { data: engagements } = await engQ
  const allEngagements = engagements ?? []
  if (allEngagements.length === 0) return 0

  // (a) freshly claimed, AE hasn't sent the opening/requirement email yet —
  // these need attention right away, before any buyer reply can exist.
  const needsAction = new Set(
    allEngagements
      .filter((e: { id: string; stage: string }) => e.stage === "claimed")
      .map((e: { id: string; stage: string }) => e.id),
  )

  // (b) any open engagement with an unread buyer reply.
  const engagementIds = allEngagements.map((e: { id: string }) => e.id)
  const { data: unread } = await admin
    .from("buyer_replies")
    .select("engagement_id")
    .in("engagement_id", engagementIds)
    .is("read_at", null)

  for (const r of unread ?? []) {
    const engagementId = (r as { engagement_id: string | null }).engagement_id
    if (engagementId) needsAction.add(engagementId)
  }

  return needsAction.size
}

// ---------------------------------------------------------------------------
// 3. "Pipeline" — open opportunities (any buyer) with an unread reply.
// ---------------------------------------------------------------------------
async function countPipelineWithUnread(
  admin: AdminSB,
  scope: ReturnType<typeof ownershipScopeFor>,
): Promise<number> {
  let oppQ = admin.from("opportunities").select("id")
  if (scope.kind === "owned") oppQ = oppQ.eq("account_manager_id", scope.userId)
  const { data: opportunities } = await oppQ
  const oppIds = (opportunities ?? []).map((o: { id: string }) => o.id)
  if (oppIds.length === 0) return 0

  const { data: unread } = await admin
    .from("buyer_replies")
    .select("opportunity_id")
    .in("opportunity_id", oppIds)
    .is("read_at", null)

  const distinctOpps = new Set(
    (unread ?? [])
      .map((r: { opportunity_id: string | null }) => r.opportunity_id)
      .filter((v: string | null): v is string => !!v),
  )
  return distinctOpps.size
}

// ---------------------------------------------------------------------------
// 4. "Buyer" — total buyer count visible to this user, mirroring the
//    Buyer directory's own scoping rule (AE: assigned via opportunities;
//    LR/admin: everyone in the pool).
// ---------------------------------------------------------------------------
async function countBuyers(
  admin: AdminSB,
  role: string,
  userId: string,
): Promise<number> {
  const isAE = role === "account_executive" || role === "staff"

  if (!isAE) {
    const { count } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
    return count ?? 0
  }

  const { data: oppLeadRows } = await admin
    .from("opportunities")
    .select("lead_id")
    .eq("account_manager_id", userId)
  const distinctLeadIds = new Set(
    (oppLeadRows ?? [])
      .map((r: { lead_id: string | null }) => r.lead_id)
      .filter((v: string | null): v is string => !!v),
  )
  return distinctLeadIds.size
}
