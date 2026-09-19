"use client"

/**
 * "Trạng thái xử lý" — what the engagement card in the inbox used to show.
 *
 * The inbox card carried the working state of a pre-opportunity buyer: the
 * requirements the AE recorded, what was emailed and whether it arrived, which
 * suppliers went out on the shortlist and what the buyer did with each. The
 * inbox is a worklist now, so that state moved here — onto the buyer's page,
 * next to the buttons that change it.
 *
 * FIX: Email tracking was hidden inside a collapsed panel (default closed),
 * so AE never saw delivery status (bounced/delivered/opened) unless they
 * expanded "Trạng thái xử lý". Now delivery badges are always visible at
 * top level, and the panel defaults to open when there is meaningful data.
 */

import { useState } from "react"
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Link2,
  Mail,
  MessageSquareText,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { EngagementEmailDeliveryBadges } from "@/components/admin/engagement-email-badges"
import { formatDwell, BUYER_ACTION_LABELS, CONTACT_CHANNEL_LABELS } from "@/lib/buyers/engagement-labels"
import type { Engagement } from "@/lib/buyers/engagement-types"

export function EngagementStatePanel({
  engagement,
  locale,
}: {
  engagement: Engagement
  locale: "vi" | "en"
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const versions = [...(engagement.buyer_engagement_shortlist_versions ?? [])].sort(
    (a, b) => b.version_number - a.version_number,
  )
  const sentVersion = versions.find((v) => v.status === "sent")
  const draftVersion = versions.find((v) => v.status === "draft")
  const displayVersion = sentVersion ?? draftVersion ?? null
  const shortlist = displayVersion
    ? [...displayVersion.buyer_engagement_shortlist_items].sort((a, b) => a.position - b.position)
    : []
  const interested = shortlist.filter((i) => i.buyer_interested === true).length
  const shareLink = sentVersion
    ? engagement.shortlist_share_links.find((l) => l.version_id === sentVersion.id) ?? null
    : null

  const hasRequirements = !!(
    engagement.requested_products ||
    engagement.target_price_range ||
    engagement.moq ||
    engagement.payment_terms ||
    engagement.packaging_requirements ||
    engagement.other_requirements
  )

  const replyCount = (engagement.buyer_replies ?? []).length

  // Open by default when there is meaningful working state to show
  const shouldDefaultOpen = hasRequirements || !!displayVersion || replyCount > 0
  const [open, setOpen] = useState(shouldDefaultOpen)

  const summaryLine = [
    hasRequirements ? t("đã có nhu cầu", "requirements on file") : t("chưa ghi nhu cầu", "no requirements yet"),
    displayVersion
      ? `${t("shortlist", "shortlist")} v${displayVersion.version_number} · ${shortlist.length} ${t("NCC", "suppliers")}`
      : t("chưa có shortlist", "no shortlist"),
    engagement.contact_channel
      ? CONTACT_CHANNEL_LABELS[engagement.contact_channel]?.[locale] ?? engagement.contact_channel
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-col gap-3">
      {/* Email tracking is now ALWAYS visible, not hidden inside collapsed panel */}
      <EngagementEmailDeliveryBadges engagementId={engagement.id} locale={locale} />

      <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40"
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
            <span className="text-sm font-medium text-foreground">
              {t("Trạng thái xử lý", "Working state")}
            </span>
            <span className="truncate text-xs text-muted-foreground">{summaryLine}</span>
            {replyCount > 0 && (
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {replyCount} {t("phản hồi", "replies")}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
          {hasRequirements && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Nhu cầu đã ghi nhận", "Recorded requirements")}
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {engagement.requested_products && (
                  <StateField label={t("Sản phẩm", "Products")} value={engagement.requested_products} />
                )}
                {engagement.target_price_range && (
                  <StateField label={t("Giá mục tiêu", "Target price")} value={engagement.target_price_range} />
                )}
                {engagement.moq && <StateField label={t("MOQ", "MOQ")} value={engagement.moq} />}
                {engagement.payment_terms && (
                  <StateField label={t("Thanh toán", "Payment")} value={engagement.payment_terms} />
                )}
                {engagement.packaging_requirements && (
                  <StateField label={t("Đóng gói", "Packaging")} value={engagement.packaging_requirements} />
                )}
                {engagement.other_requirements && (
                  <StateField label={t("Khác", "Other")} value={engagement.other_requirements} />
                )}
              </div>
              {engagement.contact_channel && (
                <p className="text-xs text-muted-foreground">
                  {t("Kênh liên hệ", "Contact channel")}:{" "}
                  {CONTACT_CHANNEL_LABELS[engagement.contact_channel]?.[locale] ??
                    engagement.contact_channel}
                  {engagement.contact_channel_note ? ` — ${engagement.contact_channel_note}` : ""}
                </p>
              )}
            </div>
          )}

          {/* The shortlist: who went out, and what the buyer did with each one.
              This is the evidence behind "bao nhiêu quan tâm" in the convert
              button's label. */}
          {displayVersion ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Shortlist", "Shortlist")} v{displayVersion.version_number}
                </span>
                <Badge variant="outline" className="text-xs">
                  {displayVersion.status === "sent"
                    ? t("đã gửi", "sent")
                    : displayVersion.status === "draft"
                      ? t("bản nháp", "draft")
                      : displayVersion.status}
                </Badge>
                {interested > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {t(`${interested} nhà cung cấp được quan tâm`, `${interested} suppliers of interest`)}
                  </Badge>
                )}
              </div>

              <div className="flex flex-col divide-y rounded-md border">
                {shortlist.map((item) => {
                  const actionLabel = item.buyer_action
                    ? BUYER_ACTION_LABELS[item.buyer_action][locale]
                    : null
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {item.profiles?.company_name ?? item.profiles?.full_name ?? "—"}
                      </span>
                      {item.match_score != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Math.round(item.match_score)}
                        </span>
                      )}
                      {actionLabel && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${item.buyer_interested ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}`}
                        >
                          {actionLabel}
                        </Badge>
                      )}
                      {/* Time on the supplier's card is the quiet signal that
                          beats a click: 40 seconds on one supplier says more
                          than "viewed the shortlist". */}
                      {!!item.total_dwell_ms && item.total_dwell_ms > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                          title={t("Thời gian xem nhà cung cấp này", "Time spent on this supplier")}
                        >
                          <Eye className="h-3 w-3" />
                          {formatDwell(item.total_dwell_ms, locale)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {shareLink && (
                <ShareLinkRow token={shareLink.token} viewCount={shareLink.view_count} locale={locale} />
              )}
              {draftVersion && sentVersion && (
                <p className="text-xs text-muted-foreground">
                  {t(
                    `Còn 1 bản nháp mới hơn (v${draftVersion.version_number}) chưa gửi.`,
                    `A newer draft (v${draftVersion.version_number}) has not been sent yet.`,
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("Chưa có shortlist nào cho buyer này.", "No shortlist for this buyer yet.")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {engagement.contact_channel === "system_email"
                ? t("Đang đi bằng email hệ thống", "Going by in-system email")
                : t("Kênh liên hệ ngoài hệ thống", "Reached outside the system")}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquareText className="h-3 w-3" />
              {t(
                `${replyCount} phản hồi đã nhận`,
                `${replyCount} replies received`,
              )}
            </span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function StateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  )
}

/**
 * The buyer-facing shortlist URL, with a copy button.
 *
 * Kept from the inbox card: the AE regularly has to resend this link through
 * channels the system does not own (WhatsApp, their own mailbox), and without
 * the copy button the only way to the URL is to dig it out of the sent email.
 */
function ShareLinkRow({
  token,
  viewCount,
  locale,
}: {
  token: string
  viewCount: number | null
  locale: "vi" | "en"
}) {
  const [copied, setCopied] = useState(false)
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/shortlist/${token}`
      : `/shortlist/${token}`

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-xs text-muted-foreground">{url}</span>
      {!!viewCount && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {locale === "vi" ? `${viewCount} lượt xem` : `${viewCount} views`}
        </span>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 shrink-0 gap-1 px-2 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          toast.success(locale === "vi" ? "Đã sao chép link shortlist" : "Shortlist link copied")
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {locale === "vi" ? "Sao chép" : "Copy"}
      </Button>
    </div>
  )
}
