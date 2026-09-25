/**
 * /admin/campaigns/[id] — chi tiết campaign (B1):
 *   - Stats + sequence steps
 *   - Approval queue: draft AI chờ duyệt (shadow mode) — xem QA, sửa, gửi / từ chối
 *   - Enrollments: bảng trạng thái + hành động pause/resume/stop/resolve review
 *   - Enroll dialog: chọn lead theo bộ lọc pilot (50–100 buyer có tín hiệu rõ)
 *   - Controls (admin): activate/pause campaign, chạy scheduler ngay
 */

import { redirect, notFound } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ApprovalQueue, type ApprovalDraft } from "@/components/admin/campaign/approval-queue"
import { CampaignEnrollmentsTable, type EnrollmentRowView } from "@/components/admin/campaign/enrollments-table"
import { CampaignControls } from "@/components/admin/campaign/campaign-controls"
import { EnrollDialog } from "@/components/admin/campaign/enroll-dialog"
import { StepsTimeline } from "@/components/admin/campaign/steps-timeline"

export const dynamic = "force-dynamic"

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.CAMPAIGN_VIEW)) redirect("/admin")

  const admin = current.admin
  const isAdmin = current.role === "admin" || current.role === "super_admin"
  const isAE = current.role === "account_executive"

  const { data: campaign } = await (admin.from("campaigns") as any).select("*").eq("id", id).single()
  if (!campaign) notFound()
  const c = campaign as {
    id: string; name: string; description: string | null; status: string
    target_segment: string | null; product_category: string | null
    daily_send_limit: number; start_date: string | null; end_date: string | null
  }

  const { data: steps } = await (admin.from("campaign_steps") as any)
    .select("*")
    .eq("campaign_id", id)
    .order("step_number", { ascending: true })

  // Enrollments + lead info. AE chỉ thấy enrollment mình sở hữu.
  let enrollQuery = (admin.from("campaign_enrollments") as any)
    .select(
      `*, lead:leads(id, company_name, contact_person, contact_email, country, industry)`,
    )
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false })
    .limit(300)
  if (isAE) enrollQuery = enrollQuery.eq("owner_id", current.userId)

  const { data: enrollments } = await enrollQuery
  const enrollmentRows = (enrollments ?? []) as EnrollmentRowView[]
  const enrollmentIds = enrollmentRows.map((r) => r.id)

  // Approval queue: drafts pending (hoặc bị QA chặn status 'draft') của campaign.
  const { data: drafts } = enrollmentIds.length
    ? await (admin.from("email_drafts") as any)
        .select(
          `*, enrollment:campaign_enrollments(id, lead_id, owner_id, state, current_step_number,
             lead:leads(id, company_name, contact_person, contact_email))`,
        )
        .in("campaign_enrollment_id", enrollmentIds)
        .in("status", ["pending_approval", "draft"])
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] }

  const draftRows = (drafts ?? []) as ApprovalDraft[]

  // ── Pilot metrics (yêu cầu 25/09/2026) ──
  const { count: draftsCreated } = enrollmentIds.length
    ? await (admin.from("email_drafts") as any)
        .select("id", { count: "exact", head: true })
        .in("campaign_enrollment_id", enrollmentIds)
    : { count: 0 }
  const { count: draftsRejected } = enrollmentIds.length
    ? await (admin.from("email_drafts") as any)
        .select("id", { count: "exact", head: true })
        .in("campaign_enrollment_id", enrollmentIds)
        .eq("status", "rejected")
    : { count: 0 }
  const { count: draftsSent } = enrollmentIds.length
    ? await (admin.from("email_drafts") as any)
        .select("id", { count: "exact", head: true })
        .in("campaign_enrollment_id", enrollmentIds)
        .eq("status", "sent")
    : { count: 0 }
  // Human edit rate: từ interaction EMAIL đã gửi (human_approved) — metadata.edited.
  const { data: sentInteractions } = enrollmentIds.length
    ? await (admin.from("buyer_interactions") as any)
        .select("metadata")
        .in("enrollment_id", enrollmentIds)
        .eq("interaction_type", "EMAIL")
        .eq("human_approved", true)
    : { data: [] }
  const sentMeta = ((sentInteractions ?? []) as Array<{ metadata: { edited?: boolean } | null }>)
  const editedCount = sentMeta.filter((m) => m.metadata?.edited === true).length
  const sentEmailCount = sentMeta.length

  // Gate stats (follow-up bị chặn vì "không có lý do hợp lý" / HOLD).
  const { count: gateSkipCount } = enrollmentIds.length
    ? await (admin.from("campaign_step_firings") as any)
        .select("id", { count: "exact", head: true })
        .in("enrollment_id", enrollmentIds)
        .eq("status", "skipped")
    : { count: 0 }

  // Stats funnel cơ bản (B1-lite §23).
  const stats = {
    total: enrollmentRows.length,
    contacted: enrollmentRows.filter((r) => ["contacted", "waiting_reply", "followup_1", "followup_2"].includes(r.state)).length,
    replied: enrollmentRows.filter((r) => !!r.last_reply_at).length,
    handoff: enrollmentRows.filter((r) => r.state === "replied_handoff").length,
    stopped: enrollmentRows.filter((r) => ["stopped", "suppressed", "invalid_contact", "nurture"].includes(r.state)).length,
    review: enrollmentRows.filter((r) => r.needs_human_review).length,
    pendingApproval: draftRows.filter((d) => d.status === "pending_approval").length,
    qaBlocked: draftRows.filter((d) => d.status === "draft").length,
  }
  const replyRate = stats.contacted > 0 ? Math.round((stats.replied / stats.contacted) * 100) : 0

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null)
  const followupRows = enrollmentRows.filter((r) => r.followup_count > 0)
  const pilotMetrics = {
    aiRejectionRate: pct(draftsRejected ?? 0, draftsCreated ?? 0),
    humanEditRate: pct(editedCount, sentEmailCount),
    replyRate: pct(stats.replied, stats.contacted),
    interestedRate: pct(stats.handoff, stats.replied),
    wrongContact: enrollmentRows.filter((r) => r.state === "invalid_contact").length,
    optOut: enrollmentRows.filter((r) => r.state === "suppressed" && r.stopped_reason === "buyer_opted_out").length,
    followupConversionNum: followupRows.filter((r) => !!r.last_reply_at).length,
    followupConversionDen: followupRows.length,
    followupConversion: pct(
      followupRows.filter((r) => !!r.last_reply_at).length,
      followupRows.length,
    ),
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{c.name}</h1>
            <Badge variant="outline" className={STATUS_TONE[c.status]}>{c.status}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{c.description ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <EnrollDialog campaignId={c.id} campaignStatus={c.status} canManage={isAdmin || isAE} />
          {isAdmin && <CampaignControls campaignId={c.id} status={c.status} />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Buyer", value: stats.total },
          { label: "Đã liên hệ", value: stats.contacted },
          { label: "Đã reply", value: stats.replied },
          { label: "Reply rate", value: replyRate + "%" },
          { label: "Handoff AE", value: stats.handoff },
          { label: "Chờ duyệt", value: stats.pendingApproval },
          { label: "QA chặn", value: stats.qaBlocked },
          { label: "Cần review", value: stats.review },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="px-4 py-3">
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pilot metrics — đánh giá trước khi quyết định auto-send */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chỉ số pilot (đánh giá 2–4 tuần trước khi bật auto-send)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {[
              { label: "AI rejection rate", value: pilotMetrics.aiRejectionRate === null ? "—" : pilotMetrics.aiRejectionRate + "%", hint: `${draftsRejected ?? 0}/${draftsCreated ?? 0} draft bị từ chối` },
              { label: "Human edit rate", value: pilotMetrics.humanEditRate === null ? "—" : pilotMetrics.humanEditRate + "%", hint: `${editedCount}/${sentEmailCount} email bị AE sửa` },
              { label: "Reply rate", value: pilotMetrics.replyRate === null ? "—" : pilotMetrics.replyRate + "%", hint: "reply / đã liên hệ" },
              { label: "Interested rate", value: pilotMetrics.interestedRate === null ? "—" : pilotMetrics.interestedRate + "%", hint: `${stats.handoff}/${stats.replied} reply INTERESTED` },
              { label: "Wrong contact", value: String(pilotMetrics.wrongContact), hint: "enrollment invalid_contact" },
              { label: "Opt-out", value: String(pilotMetrics.optOut), hint: "suppressed (buyer_opted_out)" },
              { label: "Follow-up conversion", value: pilotMetrics.followupConversion === null ? "—" : pilotMetrics.followupConversion + "%", hint: `${pilotMetrics.followupConversionNum}/${pilotMetrics.followupConversionDen} reply sau follow-up · gate skip: ${gateSkipCount ?? 0}` },
            ].map((m) => (
              <div key={m.label} className="rounded-md border p-3">
                <div className="text-xl font-semibold">{m.value}</div>
                <div className="text-xs font-medium">{m.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sequence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sequence (campaign_steps)</CardTitle>
        </CardHeader>
        <CardContent>
          <StepsTimeline steps={(steps ?? []) as never} />
        </CardContent>
      </Card>

      {/* Approval queue */}
      <ApprovalQueue drafts={draftRows} />

      {/* Enrollments */}
      <CampaignEnrollmentsTable
        enrollments={enrollmentRows}
        canManage={isAdmin || isAE}
        isAE={isAE}
        currentUserId={current.userId}
      />
    </div>
  )
}
