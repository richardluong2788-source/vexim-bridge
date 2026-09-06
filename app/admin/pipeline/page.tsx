import { redirect } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { KanbanBoard, type NeedsReplyItem } from "@/components/admin/kanban-board"
import { ScopeBanner } from "@/components/admin/scope-banner"
import type { NextMeetingInfo, OpportunityWithClient } from "@/lib/supabase/types"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"
import { CAPS, can } from "@/lib/auth/permissions"

export const dynamic = "force-dynamic"

export default async function AdminPipelinePage() {
  const { t, locale } = await getDictionary()

  // Use the role-aware client so we can scope by ownership snapshot.
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  // Capability gate (defense-in-depth): the ownership scope alone is NOT a
  // sufficient gate — roles with OWNERSHIP_BYPASS that are not supposed to
  // see deals (e.g. supplier_researcher) would otherwise reach this page
  // via direct URL.
  if (!can(current.role, CAPS.DEAL_VIEW)) redirect("/admin")
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)

  // Filter opportunities by the snapshot column (frozen at WON/LOST). For
  // in-progress deals the snapshot is kept in sync by the BEFORE-UPDATE
  // trigger AND by setAccountManager() at reassignment time, so the AE
  // always sees a consistent slice.
  let oppQ = admin
    .from("opportunities")
    .select(`
      *,
      profiles:client_id (*, client_profiles(display_name)),
      leads:lead_id (*)
    `)
    // Opportunities auto-archived after sitting 7 days in "lost" (migration
    // 066 + cron /api/cron/archive-lost-opportunities) are hidden from the
    // Kanban board. They still exist for history/analytics — this only
    // affects what renders here.
    .is("archived_at", null)
    .order("last_updated", { ascending: false })
  if (scope.kind === "owned") {
    oppQ = oppQ.eq("account_manager_id", scope.userId)
  }
  const { data: opportunities } = await oppQ

  // Fetch unread buyer replies (with enough detail to render a "Cần phản
  // hồi" triage list) so the Kanban card can surface a notification badge
  // AND admins get a chat-inbox-style list of who just replied, without
  // reordering the Kanban cards themselves (see needsReplyItems below).
  const oppIds = ((opportunities ?? []) as Array<{ id: string }>).map((o) => o.id)
  let unreadByOpp: Record<string, number> = {}
  const needsReplyItems: NeedsReplyItem[] = []

  // Time-in-current-stage, sourced from the `opportunity_metrics_v` view
  // (migration 029) so the Kanban card can show "đã ở giai đoạn này X
  // ngày" — this is what lets an AE spot a buyer that's gone stale in a
  // stage without having to recall how long ago they dragged the card.
  let daysInStageByOpp: Record<string, number> = {}
  if (oppIds.length > 0) {
    const { data: metrics } = await admin
      .from("opportunity_metrics_v")
      .select("opportunity_id, days_in_current_stage")
      .in("opportunity_id", oppIds)
    if (metrics) {
      for (const row of metrics as Array<{
        opportunity_id: string
        days_in_current_stage: number
      }>) {
        daysInStageByOpp[row.opportunity_id] = row.days_in_current_stage
      }
    }
  }
  // Cuộc gặp & tham quan sắp tới (migration 070) — badge 📅 trên thẻ
  // + dải "sắp tới" phía trên bảng: đây là lịch của deal (video call,
  // factory tour, buyer trip), không phải giai đoạn pipeline.
  const meetingsByOpp: Record<string, NextMeetingInfo> = {}
  const upcomingMeetings: Array<{
    title: string
    kind: string
    scheduledAt: string
    buyerName: string
  }> = []
  if (oppIds.length > 0) {
    const { data: meetings } = await admin
      .from("opportunity_meetings")
      .select("opportunity_id, kind, title, scheduled_at")
      .in("opportunity_id", oppIds)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
    if (meetings) {
      const oppById = new Map(
        ((opportunities ?? []) as unknown as OpportunityWithClient[]).map((o) => [o.id, o]),
      )
      for (const row of meetings as Array<{
        opportunity_id: string
        kind: string
        title: string
        scheduled_at: string
      }>) {
        const cur = meetingsByOpp[row.opportunity_id]
        if (!cur) {
          meetingsByOpp[row.opportunity_id] = { count: 1, nextAt: row.scheduled_at }
        } else {
          cur.count += 1
        }
        if (upcomingMeetings.length < 8) {
          const opp = oppById.get(row.opportunity_id)
          upcomingMeetings.push({
            title: row.title,
            kind: row.kind,
            scheduledAt: row.scheduled_at,
            buyerName: opp?.leads?.company_name ?? "—",
          })
        }
      }
    }
  }

  if (oppIds.length > 0) {
    const { data: unreadReplies } = await admin
      .from("buyer_replies")
      .select("opportunity_id, raw_content, from_email, received_at")
      .in("opportunity_id", oppIds)
      .is("read_at", null)
      .order("received_at", { ascending: false })
    if (unreadReplies) {
      const oppById = new Map(
        ((opportunities ?? []) as unknown as OpportunityWithClient[]).map((o) => [o.id, o]),
      )
      const seenOpp = new Set<string>()
      for (const row of unreadReplies as Array<{
        opportunity_id: string
        raw_content: string
        from_email: string | null
        received_at: string
      }>) {
        unreadByOpp[row.opportunity_id] = (unreadByOpp[row.opportunity_id] ?? 0) + 1
        // Already ordered newest-first, so the first row we see per
        // opportunity is its most recent unread reply — that's the one
        // we surface in the triage list (one row per opportunity, not
        // per message, to keep the list scannable).
        if (!seenOpp.has(row.opportunity_id)) {
          seenOpp.add(row.opportunity_id)
          const opp = oppById.get(row.opportunity_id)
          if (opp) {
            needsReplyItems.push({
              opportunityId: row.opportunity_id,
              companyName: opp.leads?.company_name ?? "—",
              stage: opp.stage,
              fromEmail: row.from_email,
              snippet: row.raw_content.slice(0, 140),
              receivedAt: row.received_at,
            })
          }
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.pipeline.title}</h1>
        <p className="text-sm text-muted-foreground">{t.admin.pipeline.subtitle}</p>
        {scope.kind === "owned" && (
          <ScopeBanner
            locale={locale}
            count={opportunities?.length ?? 0}
            entityVi="cơ hội"
            entityEn="opportunities"
          />
        )}
      </div>
      {upcomingMeetings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {locale === "vi" ? "Lịch sắp tới" : "Upcoming"}
          </span>
          {upcomingMeetings.map((m, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm"
            >
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{m.buyerName}</span>
              <span>· {kindLabelVi(m.kind)}</span>
              <span>
                ·{" "}
                {new Date(m.scheduledAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          ))}
        </div>
      )}
      <KanbanBoard
        opportunities={(opportunities as unknown as OpportunityWithClient[]) ?? []}
        unreadReplyCountByOpp={unreadByOpp}
        needsReplyItems={needsReplyItems}
        daysInStageByOpp={daysInStageByOpp}
        meetingsByOpp={meetingsByOpp}
      />
    </div>
  )
}

function kindLabelVi(kind: string): string {
  switch (kind) {
    case "video_call": return "Video call"
    case "factory_tour": return "Tham quan nhà máy"
    case "buyer_trip": return "Buyer sang VN"
    case "trade_fair": return "Hội chợ"
    default: return "Họp"
  }
}
