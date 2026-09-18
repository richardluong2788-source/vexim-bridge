"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Building2,
  Globe,
  User,
  Mail,
  ClipboardList,
  Sparkles,
  Link2,
  Copy,
  Check,
  Loader2,
  Eye,
  ArrowRight,
  Package,
  MessageSquareText,
  DollarSign,
  AlertTriangle,
  Handshake,
  Reply,
  CornerUpLeft,
  Tag,
  Clock,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  EngagementAdminActions,
  EngagementStageActions,
} from "@/components/admin/engagement-action-bar"
// Stage dialogs (record requirements, shortlist, convert, follow-up) — shared
// with the buyer profile's "Phân tích" tab, so the two surfaces offer the same
// actions instead of the page keeping a second copy.
import {
  EngagementReplyFollowUpDialog,
  EngagementStageDialogHost,
} from "@/components/admin/engagement-stage-dialogs"
import { markEngagementRepliesReadAction } from "@/app/admin/ae-inbox/engagement-actions"
import type { StageActionKey } from "@/lib/buyers/engagement-stages"
import type {
  BuyerActionValue,
  Engagement,
  EngagementClient,
  EngagementReplyRow,
  ShortlistItemRow,
  ShortlistVersionRow,
} from "@/lib/buyers/engagement-types"
// Stage labels + the stage → button map live in one shared module so this card
// and the buyer profile's "Phân tích" tab can never disagree about either.
import { STAGE_LABELS } from "@/lib/buyers/engagement-stages"
import {
  sortEngagementsForWorklist,
  summarizeEngagement,
} from "@/lib/buyers/engagement-summary"
import { EngagementEmailDeliveryBadges } from "./email-delivery-badges"
import type { ClientMatchResult } from "@/lib/matching/client-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Row shapes live in lib/buyers/engagement-types.ts so the shared stage
// dialogs can import them without a cycle back into this file.

interface EngagementListProps {
  engagements: Engagement[]
  clients: EngagementClient[]
  locale: "vi" | "en"
  /** Hide the "Đang xử lý (N)" heading — the inbox tab already says it. */
  showHeader?: boolean
  /**
   * Render the card open from the start. The detail pane of the inbox shows one
   * buyer, so there is nothing gained by making the AE click to reveal them.
   */
  defaultExpanded?: boolean
}

const REPLY_INTENT_META: Record<
  NonNullable<EngagementReplyRow["ai_intent"]>,
  { vi: string; en: string; icon: typeof DollarSign; tone: string }
> = {
  price_request: { vi: "Hỏi giá", en: "Price request", icon: DollarSign, tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  sample_request: { vi: "Yêu cầu mẫu", en: "Sample request", icon: Package, tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  objection: { vi: "Phản đối / lo ngại", en: "Objection", icon: AlertTriangle, tone: "bg-destructive/10 text-destructive border-destructive/30" },
  closing_signal: { vi: "Có dấu hiệu chốt đơn", en: "Closing signal", icon: Handshake, tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  general: { vi: "Chung", en: "General", icon: MessageSquareText, tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
}

const CONTACT_CHANNEL_LABELS: Record<string, { vi: string; en: string }> = {
  system_email: { vi: "Email trong hệ thống", en: "In-system email" },
  linkedin: { vi: "LinkedIn", en: "LinkedIn" },
  whatsapp: { vi: "WhatsApp", en: "WhatsApp" },
  phone: { vi: "Điện thoại", en: "Phone" },
  other: { vi: "Khác", en: "Other" },
}

const BUYER_ACTION_LABELS: Record<BuyerActionValue, { vi: string; en: string }> = {
  viewed_only: { vi: "Chỉ xem", en: "Viewed only" },
  interested_no_details: { vi: "Quan tâm (chưa chi tiết)", en: "Interested (no details)" },
  requested_info: { vi: "Hỏi thêm thông tin", en: "Requested info" },
  requested_sample: { vi: "Yêu cầu mẫu", en: "Requested sample" },
  requested_meeting: { vi: "Yêu cầu họp", en: "Requested meeting" },
  requested_order_discussion: { vi: "Muốn thảo luận đặt hàng", en: "Wants to discuss an order" },
  selected_primary: { vi: "Chọn làm supplier chính", en: "Selected as primary" },
  sent_price_volume: { vi: "Gửi giá & số lượng", en: "Sent price & volume" },
  sent_po: { vi: "Đã gửi PO", en: "Sent PO" },
}

function formatDwell(ms: number, locale: "vi" | "en"): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return locale === "vi" ? `${totalSeconds} giây` : `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return locale === "vi" ? `${minutes} phút ${seconds}s` : `${minutes}m ${seconds}s`
}

function formatRelativeTime(dateStr: string, locale: "vi" | "en"): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return locale === "vi" ? "vừa xong" : "just now"
  if (minutes < 60) return locale === "vi" ? `${minutes} phút trước` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === "vi" ? `${hours} giờ trước` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return locale === "vi" ? `${days} ngày trước` : `${days}d ago`
}

export function EngagementList({
  engagements,
  clients,
  locale,
  showHeader = true,
  defaultExpanded = false,
}: EngagementListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  // Which stage action is open, and for which buyer. One slot instead of seven:
  // the dialog bodies now live in components/admin/engagement-stage-dialogs.tsx
  // and are shared with the buyer profile, so this file only records intent.
  const [stageDialog, setStageDialog] = useState<{ engagement: Engagement; action: StageActionKey } | null>(
    null,
  )
  const [replyDialogFor, setReplyDialogFor] = useState<{ engagement: Engagement; reply: EngagementReplyRow } | null>(
    null,
  )
  const [markingReadFor, setMarkingReadFor] = useState<string | null>(null)

  // Which cards have their full details (buyer replies, requirements,
  // shortlist, stage actions) expanded. Each card is a per-buyer accordion:
  // collapsed by default so a long list of buyers stays scannable, and
  // expands on click instead of always rendering every reply thread inline
  // (which otherwise makes the DOM grow unbounded as buyers reply more).
  // Buyers with an unread reply start expanded so nothing new gets missed.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () =>
      new Set(
        engagements
          .filter(
            (e) =>
              defaultExpanded || (e.buyer_replies ?? []).some((r) => !r.read_at),
          )
          .map((e) => e.id),
      ),
  )

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Deep link from a "buyer replied" notification — the inbox carries
  // ?tab=work&focus=<id>, and the notification path helper builds it.
  const focusId = searchParams.get("focus")

  useEffect(() => {
    if (!focusId) return
    setExpandedIds((prev) => (prev.has(focusId) ? prev : new Set(prev).add(focusId)))
    const el = document.getElementById(`engagement-${focusId}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [focusId])

  function handleMarkRepliesRead(engagementId: string) {
    setMarkingReadFor(engagementId)
    startTransition(async () => {
      await markEngagementRepliesReadAction(engagementId)
      router.refresh()
      setMarkingReadFor(null)
    })
  }

  if (engagements.length === 0) return null

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  // A buyer who wrote to us and has not been read is the top of the queue —
  // the page hands us rows by recency, which buries a reply under whatever was
  // touched last. See sortEngagementsForWorklist.
  const ordered = sortEngagementsForWorklist(engagements)

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("Đang xử lý", "In progress")}
          </h2>
          <Badge variant="outline" className="text-xs">
            {engagements.length}
          </Badge>
        </div>
      )}

      <div className="grid gap-4">
        {ordered.map((eng) => {
          const lead = eng.leads
          const stageInfo = STAGE_LABELS[eng.stage] ?? STAGE_LABELS.claimed
          const versions = [...eng.buyer_engagement_shortlist_versions].sort(
            (a, b) => b.version_number - a.version_number,
          )
          const sentVersion = versions.find((v) => v.status === "sent") ?? null
          const draftVersion = versions.find((v) => v.status === "draft") ?? null
          // Prefer showing the sent (live, immutable) version to reflect
          // what the buyer actually saw; fall back to the newest draft
          // while nothing has been sent yet.
          const displayVersion = sentVersion ?? draftVersion ?? versions[0] ?? null
          const shortlist = displayVersion
            ? [...displayVersion.buyer_engagement_shortlist_items].sort((a, b) => a.position - b.position)
            : []
          const shareLink = sentVersion
            ? eng.shortlist_share_links.find((l) => l.version_id === sentVersion.id) ?? null
            : null

          // Which option is winning the buyer's attention, based on
          // dwell-time on the public shortlist page — useful even when
          // the buyer never clicks an action button.
          const topDwell = shortlist.reduce<{ id: string; ms: number } | null>((best, s) => {
            const ms = s.total_dwell_ms ?? 0
            if (ms <= 0) return best
            return !best || ms > best.ms ? { id: s.id, ms } : best
          }, null)
          const lastDwellAt = shortlist.reduce<string | null>((latest, s) => {
            if (!s.last_dwell_at) return latest
            if (!latest || new Date(s.last_dwell_at).getTime() > new Date(latest).getTime()) return s.last_dwell_at
            return latest
          }, null)

          // Headline facts (stage, days in stage, replies, silent warning) come
          // from the shared summary so the worklist row and this card can never
          // disagree — see lib/buyers/engagement-summary.ts.
          const summary = summarizeEngagement(eng)
          const {
            replies,
            unreadReplies,
            silentDays,
            isSilentTooLong,
            daysInStage,
            productLabel,
            hsCodes,
          } = summary

          const isExpanded = expandedIds.has(eng.id)

          return (
            <Card
              key={eng.id}
              id={`engagement-${eng.id}`}
              className={cn(
                pending && "opacity-50 pointer-events-none",
                focusId === eng.id && "ring-2 ring-primary",
              )}
            >
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(eng.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex flex-col gap-1 min-w-0 flex-1 text-left appearance-none bg-transparent border-none p-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                      <h3 className="font-semibold text-lg">{lead?.company_name || "—"}</h3>
                      <Badge variant="outline" className={cn(stageInfo.tone)}>
                        {locale === "vi" ? stageInfo.vi : stageInfo.en}
                      </Badge>
                      {unreadReplies.length > 0 && (
                        <Badge className="gap-1 bg-primary/10 text-primary border-primary/20" variant="outline">
                          <MessageSquareText className="h-3 w-3" />
                          {t(`${unreadReplies.length} phản hồi mới`, `${unreadReplies.length} new reply`)}
                        </Badge>
                      )}
                      {isSilentTooLong && (
                        <Badge
                          className="gap-1 bg-amber-500/10 text-amber-700 border-amber-500/20"
                          variant="outline"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {t(`Im lặng ${silentDays} ngày`, `Silent ${silentDays} days`)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {lead?.industry && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {lead.industry}
                        </span>
                      )}
                      {lead?.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {lead.country}
                        </span>
                      )}
                      {lead?.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {lead.contact_person}
                        </span>
                      )}
                    </div>
                    {(productLabel || hsCodes.length > 0) && (
                      <div className="flex flex-wrap items-start gap-3 text-sm text-muted-foreground">
                        {productLabel && (
                          <span className="flex items-start gap-1.5 max-w-md">
                            <Package className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="text-pretty">{productLabel}</span>
                          </span>
                        )}
                        {hsCodes.length > 0 && (
                          <span className="flex items-start gap-1.5">
                            <Tag className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="font-mono text-xs">{hsCodes.join(", ")}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  </CollapsibleTrigger>
                  <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {/* Same tab on purpose: the AE keeps their place in the
                          queue. This used to be target="_blank", which opened a
                          new tab per buyer and dropped the list context every
                          time somebody checked a profile. */}
                      <Link href={`/admin/buyers/${eng.lead_id}`} tabIndex={-1}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground hover:text-foreground"
                          title={t("Hồ sơ đầy đủ + dữ liệu ImportYeti", "Full profile + ImportYeti data")}
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {t("Hồ sơ", "Profile")}
                        </Button>
                      </Link>
                      {/* Transfer / return / drop — same component the buyer
                          profile uses, so the two screens cannot drift. */}
                      <EngagementAdminActions engagement={eng} locale={locale} />
                    </div>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs text-muted-foreground",
                        daysInStage >= 14 && "text-amber-600",
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      {daysInStage <= 0
                        ? t("Mới hôm nay", "Started today")
                        : t(
                            `${daysInStage} ngày ở giai đoạn này`,
                            `${daysInStage} day${daysInStage === 1 ? "" : "s"} in this stage`,
                          )}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Buyer replies — arrive via the Resend inbound webhook
                    while the AE is still gathering requirements, i.e.
                    before any opportunity/supplier exists. */}
                {replies.length > 0 && (
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        {t(
                          `Phản hồi từ buyer (${replies.length})`,
                          `Buyer replies (${replies.length})`,
                        )}
                      </div>
                      {unreadReplies.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={markingReadFor === eng.id}
                          onClick={() => handleMarkRepliesRead(eng.id)}
                        >
                          {markingReadFor === eng.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t("Đánh dấu đã đọc", "Mark as read")
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {replies.map((reply) => {
                        const intentMeta = reply.ai_intent ? REPLY_INTENT_META[reply.ai_intent] : null
                        const IntentIcon = intentMeta?.icon ?? MessageSquareText
                        return (
                          <div
                            key={reply.id}
                            className={cn(
                              "rounded-md border bg-background p-2.5 text-sm space-y-1.5",
                              !reply.read_at && "border-primary/40 bg-primary/5",
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 font-medium">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                {reply.from_email}
                                {!reply.read_at && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                                )}
                              </span>
                              {intentMeta && (
                                <Badge variant="outline" className={cn("gap-1 text-xs", intentMeta.tone)}>
                                  <IntentIcon className="h-3 w-3" />
                                  {locale === "vi" ? intentMeta.vi : intentMeta.en}
                                </Badge>
                              )}
                            </div>
                            {reply.ai_summary ? (
                              <p className="text-foreground text-pretty">{reply.ai_summary}</p>
                            ) : (
                              <p className="text-foreground text-pretty line-clamp-3">
                                {reply.translated_vi && locale === "vi" ? reply.translated_vi : reply.raw_content}
                              </p>
                            )}
                            {(reply.translated_vi || reply.raw_content) && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                                  {t("Xem nội dung đầy đủ", "View full message")}
                                </summary>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div className="rounded-md bg-muted/40 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                      {t("Nguyên văn (EN)", "Original (EN)")}
                                    </p>
                                    <p className="whitespace-pre-wrap leading-relaxed">{reply.raw_content}</p>
                                  </div>
                                  {reply.translated_vi && (
                                    <div className="rounded-md bg-muted/40 p-2.5">
                                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                        {t("Bản dịch (VI)", "Vietnamese translation")}
                                      </p>
                                      <p className="whitespace-pre-wrap leading-relaxed">{reply.translated_vi}</p>
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                            {reply.ai_suggested_next_step && (
                              <p className="text-xs text-muted-foreground">
                                {t("Gợi ý bước tiếp theo: ", "Suggested next step: ")}
                                <span className="text-foreground">{reply.ai_suggested_next_step}</span>
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <p className="text-xs text-muted-foreground">
                                {new Date(reply.received_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}
                              </p>
                              {reply.responded_at ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                >
                                  <CornerUpLeft className="h-3 w-3" />
                                  {t("Đã trả lời", "Replied")}
                                </Badge>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => setReplyDialogFor({ engagement: eng, reply })}
                                >
                                  <Reply className="h-3 w-3" />
                                  {t("Trả lời", "Reply")}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recorded buyer requirements */}
                {(eng.requested_products || eng.moq || eng.target_price_range) && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                    {eng.requested_products && (
                      <div>
                        <span className="text-muted-foreground">{t("Sản phẩm: ", "Product: ")}</span>
                        {eng.requested_products}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-muted-foreground">
                      {eng.target_price_range && (
                        <span>
                          {t("Giá mục tiêu: ", "Target price: ")}
                          <span className="text-foreground">{eng.target_price_range}</span>
                        </span>
                      )}
                      {eng.moq && (
                        <span>
                          MOQ: <span className="text-foreground">{eng.moq}</span>
                        </span>
                      )}
                      {eng.payment_terms && (
                        <span>
                          {t("Thanh toán: ", "Payment: ")}
                          <span className="text-foreground">{eng.payment_terms}</span>
                        </span>
                      )}
                      {eng.packaging_requirements && (
                        <span>
                          {t("Bao bì: ", "Packaging: ")}
                          <span className="text-foreground">{eng.packaging_requirements}</span>
                        </span>
                      )}
                    </div>
                    {eng.other_requirements && (
                      <div className="text-muted-foreground">
                        {t("Khác: ", "Other: ")}
                        {eng.other_requirements}
                      </div>
                    )}
                  </div>
                )}

                {/* Shortlist */}
                {shortlist.length > 0 && displayVersion && (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>
                        {t(
                          `Shortlist v${displayVersion.version_number} (${shortlist.length} supplier)`,
                          `Shortlist v${displayVersion.version_number} (${shortlist.length} suppliers)`,
                        )}
                        {displayVersion.status === "draft" && (
                          <span className="ml-1.5 text-amber-600">{t("— chưa gửi", "— not sent yet")}</span>
                        )}
                      </span>
                      {shareLink && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {t(`${shareLink.view_count} lượt xem`, `${shareLink.view_count} views`)}
                          {shareLink.last_viewed_at && (
                            <span>
                              {" · "}
                              {t("mở lần cuối", "opened")} {formatRelativeTime(shareLink.last_viewed_at, locale)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {shortlist.map((s, idx) => {
                        const optionLabel = ["A", "B", "C", "D", "E"][idx] ?? String(idx + 1)
                        const isTopDwell = topDwell && s.id === topDwell.id
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm",
                              isTopDwell && "border-primary/40 bg-primary/5",
                            )}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-medium">
                                <span className="text-muted-foreground font-normal">{optionLabel} · </span>
                                {s.profiles?.company_name || s.profiles?.full_name || "—"}
                              </span>
                              {(s.total_dwell_ms ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {t(
                                    `Xem ${formatDwell(s.total_dwell_ms!, locale)}`,
                                    `Viewed for ${formatDwell(s.total_dwell_ms!, locale)}`,
                                  )}
                                  {isTopDwell && (
                                    <span className="text-primary font-medium">
                                      {t(" — chú ý nhất", " — most attention")}
                                    </span>
                                  )}
                                  {s.last_dwell_at && (
                                    <span>· {formatRelativeTime(s.last_dwell_at, locale)}</span>
                                  )}
                                </span>
                              )}
                            </div>
                            {s.buyer_action ? (
                              <Badge
                                className="shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                variant="outline"
                              >
                                {t(BUYER_ACTION_LABELS[s.buyer_action].vi, BUYER_ACTION_LABELS[s.buyer_action].en)}
                              </Badge>
                            ) : s.buyer_interested === false ? (
                              <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                {t("Không quan tâm", "Passed")}
                              </Badge>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    {lastDwellAt && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("Buyer xem shortlist lần cuối", "Buyer last engaged with the shortlist")}{" "}
                        {formatRelativeTime(lastDwellAt, locale)}
                      </p>
                    )}
                    {shareLink && (
                      <ShareLinkRow locale={locale} token={shareLink.token} />
                    )}
                  </div>
                )}

                {/* Resend outbound delivery status (delivered / opened / clicked / bounced / complained) */}
                <EngagementEmailDeliveryBadges engagementId={eng.id} locale={locale} />

                {/* Stage actions — WHICH buttons a stage offers is decided by
                    lib/buyers/engagement-stages.ts, which the buyer profile's
                    "Phân tích" tab reads too. This file only maps a key to the
                    dialog that opens. */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <EngagementStageActions
                    engagement={eng}
                    locale={locale}
                    onAction={(key) => setStageDialog({ engagement: eng, action: key })}
                  />
                </div>
              </CardContent>
              </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>

      {stageDialog && (
        <EngagementStageDialogHost
          action={stageDialog.action}
          engagement={stageDialog.engagement}
          clients={clients}
          locale={locale}
          onClose={() => setStageDialog(null)}
          onDone={() => {
            setStageDialog(null)
            router.refresh()
          }}
        />
      )}

      {replyDialogFor && (
        <EngagementReplyFollowUpDialog
          engagement={replyDialogFor.engagement}
          reply={replyDialogFor.reply}
          locale={locale}
          onClose={() => setReplyDialogFor(null)}
          onSent={() => {
            setReplyDialogFor(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Share link row (copy button)
// ---------------------------------------------------------------------------

function ShareLinkRow({ token, locale }: { token: string; locale: "vi" | "en" }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== "undefined" ? `${window.location.origin}/shortlist/${token}` : `/shortlist/${token}`

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-muted-foreground flex-1">{url}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 shrink-0 gap-1 px-2 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          toast.success(locale === "vi" ? "Đã sao chép link" : "Link copied")
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}
