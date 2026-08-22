import { NextResponse } from "next/server"
import { setTelegramWebhook } from "@/lib/telegram/client"

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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`).replace(
    /\/+$/,
    "",
  )
  const webhookUrl = `${appUrl}/api/telegram/webhook`

  const result = await setTelegramWebhook(webhookUrl, cronSecret)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, webhookUrl })
}
