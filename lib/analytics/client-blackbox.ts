/**
 * "Hộp đen" dữ liệu Client — nhật ký sự kiện + phân tích thắng/thua cho MỘT
 * client cụ thể, theo kỳ (30 ngày / 90 ngày / quý / năm / tất cả).
 *
 * Dùng bởi:
 *   - components/admin/clients/client-blackbox-panel.tsx (tab trong trang
 *     chi tiết client)
 *   - app/api/export/clients/[id]/blackbox/route.ts (export CSV)
 *
 * Nguồn dữ liệu (không tạo bảng mới, chỉ đọc & tổng hợp):
 *   - opportunities / stage_transitions / activities  → lịch sử deal
 *   - leads                                           → tên buyer
 *   - client_requests   (031_sla_tracking.sql)        → AE phản hồi client
 *   - buyer_replies + email_drafts                    → buyer phản hồi AE
 *     (khoảng cách từ email gửi gần nhất tới lúc buyer trả lời)
 *
 * Lưu ý về "lý do thua": hệ thống KHÔNG có cột lost_reason chuẩn hóa. AE ghi
 * lý do dưới dạng note tự do trên opportunities.notes trong lúc chăm sóc ở
 * kanban. Trường `aeNote` dưới đây phản ánh đúng thực tế đó — không suy diễn
 * thêm ý nghĩa.
 */
import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { STAGE_LABEL_VI, monthlyBuckets, monthKey, type Stage, type PeriodWindow } from "./constants"

// ---------------------------------------------------------------------------
// action_type → nhãn tiếng Việt hiển thị trong nhật ký. Danh sách này bám
// theo mọi `action_type` đang được insert vào bảng `activities` trong repo
// (xem app/admin/**/actions.ts, lib/ai/email-sender.ts, lib/matching/*).
// ---------------------------------------------------------------------------
const ACTION_LABEL_VI: Record<string, string> = {
  stage_changed: "Đổi giai đoạn",
  email_sent: "Gửi email cho buyer",
  client_email_sent: "Gửi email cho client",
  buyer_reply_logged: "Ghi nhận phản hồi buyer",
  deal_doc_uploaded: "Upload hồ sơ deal",
  deal_cost_price_denied: "Từ chối sửa giá vốn",
  swift_sod_blocked: "Chặn do chưa xác minh Swift",
  client_product_added: "Thêm sản phẩm client",
  client_product_updated: "Cập nhật sản phẩm client",
  client_product_deleted: "Xóa sản phẩm client",
  country_risk_updated: "Cập nhật rủi ro quốc gia",
  country_risk_removed: "Xóa rủi ro quốc gia",
  lead_created: "Tạo buyer mới",
  bulk_lead_import: "Nhập buyer hàng loạt",
  opportunity_created: "Tạo deal mới",
  engagement_converted: "Chuyển đổi từ AI inbox",
  ai_matching_shared_inbox: "AI gợi ý buyer",
  reengagement_reminder: "Nhắc tái kết nối",
}

function actionLabel(actionType: string): string {
  return ACTION_LABEL_VI[actionType] ?? actionType
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BlackboxActivityRow {
  id: string
  occurredAt: string
  actionType: string
  actionLabel: string
  description: string | null
  performedByName: string | null
  opportunityId: string | null
  buyerName: string | null
}

export interface BlackboxOpportunityRow {
  opportunityId: string
  buyerName: string
  stage: Stage
  stageLabel: string
  createdAt: string
  closedAt: string | null
  outcome: "won" | "lost" | "in_progress"
  potentialValue: number | null
  /** Free-text note kept by the AE on the opportunity — closest proxy to a "lost reason". */
  aeNote: string | null
}

export interface BlackboxMonthlyPoint {
  key: string
  label: string
  opened: number
  won: number
  lost: number
}

export interface ClientBlackboxTotals {
  opened: number
  won: number
  lost: number
  inProgress: number
  winRatePct: number | null
  /** Avg hours from client_requests.received_at to first_response_at, within period. */
  avgClientResponseHours: number | null
  /** Avg hours from the last email sent to the opportunity to the buyer's next reply, within period. */
  avgBuyerResponseHours: number | null
  clientRequestsInPeriod: number
  buyerRepliesInPeriod: number
}

export interface ClientBlackboxData {
  clientId: string
  clientName: string
  periodLabel: string
  totals: ClientBlackboxTotals
  monthly: BlackboxMonthlyPoint[]
  opportunities: BlackboxOpportunityRow[]
  activities: BlackboxActivityRow[]
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

/**
 * Build the full black-box dataset for one client, scoped to `period`.
 * Callers MUST have already verified the caller is allowed to see this
 * client (AE ownership or admin/super_admin bypass) — this function does
 * no authorization of its own.
 */
export async function getClientBlackbox(
  clientId: string,
  period: PeriodWindow,
): Promise<ClientBlackboxData | null> {
  const admin = createAdminClient()

  const { data: client } = await admin
    .from("profiles")
    .select("id, company_name, full_name, email")
    .eq("id", clientId)
    .eq("role", "client")
    .maybeSingle<{ id: string; company_name: string | null; full_name: string | null; email: string | null }>()

  if (!client) return null
  const clientName = client.company_name ?? client.full_name ?? client.email ?? "—"

  // 1) All opportunities for this client (all-time — needed to build the
  //    full deal list + monthly trend independent of the period filter).
  const { data: oppRows } = await admin
    .from("opportunities")
    .select("id, lead_id, stage, potential_value, notes, created_at, last_updated")
    .eq("client_id", clientId)
  const opps = (oppRows ?? []) as Array<{
    id: string
    lead_id: string
    stage: Stage
    potential_value: number | null
    notes: string | null
    created_at: string
    last_updated: string
  }>
  const oppIds = opps.map((o) => o.id)

  // 2) Buyer names for these opportunities.
  const leadIds = [...new Set(opps.map((o) => o.lead_id).filter(Boolean))]
  const buyerNameByLeadId = new Map<string, string>()
  if (leadIds.length > 0) {
    const { data: leadRows } = await admin
      .from("leads")
      .select("id, company_name")
      .in("id", leadIds)
    for (const l of (leadRows ?? []) as Array<{ id: string; company_name: string | null }>) {
      buyerNameByLeadId.set(l.id, l.company_name ?? "—")
    }
  }
  const buyerNameByOppId = new Map(opps.map((o) => [o.id, buyerNameByLeadId.get(o.lead_id) ?? "—"]))

  // 3) Won/lost transitions for these opportunities — used for both the
  //    closed-at timestamp per opportunity and the period totals.
  const closedAtByOppId = new Map<string, { stage: "won" | "lost"; at: string }>()
  const wonLostInPeriod: Array<{ oppId: string; stage: "won" | "lost"; at: string }> = []
  if (oppIds.length > 0) {
    const { data: transRows } = await admin
      .from("stage_transitions")
      .select("opportunity_id, to_stage, transitioned_at")
      .in("opportunity_id", oppIds)
      .in("to_stage", ["won", "lost"])
      .order("transitioned_at", { ascending: true })
    for (const t of (transRows ?? []) as Array<{
      opportunity_id: string
      to_stage: string
      transitioned_at: string
    }>) {
      if (t.to_stage !== "won" && t.to_stage !== "lost") continue
      // Keep the LATEST transition per opportunity (a deal can flip won/lost
      // by human error — same de-dup rule as lib/analytics/queries.ts).
      closedAtByOppId.set(t.opportunity_id, { stage: t.to_stage, at: t.transitioned_at })
      const inPeriod = !period.from || t.transitioned_at >= period.from
      if (inPeriod) wonLostInPeriod.push({ oppId: t.opportunity_id, stage: t.to_stage, at: t.transitioned_at })
    }
  }
  // De-dup wonLostInPeriod to the latest transition per opportunity too.
  const latestPerOppInPeriod = new Map<string, "won" | "lost">()
  for (const r of wonLostInPeriod) latestPerOppInPeriod.set(r.oppId, r.stage)
  const wonInPeriod = [...latestPerOppInPeriod.values()].filter((v) => v === "won").length
  const lostInPeriod = [...latestPerOppInPeriod.values()].filter((v) => v === "lost").length
  const decided = wonInPeriod + lostInPeriod
  const winRatePct = decided > 0 ? Math.round((wonInPeriod / decided) * 100) : null

  // 4) Opened-in-period + in-progress snapshot.
  const openedInPeriod = opps.filter((o) => !period.from || o.created_at >= period.from).length
  const inProgress = opps.filter((o) => o.stage !== "won" && o.stage !== "lost").length

  // 5) Deal list — opportunities "touched" during the period: created in
  //    period OR closed (won/lost) in period. If period is "all time"
  //    (period.from === null), every opportunity qualifies.
  const oppIdsTouched = new Set<string>(
    opps
      .filter((o) => {
        if (!period.from) return true
        if (o.created_at >= period.from) return true
        const closed = closedAtByOppId.get(o.id)
        return !!closed && closed.at >= period.from
      })
      .map((o) => o.id),
  )
  const opportunities: BlackboxOpportunityRow[] = opps
    .filter((o) => oppIdsTouched.has(o.id))
    .map((o) => {
      const closed = closedAtByOppId.get(o.id)
      const outcome: BlackboxOpportunityRow["outcome"] =
        o.stage === "won" ? "won" : o.stage === "lost" ? "lost" : "in_progress"
      return {
        opportunityId: o.id,
        buyerName: buyerNameByOppId.get(o.id) ?? "—",
        stage: o.stage,
        stageLabel: STAGE_LABEL_VI[o.stage] ?? o.stage,
        createdAt: o.created_at,
        closedAt: closed?.at ?? null,
        outcome,
        potentialValue: o.potential_value,
        aeNote: o.notes && o.notes.trim() ? o.notes.trim() : null,
      }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  // 6) Raw activity log — every activities row tied to one of this
  //    client's opportunities, filtered to the selected period.
  let activities: BlackboxActivityRow[] = []
  if (oppIds.length > 0) {
    let actQ = admin
      .from("activities")
      .select("id, opportunity_id, action_type, description, performed_by, created_at")
      .in("opportunity_id", oppIds)
      .order("created_at", { ascending: false })
      .limit(2000)
    if (period.from) actQ = actQ.gte("created_at", period.from)
    const { data: actRows } = await actQ
    const performerIds = [
      ...new Set(
        (actRows ?? [])
          .map((a: { performed_by: string | null }) => a.performed_by)
          .filter((v): v is string => !!v),
      ),
    ]
    const nameByPerformerId = new Map<string, string>()
    if (performerIds.length > 0) {
      const { data: performers } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", performerIds)
      for (const p of (performers ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        nameByPerformerId.set(p.id, p.full_name ?? p.email ?? "—")
      }
    }
    activities = (actRows ?? []).map(
      (a: {
        id: string
        opportunity_id: string | null
        action_type: string
        description: string | null
        performed_by: string | null
        created_at: string
      }) => ({
        id: a.id,
        occurredAt: a.created_at,
        actionType: a.action_type,
        actionLabel: actionLabel(a.action_type),
        description: a.description,
        performedByName: a.performed_by ? nameByPerformerId.get(a.performed_by) ?? "—" : null,
        opportunityId: a.opportunity_id,
        buyerName: a.opportunity_id ? buyerNameByOppId.get(a.opportunity_id) ?? null : null,
      }),
    )
  }

  // 7) Client response time — client_requests (M4 SLA source).
  let clientReqQ = admin
    .from("client_requests" as never)
    .select("received_at, first_response_at")
    .eq("client_id", clientId)
  if (period.from) clientReqQ = clientReqQ.gte("received_at", period.from)
  const { data: clientReqRows } = await clientReqQ.returns<
    Array<{ received_at: string; first_response_at: string | null }>
  >()
  const clientResponseHours = (clientReqRows ?? [])
    .filter((r) => r.first_response_at)
    .map((r) => (new Date(r.first_response_at!).getTime() - new Date(r.received_at).getTime()) / 3_600_000)
    .filter((h) => h >= 0)
  const avgClientResponseHours = avg(clientResponseHours)

  // 8) Buyer response time — buyer_replies vs. the last email sent to the
  //    same opportunity before the reply landed.
  let buyerReplyRows: Array<{ opportunity_id: string; received_at: string }> = []
  if (oppIds.length > 0) {
    let buyerReplyQ = admin
      .from("buyer_replies" as never)
      .select("opportunity_id, received_at")
      .in("opportunity_id", oppIds)
    if (period.from) buyerReplyQ = buyerReplyQ.gte("received_at", period.from)
    const { data } = await buyerReplyQ.returns<Array<{ opportunity_id: string; received_at: string }>>()
    buyerReplyRows = data ?? []
  }
  const avgBuyerResponseHours = await computeAvgBuyerResponseHours(admin, buyerReplyRows)

  // 9) Monthly trend (last 12 months) — independent of the period filter,
  //    mirrors the pattern used by getSingleClientMetrics.
  const buckets = monthlyBuckets(12)
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  const monthly: BlackboxMonthlyPoint[] = buckets.map((b) => ({ ...b, opened: 0, won: 0, lost: 0 }))
  for (const o of opps) {
    const i = idx.get(monthKey(o.created_at))
    if (i !== undefined) monthly[i].opened += 1
  }
  const seenTrend = new Set<string>()
  for (const [oppId, closed] of closedAtByOppId.entries()) {
    const k = monthKey(closed.at)
    const dedup = `${oppId}|${k}|${closed.stage}`
    if (seenTrend.has(dedup)) continue
    seenTrend.add(dedup)
    const i = idx.get(k)
    if (i === undefined) continue
    if (closed.stage === "won") monthly[i].won += 1
    else monthly[i].lost += 1
  }

  return {
    clientId,
    clientName,
    periodLabel: period.label,
    totals: {
      opened: openedInPeriod,
      won: wonInPeriod,
      lost: lostInPeriod,
      inProgress,
      winRatePct,
      avgClientResponseHours,
      avgBuyerResponseHours,
      clientRequestsInPeriod: clientReqRows?.length ?? 0,
      buyerRepliesInPeriod: buyerReplyRows.length,
    },
    monthly,
    opportunities,
    activities,
  }
}

/**
 * For each buyer reply, find the most recent `email_drafts` row (status =
 * 'sent') sent to the SAME opportunity at or before the reply landed, and
 * compute the gap in hours. Averaged across all replies in scope.
 */
async function computeAvgBuyerResponseHours(
  admin: ReturnType<typeof createAdminClient>,
  replies: Array<{ opportunity_id: string; received_at: string }>,
): Promise<number | null> {
  if (replies.length === 0) return null
  const oppIds = [...new Set(replies.map((r) => r.opportunity_id))]
  const { data: sentRows } = await admin
    .from("email_drafts")
    .select("opportunity_id, sent_at")
    .in("opportunity_id", oppIds)
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: true })

  const sentByOpp = new Map<string, number[]>()
  for (const r of (sentRows ?? []) as Array<{ opportunity_id: string; sent_at: string }>) {
    const arr = sentByOpp.get(r.opportunity_id) ?? []
    arr.push(new Date(r.sent_at).getTime())
    sentByOpp.set(r.opportunity_id, arr)
  }

  const hours: number[] = []
  for (const reply of replies) {
    const sentTimes = sentByOpp.get(reply.opportunity_id)
    if (!sentTimes || sentTimes.length === 0) continue
    const receivedAt = new Date(reply.received_at).getTime()
    // Most recent send that happened before the reply arrived.
    const priorSends = sentTimes.filter((t) => t <= receivedAt)
    if (priorSends.length === 0) continue
    const lastSend = Math.max(...priorSends)
    const diffHours = (receivedAt - lastSend) / 3_600_000
    if (diffHours >= 0) hours.push(diffHours)
  }
  return avg(hours)
}
