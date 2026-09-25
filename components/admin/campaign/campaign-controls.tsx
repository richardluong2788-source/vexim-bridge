"use client"

// Controls cho admin: activate/pause/complete campaign + chạy scheduler ngay
// (test/đào tạo không cần chờ cron hourly).

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PauseCircle, PlayCircle, RefreshCw, Archive } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { runSchedulerNowAction, setCampaignStatusAction } from "@/app/admin/campaigns/actions"

export function CampaignControls({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [ticking, setTicking] = useState(false)

  async function setStatus(next: "active" | "paused" | "completed" | "archived") {
    setBusy(true)
    const res = await setCampaignStatusAction(campaignId, next)
    setBusy(false)
    if (res.ok) {
      toast.success(`Campaign → ${next}`)
      router.refresh()
    } else {
      toast.error(res.message ?? "Không đổi được trạng thái")
    }
  }

  async function runNow() {
    setTicking(true)
    const res = await runSchedulerNowAction()
    setTicking(false)
    if (res.ok) {
      const r = res.result
      toast.success(
        `Tick xong: ${r.draftsQueued} draft mới, ${r.followupsQueued} follow-up, ${r.rescheduledWindow} đẩy sang window kế, ${r.suppressed} suppressed, ${r.nurtured} nurture, ${r.draftFailures} lỗi`,
        { duration: 8000 },
      )
      router.refresh()
    } else {
      toast.error(res.message ?? "Scheduler tick thất bại")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={runNow} disabled={ticking}>
        {ticking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        Chạy scheduler
      </Button>
      {status === "draft" && (
        <Button size="sm" onClick={() => setStatus("active")} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Kích hoạt
        </Button>
      )}
      {status === "active" && (
        <Button size="sm" variant="outline" onClick={() => setStatus("paused")} disabled={busy}>
          <PauseCircle className="mr-2 h-4 w-4" /> Tạm dừng
        </Button>
      )}
      {status === "paused" && (
        <Button size="sm" onClick={() => setStatus("active")} disabled={busy}>
          <PlayCircle className="mr-2 h-4 w-4" /> Chạy lại
        </Button>
      )}
      {(status === "completed" || status === "paused") && (
        <Button size="sm" variant="ghost" onClick={() => setStatus("archived")} disabled={busy}>
          <Archive className="mr-2 h-4 w-4" /> Lưu trữ
        </Button>
      )}
    </div>
  )
}
