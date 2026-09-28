import { NextResponse, type NextRequest } from "next/server"
import { runCampaignSchedulerTick } from "@/lib/campaign/scheduler"

/**
 * Campaign scheduler — hourly tick cho Vexim AI Outreach Engine (B1).
 *
 * Trách nhiệm (xem lib/campaign/scheduler.ts):
 *   reclaim firing treo → stop/suppression check → resume PAUSED →
 *   sinh draft đến hạn (claim exactly-once) → QA → approval queue →
 *   grace advanced → follow-up/NURTURE → daily limits → integrity check.
 *
 * SHADOW MODE: không bao giờ tự gửi email — mọi draft vào email_drafts
 * 'pending_approval' và đợi AE duyệt (lib/campaign/approve.ts).
 *
 * Auth: Bearer CRON_SECRET (giống 14 cron hiện có) + cho phép manual trigger
 * bằng header x-campaign-manual khi gọi từ server action (không lộ secret).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runCampaignSchedulerTick()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[v0] campaign-scheduler tick failed:", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
