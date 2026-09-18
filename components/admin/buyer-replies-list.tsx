"use client"

/**
 * Buyer replies list — one renderer for the two places a reply has to be
 * visible:
 *
 *   - the "Phản hồi" tab on the buyer profile (full list), and
 *   - the top of the "Phân tích" tab, right under the action bar, limited to
 *     the newest few — the AE composed the opening email in that tab, so the
 *     answer should land there too instead of only in the inbox.
 *
 * Replies reach here from the Resend inbound webhook
 * (app/api/webhooks/resend/route.ts), which files each one against EITHER an
 * opportunity (client/supplier already picked) OR the pre-opportunity
 * engagement — so a row may have an `engagementId` and no `opportunityId`.
 * The action button and the "client" label both have to handle that case.
 */

import Link from "next/link"
import { ExternalLink, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { engagementFocusPath } from "@/lib/notifications/paths"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export interface BuyerReplyRow {
  id: string
  /** Null for replies that arrived before a client/supplier was picked. */
  opportunityId: string | null
  /** The pre-opportunity engagement this reply belongs to, when there is one. */
  engagementId?: string | null
  /**
   * Client the reply is about — null while the buyer is still in the
   * "Đang xử lý" stage, because no client has been assigned yet.
   */
  clientName: string | null
  receivedAt: string
  intent: string | null
  summary: string | null
  confidence: number | null
  translatedVi: string | null
  rawContent: string | null
  /** Null = not read by the AE yet. */
  readAt?: string | null
}

export const REPLY_INTENT_LABEL_VI: Record<string, string> = {
  price_request: "Hỏi giá",
  sample_request: "Xin mẫu",
  objection: "Phản đối",
  closing_signal: "Tín hiệu chốt",
  general: "Chung",
}

export const REPLY_INTENT_LABEL_EN: Record<string, string> = {
  price_request: "Price request",
  sample_request: "Sample request",
  objection: "Objection",
  closing_signal: "Closing signal",
  general: "General",
}

/** Replies the AE has not opened yet. */
export function countUnreadReplies(replies: BuyerReplyRow[]): number {
  return replies.filter((r) => !r.readAt).length
}

export function BuyerRepliesList({
  replies,
  locale,
  /** Show only the newest N (the "Phân tích" tab shows a few; the tab shows all). */
  limit,
  /** Rendered when there are no replies. Omit to render nothing at all. */
  emptyState,
  /** Heading row with the total + unread count. Off for embedded lists. */
  heading = false,
}: {
  replies: BuyerReplyRow[]
  locale: "vi" | "en"
  limit?: number
  emptyState?: React.ReactNode
  heading?: boolean
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const INTENT = locale === "vi" ? REPLY_INTENT_LABEL_VI : REPLY_INTENT_LABEL_EN
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  if (replies.length === 0) {
    return <>{emptyState ?? null}</>
  }

  const shown = limit ? replies.slice(0, limit) : replies
  const unread = countUnreadReplies(replies)

  return (
    <div className="flex flex-col gap-3">
      {heading && (
        <div className="flex flex-wrap items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t(`Phản hồi từ buyer (${replies.length})`, `Buyer replies (${replies.length})`)}
          </span>
          {unread > 0 && (
            <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/10 font-normal text-amber-700 dark:text-amber-400">
              {t(`${unread} chưa đọc`, `${unread} unread`)}
            </Badge>
          )}
        </div>
      )}

      {shown.map((r) => (
        <Card
          key={r.id}
          className={r.readAt ? "border-border" : "border-amber-500/40 bg-amber-500/5"}
        >
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {r.intent ? (
                  <Badge variant="secondary" className="font-normal">
                    {INTENT[r.intent] ?? r.intent}
                  </Badge>
                ) : null}
                {r.clientName ? (
                  <span className="text-xs text-muted-foreground">
                    {t("cho", "for")}{" "}
                    <span className="font-medium text-foreground">{r.clientName}</span>
                  </span>
                ) : (
                  /* No client yet — this reply arrived while the AE was still
                     gathering requirements. Saying "for —" read like a bug. */
                  <span className="text-xs text-muted-foreground">
                    {t("trước khi gán client", "before a client was assigned")}
                  </span>
                )}
                {typeof r.confidence === "number" ? (
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(r.confidence * 100)}%
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(r.receivedAt).toLocaleString(dateLocale, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {r.summary ? (
              <p className="text-pretty text-sm text-foreground">{r.summary}</p>
            ) : null}
            {r.translatedVi && locale === "vi" ? (
              <p className="text-pretty text-xs italic text-muted-foreground">{r.translatedVi}</p>
            ) : null}

            <div className="flex justify-end">
              {r.opportunityId ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/pipeline?oppId=${r.opportunityId}`}>
                    {t("Mở cơ hội", "Open deal")}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              ) : r.engagementId ? (
                /* Pre-opportunity: the deal does not exist yet, so send the AE
                   to the engagement card this reply belongs to. */
                <Button asChild variant="ghost" size="sm">
                  <Link href={engagementFocusPath(r.engagementId)}>
                    {t("Mở trong Đang xử lý", "Open in In progress")}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}

      {limit && replies.length > limit ? (
        <p className="text-xs text-muted-foreground">
          {t(
            `Còn ${replies.length - limit} phản hồi nữa ở tab "Phản hồi".`,
            `${replies.length - limit} more in the "Replies" tab.`,
          )}
        </p>
      ) : null}
    </div>
  )
}
