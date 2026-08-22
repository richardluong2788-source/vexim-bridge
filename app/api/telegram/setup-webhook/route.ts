import { NextResponse } from "next/server"
import { getTelegramWebhookInfo, setTelegramWebhook } from "@/lib/telegram/client"
import { siteConfig } from "@/lib/site-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * One-time (or rerun-when-domain-changes) endpoint that registers our
 * webhook URL with Telegram. Not called by the app itself — visit it once
 * after deploying, or whenever the production domain changes.
 *
 * Auth: same CRON_SECRET Bearer token used by other admin/cron endpoints.
 *
 * Usage:
 *   curl -X POST "https://<your-domain>/api/telegram/setup-webhook" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // NEXT_PUBLIC_APP_URL isn't set in this project — reuse the same base URL
  // resolution the rest of the app uses (NEXT_PUBLIC_SITE_URL, then Vercel's
  // runtime URL, then localhost) so this never resolves to
  // "https://undefined" again.
  const appUrl = siteConfig.url.replace(/\/+$/, "")
  const webhookUrl = `${appUrl}/api/telegram/webhook`

  const result = await setTelegramWebhook(webhookUrl, cronSecret)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, webhookUrl })
}

/**
 * Diagnostic: reports what Telegram currently has on file for our webhook —
 * the URL, pending update count, and the last delivery error. Use this to
 * check *why* `/start` isn't getting a reply before re-running POST.
 *
 * Usage:
 *   curl "https://<your-domain>/api/telegram/setup-webhook" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await getTelegramWebhookInfo()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expectedUrl: `${siteConfig.url.replace(/\/+$/, "")}/api/telegram/webhook`, ...result.info })
}
