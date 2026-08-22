import "server-only"

/**
 * Thin wrapper around the Telegram Bot API. No SDK needed — it's a plain
 * HTTPS JSON API keyed by the bot token from @BotFather.
 *
 * Docs: https://core.telegram.org/bots/api
 */

const TELEGRAM_API_BASE = "https://api.telegram.org"

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN env var")
  }
  return token
}

export interface SendTelegramMessageResult {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * Send a message to a chat. `chatId` is the numeric Telegram chat id captured
 * when the user linked their account (see app/api/telegram/webhook/route.ts).
 *
 * Uses HTML parse mode so callers can bold/italicize with simple tags.
 * Telegram messages are capped at 4096 UTF-16 code units; we truncate
 * defensively so a long body never causes a hard API failure.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: { disableLinkPreview?: boolean },
): Promise<SendTelegramMessageResult> {
  const token = getBotToken()
  const truncated = text.length > 4000 ? `${text.slice(0, 3990)}…` : text

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: truncated,
        parse_mode: "HTML",
        disable_web_page_preview: options?.disableLinkPreview ?? true,
      }),
    })

    const json = await res.json()

    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json?.description ?? `Telegram API returned ${res.status}`,
      }
    }

    return { ok: true, messageId: String(json.result?.message_id ?? "") }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Registers (or re-registers) the webhook URL with Telegram so incoming
 * messages (e.g. `/start <token>`) are POSTed to our API route.
 *
 * This is a one-time setup call — not invoked on every request. Run it via
 * a script or an admin action after deploying, whenever the public URL
 * changes (e.g. first deploy, custom domain change).
 */
export async function setTelegramWebhook(
  webhookUrl: string,
  secretToken: string,
): Promise<SendTelegramMessageResult> {
  const token = getBotToken()

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message"],
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      return { ok: false, error: json?.description ?? `Telegram API returned ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
