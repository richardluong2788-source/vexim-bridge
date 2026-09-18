"use client"

import { useEffect, useState } from "react"
import { Mail, Loader2 } from "lucide-react"

import {
  ClickSignalChip,
  DeliveryStatusBadge,
  OpenSignalChip,
} from "@/components/admin/email-delivery-badge"
import {
  fetchEngagementEmailDraftsAction,
  type EngagementEmailDraftRow,
} from "@/app/admin/ae-inbox/requirement-email-actions"

const EMAIL_TYPE_LABELS: Record<string, { vi: string; en: string }> = {
  requirement_inquiry: { vi: "Email hỏi nhu cầu", en: "Requirement outreach" },
  requirement_followup: { vi: "Email follow-up", en: "Follow-up email" },
  introduction: { vi: "Email chào hàng", en: "Introduction" },
  follow_up: { vi: "Follow-up", en: "Follow-up" },
  shortlist_delivery: { vi: "Gửi shortlist", en: "Shortlist delivery" },
  quotation: { vi: "Báo giá", en: "Quotation" },
  sample_offer: { vi: "Chào mẫu", en: "Sample offer" },
  negotiation: { vi: "Đàm phán", en: "Negotiation" },
  custom: { vi: "Email tùy chỉnh", en: "Custom email" },
}

function typeLabel(emailType: string, locale: "vi" | "en"): string {
  return EMAIL_TYPE_LABELS[emailType]?.[locale] ?? emailType
}

/**
 * Delivery state of the emails sent for one engagement: sent / delivered /
 * bounced / complained, plus open and click counts.
 *
 * Moved here from app/admin/ae-inbox/ (it was rendered by the engagement card)
 * so the buyer's page can keep showing it after the inbox became a worklist.
 *
 * FIX: Previously hidden inside collapsed "Trạng thái xử lý" panel, so AE
 * never saw it unless expanded. Now rendered at top level in
 * EngagementStatePanel and always visible.
 */
export function EngagementEmailDeliveryBadges({
  engagementId,
  locale = "vi",
}: {
  engagementId: string
  locale?: "vi" | "en"
}) {
  const [drafts, setDrafts] = useState<EngagementEmailDraftRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchEngagementEmailDraftsAction(engagementId)
      .then((res) => {
        if (cancelled) return
        setDrafts(res.ok ? res.drafts : [])
      })
      .catch(() => {
        if (!cancelled) setDrafts([])
      })
    return () => {
      cancelled = true
    }
  }, [engagementId])

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  // Loading state
  if (drafts === null) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("Đang tải trạng thái email...", "Loading email status...")}
      </div>
    )
  }

  // Only surface emails that actually went out (or failed on send).
  const visible = drafts.filter((d) => d.status === "sent" || d.status === "failed")

  if (visible.length === 0) {
    // Show placeholder so AE knows tracking is active, just no email sent yet
    return (
      <div className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/30 p-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          {t("Trạng thái email", "Email delivery")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t(
            "Chưa gửi email nào cho buyer này — trạng thái gửi/mở/click sẽ hiện ở đây sau khi gửi.",
            "No email sent to this buyer yet — delivery/open/click status will appear here after sending.",
          )}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-sm">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        {t("Trạng thái email", "Email delivery")}
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono">
          {visible.length}
        </span>
      </span>
      {visible.slice(0, 4).map((draft) => {
        const blocked = draft.delivery_status === "bounced" || draft.delivery_status === "complained"
        const sentAt = draft.sent_at ? new Date(draft.sent_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null
        return (
          <div key={draft.id} className="flex flex-col gap-1 rounded-md border border-zinc-200/60 bg-zinc-50/60 p-2.5 dark:bg-zinc-900/30">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-medium text-foreground">{typeLabel(draft.email_type, locale)}</span>
              {sentAt && <span className="text-[11px] text-muted-foreground">· {sentAt}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryStatusBadge status={draft.delivery_status} sendStatus={draft.status} locale={locale} />
              {!blocked && <OpenSignalChip count={draft.opened_count} locale={locale} />}
              {!blocked && <ClickSignalChip count={draft.clicked_count} locale={locale} />}
            </div>
            {draft.recipient_email && (
              <span className="text-[11px] text-muted-foreground truncate">
                {t("Tới", "To")}: {draft.recipient_email}
              </span>
            )}
          </div>
        )
      })}
      {visible.length > 4 && (
        <span className="text-[11px] text-muted-foreground">
          {t(`+${visible.length - 4} email khác`, `+${visible.length - 4} more emails`)}
        </span>
      )}
    </div>
  )
}
