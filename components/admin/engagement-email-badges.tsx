"use client"

import { useEffect, useState } from "react"

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
  introduction: { vi: "Email chào hàng", en: "Introduction" },
  follow_up: { vi: "Follow-up", en: "Follow-up" },
  shortlist_delivery: { vi: "Gửi shortlist", en: "Shortlist delivery" },
  quotation: { vi: "Báo giá", en: "Quotation" },
  sample_offer: { vi: "Chào mẫu", en: "Sample offer" },
  negotiation: { vi: "Đàm phán", en: "Negotiation" },
  custom: { vi: "Email tùy chỉnh", en: "Custom email" },
}

function typeLabel(emailType: string, locale: "vi" | "en"): string {
  return EMAIL_TYPE_LABELS[emailType]?.[locale] ?? "Email"
}

/**
 * Delivery state of the emails sent for one engagement: sent / delivered /
 * bounced / complained, plus open and click counts.
 *
 * Moved here from app/admin/ae-inbox/ (it was rendered by the engagement card)
 * so the buyer's page can keep showing it after the inbox became a worklist.
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

  // Only surface emails that actually went out (or failed on send).
  const visible = (drafts ?? []).filter((d) => d.status === "sent" || d.status === "failed")
  if (!drafts || visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50/60 p-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {locale === "vi" ? "Trạng thái email" : "Email delivery"}
      </span>
      {visible.slice(0, 4).map((draft) => {
        const blocked = draft.delivery_status === "bounced" || draft.delivery_status === "complained"
        return (
          <div key={draft.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-medium text-zinc-700">{typeLabel(draft.email_type, locale)}</span>
            <DeliveryStatusBadge status={draft.delivery_status} sendStatus={draft.status} locale={locale} />
            {!blocked && <OpenSignalChip count={draft.opened_count} locale={locale} />}
            {!blocked && <ClickSignalChip count={draft.clicked_count} locale={locale} />}
          </div>
        )
      })}
    </div>
  )
}
