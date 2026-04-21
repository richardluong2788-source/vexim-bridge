import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"
import { FDA_WARNING_DAYS, getFdaStatus } from "@/lib/fda/status"

// Resend SDK uses Node APIs — force Node runtime.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * How often (in days) we re-send the FDA renewal reminder once a client is
 * inside the warning window. Keeps us from pinging them every single day of
 * the 90-day countdown, but still nudges them every ~2 weeks and again right
 * before expiry.
 */
const RENOTIFY_EVERY_DAYS = 14

/**
 * Daily FDA expiry-watch cron.
 *
 * Run once a day (see vercel.json). Scans all clients with a set
 * fda_expires_at, and dispatches an `action_required` notification when:
 *
 *   - FDA has already expired, OR
 *   - Expiry is within FDA_WARNING_DAYS (default 90), AND
 *   - We haven't already notified them in the last RENOTIFY_EVERY_DAYS days.
 *
 * The dispatcher itself takes care of per-user preferences, email delivery
 * via Resend, and inserting the in-app notification record.
 */
export async function GET(request: Request) {
  // 1. AuthN: cron secret header (same convention as weekly-report).
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // 2. Fetch only rows that could possibly fire. The partial index created
  //    in the migration makes this scan cheap. We include `valid` rows too
  //    so that when a date rolls forward we still pick it up — the status
  //    check below will filter them out.
  const today = new Date()
  const horizon = new Date(today)
  horizon.setUTCDate(horizon.getUTCDate() + FDA_WARNING_DAYS)

  const { data: clients, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, company_name, fda_expires_at, fda_renewal_notified_at",
    )
    .eq("role", "client")
    .not("fda_expires_at", "is", null)
    .lte("fda_expires_at", horizon.toISOString().slice(0, 10))

  if (error) {
    return NextResponse.json(
      { error: "Failed to load clients", detail: error.message },
      { status: 500 },
    )
  }

  const results: Array<{
    clientId: string
    status: "notified" | "skipped" | "failed"
    reason?: string
  }> = []

  const nowMs = today.getTime()
  const renotifyMs = RENOTIFY_EVERY_DAYS * 86_400_000

  for (const c of clients ?? []) {
    const info = getFdaStatus(c.fda_expires_at)

    // Defensive: the query already filtered, but re-check to be explicit.
    if (info.status !== "expired" && info.status !== "expiring_soon") {
      results.push({ clientId: c.id, status: "skipped", reason: "not in window" })
      continue
    }

    // Dedup: don't re-send within RENOTIFY_EVERY_DAYS.
    if (c.fda_renewal_notified_at) {
      const lastMs = new Date(c.fda_renewal_notified_at).getTime()
      if (!Number.isNaN(lastMs) && nowMs - lastMs < renotifyMs) {
        results.push({ clientId: c.id, status: "skipped", reason: "recently notified" })
        continue
      }
    }

    const label = c.company_name ?? c.full_name ?? "your company"
    const days = info.daysUntilExpiry ?? 0
    const absDays = Math.abs(days)

    // Build bilingual payload. The dispatcher will pick the right language
    // based on the recipient's preferred_language.
    const title =
      info.status === "expired"
        ? {
            vi: `FDA đã hết hạn: ${label}`,
            en: `FDA registration expired: ${label}`,
          }
        : {
            vi: `Nhắc gia hạn FDA: ${label}`,
            en: `Time to renew your FDA registration`,
          }

    const body =
      info.status === "expired"
        ? {
            vi:
              `Đăng ký FDA của ${label} đã quá hạn ${absDays} ngày. ` +
              `Đây là yêu cầu bắt buộc để tiếp tục xuất khẩu sang thị trường Mỹ — ` +
              `vui lòng gia hạn ngay và cập nhật số đăng ký mới cho đội ngũ Vexim Bridge.`,
            en:
              `${label}'s FDA registration expired ${absDays} days ago. ` +
              `It is mandatory for continued shipments into the US market — ` +
              `please renew it right away and send the updated number to the Vexim Bridge team.`,
          }
        : {
            vi:
              `Đăng ký FDA của ${label} sẽ hết hạn sau ${absDays} ngày. ` +
              `Để tránh gián đoạn các lô hàng đang và sắp triển khai, ` +
              `vui lòng gia hạn với FDA và gửi số đăng ký mới cho đội ngũ Vexim Bridge trước ngày hết hạn.`,
            en:
              `${label}'s FDA registration expires in ${absDays} days. ` +
              `Please renew it with the FDA and share the updated number with the Vexim Bridge ` +
              `team before the expiry date to keep ongoing shipments on schedule.`,
          }

    try {
      await dispatchNotification({
        userId: c.id,
        category: "action_required",
        linkPath: "/client",
        // Changing the rounded days-bucket means a new email is fine; we also
        // have the app-level RENOTIFY_EVERY_DAYS guard above.
        dedupKey: `fda_expiry:${c.fda_expires_at}:${info.status}:${bucketDays(days)}`,
        title,
        body,
        ctaLabel: {
          vi: "Cập nhật đăng ký FDA",
          en: "Update FDA registration",
        },
      })

      // Mark notified so we skip this client for the next RENOTIFY_EVERY_DAYS.
      await admin
        .from("profiles")
        .update({ fda_renewal_notified_at: today.toISOString() })
        .eq("id", c.id)

      results.push({ clientId: c.id, status: "notified" })
    } catch (err) {
      results.push({
        clientId: c.id,
        status: "failed",
        reason: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  const summary = {
    scanned: clients?.length ?? 0,
    notified: results.filter((r) => r.status === "notified").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  }

  return NextResponse.json({ summary, results })
}

/**
 * Collapse days to a coarse bucket (7-day bins) so the dedup key
 * in `notification_email_log` allows a fresh email every ~week as
 * the deadline approaches, instead of the same key forever.
 */
function bucketDays(days: number): number {
  return Math.floor(days / 7) * 7
}
