import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/client"

// Telegram webhooks are plain HTTP POST — no long-running work, no DB reads
// that benefit from caching.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TelegramUpdate {
  message?: {
    chat: { id: number; username?: string }
    text?: string
  }
}

/**
 * Handles incoming Telegram updates.
 *
 * Currently supports a single command: `/start <link_token>`, sent when a
 * user taps the deep link from Settings (t.me/<bot>?start=<token>). We
 * resolve the token to a `notification_preferences` row and store the
 * resulting chat_id, which is all we need to push future notifications.
 *
 * Auth: Telegram calls this with a `X-Telegram-Bot-Api-Secret-Token` header
 * that must match what we registered via setWebhook (see lib/telegram/client.ts).
 * We reuse CRON_SECRET as that shared secret to avoid provisioning a new env var.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[telegram-webhook] CRON_SECRET not configured")
    return NextResponse.json({ ok: true }) // Always 200 so Telegram doesn't retry-storm.
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token")
  if (secretHeader !== cronSecret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = update.message
  const text = message?.text?.trim()
  const chatId = message?.chat?.id
  if (!text || !chatId) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()

  if (text.startsWith("/start")) {
    const token = text.slice("/start".length).trim()

    if (!token) {
      await sendTelegramMessage(
        String(chatId),
        "Chào bạn! Vui lòng mở Vexim Trade → Cài đặt → Thông báo và bấm nút \"Liên kết Telegram\" để lấy liên kết đúng.",
      )
      return NextResponse.json({ ok: true })
    }

    // Look up the pending link by token. Tokens don't expire by default
    // (link_token_expires_at is optional), but we honor it if set.
    const { data: pref, error: findErr } = await admin
      .from("notification_preferences")
      .select("user_id, telegram_link_token_expires_at")
      .eq("telegram_link_token", token)
      .maybeSingle()

    if (findErr || !pref) {
      await sendTelegramMessage(
        String(chatId),
        "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng lấy liên kết mới trong Cài đặt.",
      )
      return NextResponse.json({ ok: true })
    }

    if (
      pref.telegram_link_token_expires_at &&
      new Date(pref.telegram_link_token_expires_at) < new Date()
    ) {
      await sendTelegramMessage(
        String(chatId),
        "Liên kết đã hết hạn. Vui lòng lấy liên kết mới trong Cài đặt.",
      )
      return NextResponse.json({ ok: true })
    }

    const { error: updateErr } = await admin
      .from("notification_preferences")
      .update({
        telegram_chat_id: String(chatId),
        telegram_username: message?.chat?.username ?? null,
        telegram_enabled: true,
        // Rotate the token so it can't be replayed by someone else.
        telegram_link_token: crypto.randomUUID(),
        telegram_link_token_expires_at: null,
      })
      .eq("user_id", pref.user_id)

    if (updateErr) {
      console.error("[telegram-webhook] failed to link chat", updateErr.message)
      await sendTelegramMessage(
        String(chatId),
        "Có lỗi xảy ra khi liên kết. Vui lòng thử lại sau.",
      )
      return NextResponse.json({ ok: true })
    }

    await sendTelegramMessage(
      String(chatId),
      "✅ Đã liên kết thành công! Từ giờ bạn sẽ nhận thông báo tức thời từ Vexim Trade ngay tại đây.",
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/stop")) {
    await admin
      .from("notification_preferences")
      .update({ telegram_enabled: false })
      .eq("telegram_chat_id", String(chatId))

    await sendTelegramMessage(
      String(chatId),
      "Đã tắt thông báo Telegram. Bạn có thể bật lại trong Cài đặt bất cứ lúc nào.",
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
