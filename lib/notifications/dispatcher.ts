import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { getFromAddress, sendMail } from "@/lib/email/mailer"
import { sendTelegramMessage } from "@/lib/telegram/client"
import type {
  NotificationCategory,
  PreferredLanguage,
} from "@/lib/supabase/types"
import { renderNotificationEmail } from "./email-template"

/**
 * Text variants in both locales. The dispatcher picks the right one based on
 * the recipient's `preferred_language` at send time. Callers who only have
 * one locale can pass the same string twice.
 */
export interface LocalizedText {
  vi: string
  en: string
}

export interface DispatchInput {
  /** Who to notify (profiles.id). */
  userId: string
  category: NotificationCategory
  /** Optional opportunity context for deep-linking. */
  opportunityId?: string | null
  /**
   * Path (without origin) the user lands on when they click through from
   * either the in-app notification or the email CTA. Absolute URL is built
   * by the dispatcher using NEXT_PUBLIC_APP_URL.
   */
  linkPath: string
  /**
   * Stable idempotency key for the email delivery. Reusing the same key for
   * the same user guarantees the email is sent at most once, even if the
   * calling server action is retried. Examples:
   *   - `opp_stage_changed:<oppId>:new->contacted`
   *   - `opp_next_step:<oppId>:<hash>`
   */
  dedupKey: string
  title: LocalizedText
  body?: LocalizedText | null
  ctaLabel: LocalizedText
  /** Override the email subject; defaults to the title. */
  subject?: LocalizedText
}

/**
 * Map each category to the boolean column on `notification_preferences` that
 * controls whether an email of that category should be sent.
 *
 * `system` is intentionally absent — it is not user-configurable at the
 * category level and follows only the master `email_enabled` switch.
 */
type EmailCategoryColumn =
  | "email_action_required"
  | "email_status_update"
  | "email_deal_closed"
  | "email_new_assignment"

const CATEGORY_PREF_COLUMN: Record<
  Exclude<NotificationCategory, "system">,
  EmailCategoryColumn
> = {
  action_required: "email_action_required",
  status_update: "email_status_update",
  deal_closed: "email_deal_closed",
  new_assignment: "email_new_assignment",
}

/**
 * Same idea as CATEGORY_PREF_COLUMN but for the Telegram channel. Kept as a
 * separate map (rather than deriving from the email one) so the two channels
 * can diverge in the future without a breaking rename.
 */
type TelegramCategoryColumn =
  | "telegram_action_required"
  | "telegram_status_update"
  | "telegram_deal_closed"
  | "telegram_new_assignment"

const TELEGRAM_CATEGORY_PREF_COLUMN: Record<
  Exclude<NotificationCategory, "system">,
  TelegramCategoryColumn
> = {
  action_required: "telegram_action_required",
  status_update: "telegram_status_update",
  deal_closed: "telegram_deal_closed",
  new_assignment: "telegram_new_assignment",
}

/** Telegram HTML parse mode only supports a small tag subset — escape the rest. */
function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Resolve the absolute app URL, falling back to Vercel's VERCEL_URL in
 * deploy-preview environments. Used for both the CTA and the unsubscribe link.
 */
function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/+$/, "")
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return "http://localhost:3000"
}

/**
 * Send a notification: always creates the in-app row, and conditionally sends
 * an email depending on the user's preferences. Never throws — failures are
 * logged and swallowed so the caller's action is not blocked.
 */
export async function dispatchNotification(input: DispatchInput): Promise<void> {
  // Defensive: ensure required fields are present
  if (!input.title || !input.ctaLabel) {
    console.error("[notifications] missing required fields (title or ctaLabel)", input)
    return
  }

  const admin = createAdminClient()

  // Look up recipient + prefs in a single round-trip.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, email, full_name, preferred_language")
    .eq("id", input.userId)
    .single()

  if (profileErr || !profile) {
    console.error("[notifications] missing profile", input.userId, profileErr?.message)
    return
  }

  const locale: PreferredLanguage = profile.preferred_language ?? "vi"

  const title = input.title[locale] ?? input.title.en
  const body = input.body ? (input.body[locale] ?? input.body.en) : null
  const ctaLabel = input.ctaLabel[locale] ?? input.ctaLabel.en
  const subject = (input.subject?.[locale] ?? input.subject?.en ?? title).slice(0, 200)

  // 1) In-app notification (always written)
  const { error: notifErr } = await admin.from("notifications").insert({
    user_id: input.userId,
    category: input.category,
    title,
    body,
    link_path: input.linkPath,
    opportunity_id: input.opportunityId ?? null,
  })
  if (notifErr) {
    console.error("[notifications] insert failed", notifErr.message)
    // Continue — we still attempt the email so the user is not silent-dropped.
  }

  // 2) Fetch prefs once, fan out to both channels independently. Neither
  // channel's early-exit should block the other, so each runs in its own
  // guarded block rather than sharing return statements.
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", input.userId)
    .single()

  if (!prefs) {
    // Trigger should have created this row; if it is missing something is off
    // but we don't want to spam emails/messages either.
    console.warn("[notifications] no prefs row for", input.userId)
    return
  }

  await Promise.all([
    sendEmailChannel({ admin, input, profile, prefs, locale, title, body, ctaLabel, subject }),
    sendTelegramChannel({ admin, input, prefs, locale, title, body, ctaLabel }),
  ])
}

interface ChannelContext {
  admin: ReturnType<typeof createAdminClient>
  input: DispatchInput
  prefs: Record<string, unknown>
  locale: PreferredLanguage
  title: string
  body: string | null
  ctaLabel: string
}

async function sendEmailChannel(
  ctx: ChannelContext & {
    profile: { email: string | null; full_name: string | null }
    subject: string
  },
): Promise<void> {
  const { admin, input, profile, prefs, locale, title, body, ctaLabel, subject } = ctx

  if (!prefs.email_enabled) return

  // `system` follows master switch only; otherwise honor the per-category toggle.
  if (input.category !== "system") {
    const column = CATEGORY_PREF_COLUMN[input.category]
    if (prefs[column] === false) return
  }

  if (!profile.email) return

  // Idempotency: insert a "sent" marker first. If (user_id, dedup_key) already
  // exists we skip — this is what guarantees at-most-once delivery.
  const { error: logErr } = await admin
    .from("notification_email_log")
    .insert({
      user_id: input.userId,
      dedup_key: input.dedupKey,
      status: "sent",
    })

  if (logErr) {
    // Unique-violation (code 23505) means we've already sent this one. Good.
    if ((logErr as { code?: string }).code === "23505") return
    console.error("[notifications] log insert failed", logErr.message)
    return
  }

  const appUrl = getAppBaseUrl()
  const ctaUrl = `${appUrl}${input.linkPath.startsWith("/") ? "" : "/"}${input.linkPath}`
  const unsubscribeUrl = `${appUrl}/unsubscribe/${prefs.unsubscribe_token}`

  const { html, text } = renderNotificationEmail({
    locale,
    category: input.category,
    recipientName: profile.full_name ?? null,
    title,
    body,
    ctaLabel,
    ctaUrl,
    unsubscribeUrl,
  })

  try {
    const res = await sendMail({
      from: getFromAddress(),
      to: profile.email,
      subject,
      html,
      text,
      headers: {
        // RFC 8058: one-click unsubscribe. Most ESPs surface this button.
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })

    if (res.error) {
      await admin
        .from("notification_email_log")
        .update({ status: "failed", error: res.error.message })
        .eq("user_id", input.userId)
        .eq("dedup_key", input.dedupKey)
      console.error("[notifications] smtp rejected", res.error.message)
      return
    }

    await admin
      .from("notification_email_log")
      .update({ provider_id: res.data?.id ?? null })
      .eq("user_id", input.userId)
      .eq("dedup_key", input.dedupKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin
      .from("notification_email_log")
      .update({ status: "failed", error: message })
      .eq("user_id", input.userId)
      .eq("dedup_key", input.dedupKey)
    console.error("[notifications] smtp threw", message)
  }
}

async function sendTelegramChannel(ctx: ChannelContext): Promise<void> {
  const { admin, input, prefs, title, body, ctaLabel } = ctx

  if (!prefs.telegram_enabled) return
  if (!prefs.telegram_chat_id) return

  // `system` follows master switch only; otherwise honor the per-category toggle.
  if (input.category !== "system") {
    const column = TELEGRAM_CATEGORY_PREF_COLUMN[input.category]
    if (prefs[column] === false) return
  }

  // Idempotency: same pattern as the email log — insert first, skip on conflict.
  const { error: logErr } = await admin
    .from("notification_telegram_log")
    .insert({
      user_id: input.userId,
      dedup_key: input.dedupKey,
      status: "sent",
    })

  if (logErr) {
    if ((logErr as { code?: string }).code === "23505") return
    console.error("[notifications] telegram log insert failed", logErr.message)
    return
  }

  const appUrl = getAppBaseUrl()
  const ctaUrl = `${appUrl}${input.linkPath.startsWith("/") ? "" : "/"}${input.linkPath}`

  const lines = [
    `<b>${escapeTelegramHtml(title)}</b>`,
    body ? escapeTelegramHtml(body) : null,
    `<a href="${ctaUrl}">${escapeTelegramHtml(ctaLabel)}</a>`,
  ].filter(Boolean)

  const result = await sendTelegramMessage(prefs.telegram_chat_id as string, lines.join("\n\n"))

  if (!result.ok) {
    await admin
      .from("notification_telegram_log")
      .update({ status: "failed", error: result.error })
      .eq("user_id", input.userId)
      .eq("dedup_key", input.dedupKey)
    console.error("[notifications] telegram send failed", result.error)
    return
  }

  await admin
    .from("notification_telegram_log")
    .update({ message_id: result.messageId ?? null })
    .eq("user_id", input.userId)
    .eq("dedup_key", input.dedupKey)
}
