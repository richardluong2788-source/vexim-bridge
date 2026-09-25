"use client"

/**
 * /admin/campaigns — trang danh sách campaign + tạo mới (B1, shadow mode).
 *
 * Server component đọc dữ liệu; mọi mutation đi qua server actions trong
 * app/admin/campaigns/actions.ts. RBAC: CAMPAIGN_VIEW để xem; tạo/activate
 * được server action tự kiểm tra thêm admin/super_admin.
 */

import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreateCampaignDialog } from "@/components/admin/campaign/create-campaign-dialog"
import { Rocket, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

interface CampaignListItem {
  id: string
  name: string
  description: string | null
  status: string
  target_segment: string | null
  product_category: string | null
  daily_send_limit: number
  created_at: string
  enrollment_count: number
  pending_drafts: number
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
}

const STATUS_VI: Record<string, string> = {
  draft: "Bản nháp",
  active: "Đang chạy",
  paused: "Tạm dừng",
  completed: "Hoàn tất",
  archived: "Lưu trữ",
}

export default async function CampaignsPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.CAMPAIGN_VIEW)) redirect("/admin")

  const admin = current.admin

  const { data: campaigns } = await (admin.from("campaigns") as any)
    .select("*")
    .order("created_at", { ascending: false })

  const list = (campaigns ?? []) as CampaignListItem[]

  // Đếm enrollment + pending drafts cho từng campaign (số campaign nhỏ trong
  // pilot — N+1 nhẹ với head count là chấp nhận được).
  for (const c of list) {
    const { count } = await (admin.from("campaign_enrollments") as any)
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id)
    c.enrollment_count = count ?? 0

    const { data: enrollIds } = await (admin.from("campaign_enrollments") as any)
      .select("id")
      .eq("campaign_id", c.id)
    const ids = ((enrollIds ?? []) as Array<{ id: string }>).map((r) => r.id)

    if (ids.length === 0) {
      c.pending_drafts = 0
      continue
    }
    const { count: pending } = await (admin.from("email_drafts") as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .in("campaign_enrollment_id", ids)
    c.pending_drafts = pending ?? 0
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Rocket className="h-6 w-6" /> Chiến dịch outreach
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI Outreach Engine B1 — shadow mode: AI soạn + QA, AE duyệt trước khi gửi.
          </p>
        </div>
        <CreateCampaignDialog canCreate={current.role === "admin" || current.role === "super_admin"} />
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Chưa có campaign nào. Migration 090 đã seed campaign pilot
            &ldquo;US Food Buyer – Vietnam Sourcing – Pilot&rdquo; — nếu không thấy, chạy
            <code className="mx-1 rounded bg-muted px-1 py-0.5">scripts/090_campaign_pilot_seed.sql</code>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.name}</CardTitle>
                    <Badge variant="outline" className={STATUS_TONE[c.status] ?? STATUS_TONE.draft}>
                      {STATUS_VI[c.status] ?? c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="line-clamp-2 text-muted-foreground">{c.description ?? "—"}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{c.enrollment_count}</strong> buyer
                    </span>
                    <span>
                      <strong className="text-foreground">{c.pending_drafts}</strong> chờ duyệt
                    </span>
                    <span>Limit {c.daily_send_limit}/ngày</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    Mở chi tiết <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
