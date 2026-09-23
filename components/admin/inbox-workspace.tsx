"use client"

/**
 * The AE inbox — a worklist, and nothing else.
 *
 * This page answers one question: what needs me right now? It does not let the
 * AE act on anything. Every action — claiming the buyer, writing the email,
 * moving the stage, transferring the buyer — lives on the buyer's own page
 * (/admin/buyers/[id]), so there is exactly one place where work happens and no
 * way to start something here that you can only finish there.
 *
 * The right pane is a READ-ONLY peek: enough to decide whether this row jumps
 * the queue (match breakdown for a proposal, stage + last reply + shortlist
 * state for a buyer in flight) and one button to open the buyer's page. It
 * deliberately has no buttons that change anything.
 *
 * Rows carry the headline facts and come pre-ordered by urgency from
 * lib/buyers/engagement-summary.ts, so the list is the priority order, not just
 * a list. A buyer who wrote to us and has not been read is at the top.
 *
 * The left column shows at most 10 buyers. The rest stay on later pages, so the
 * list never wraps into the peek.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Flame,
  Inbox as InboxIcon,
  Mail,
  MessageSquareText,
  Package,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Engagement } from "@/lib/buyers/engagement-types"
import {
  sortEngagementsForWorklist,
  summarizeEngagement,
} from "@/lib/buyers/engagement-summary"
import { REPLY_INTENT_LABEL_VI, REPLY_INTENT_LABEL_EN } from "@/components/admin/buyer-replies-list"
import { inquiryChannelLabel } from "@/lib/constants/inquiry-channels"
import type { Role } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/**
 * An AI-matched buyer waiting to be claimed. Mirrors the select in
 * app/admin/ae-inbox/page.tsx — the page owns the shape, this only reads it.
 */
export interface InboxItem {
  id: string
  lead_id: string
  account_manager_id: string
  status: string
  priority: string
  rejection_reason: string | null
  created_at: string
  expires_at: string
  leads: {
    id: string
    company_name: string
    contact_person: string | null
    country: string | null
    industry: string | null
    main_product: string | null
    hs_code: string | null
    hs_codes: string[] | null
    product_keywords: string[] | null
    has_active_inquiry: boolean | null
    inquiry_products: string | null
    inquiry_quantity: string | null
    inquiry_target_price: string | null
    inquiry_timeline: string | null
    inquiry_channel: string | null
  } | null
  profiles: {
    id: string
    full_name: string | null
    email: string | null
  } | null
  ae_match_scores: {
    id: string
    total_score: number
    product_match_score: number
    industry_match_score: number
    fda_compliance_score: number
    workload_score: number
    win_rate_score: number
    country_match_score: number
    factors: Record<string, unknown>
  } | null
}

export type InboxTab = "pending" | "work"

interface InboxWorkspaceProps {
  /** AI-matched buyers still waiting for an AE to claim them. */
  pendingItems: InboxItem[]
  /** Buyers already claimed and being worked (open engagements). */
  engagements: Engagement[]
  locale: "vi" | "en"
  currentRole: Role
  initialTab: InboxTab
  /** Engagement to open on arrival — from a "buyer replied" notification. */
  initialFocus?: string | null
}

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  low: "bg-slate-500/10 text-slate-600 border-slate-500/20",
}

/** One page of the left column. Buyer 11 starts page 2 — it does not open a second column. */
const BUYERS_PER_PAGE = 10

export function InboxWorkspace({
  pendingItems,
  engagements,
  locale,
  currentRole,
  initialTab,
  initialFocus = null,
}: InboxWorkspaceProps) {
  const router = useRouter()
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  // Lead Researchers monitor matching but own no engagements, so the work queue
  // means nothing to them — they get the proposals only.
  const canWork = currentRole !== "lead_researcher"

  const [tab, setTab] = useState<InboxTab>(
    initialTab === "work" && !canWork ? "pending" : initialTab,
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [engagementId, setEngagementId] = useState<string | null>(initialFocus)
  const [page, setPage] = useState(1)

  // Urgency order: unread replies first, then most recently touched.
  const ordered = useMemo(() => sortEngagementsForWorklist(engagements), [engagements])

  const selectedPending = pendingItems.find((i) => i.id === pendingId) ?? null
  const selectedEngagement = ordered.find((e) => e.id === engagementId) ?? null
  const focusIsSet = tab === "work" ? !!selectedEngagement : !!selectedPending

  // Keep the address bar shareable (notification links land on one buyer) at no
  // cost — the data is already loaded.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    const params = new URLSearchParams({ tab })
    const focus = tab === "work" ? engagementId : pendingId
    if (focus) params.set("focus", focus)
    window.history.replaceState(null, "", `/admin/ae-inbox?${params.toString()}`)
  }, [tab, engagementId, pendingId])

  const unreadTotal = ordered.filter((e) => summarizeEngagement(e).needsAttention).length
  const activeItems = tab === "pending" ? pendingItems : ordered
  const pageCount = Math.max(1, Math.ceil(activeItems.length / BUYERS_PER_PAGE))
  const safePage = Math.min(page, pageCount)
  const pageStart = (safePage - 1) * BUYERS_PER_PAGE

  // A notification can land on a buyer past the first 10. Open that page once,
  // then leave paging to the user — switching tabs always returns to page 1.
  const didFocusPage = useRef(false)
  useEffect(() => {
    if (didFocusPage.current || !initialFocus) return
    didFocusPage.current = true
    const index = ordered.findIndex((engagement) => engagement.id === initialFocus)
    if (index >= 0) setPage(Math.floor(index / BUYERS_PER_PAGE) + 1)
  }, [initialFocus, ordered])

  function selectTab(next: InboxTab) {
    setTab(next)
    setPage(1)
  }

  const tabs: Array<{
    key: InboxTab
    label: string
    count: number
    alert?: number
    icon: typeof InboxIcon
  }> = [
    {
      key: "pending",
      label: t("Chờ nhận", "To claim"),
      count: pendingItems.length,
      icon: Sparkles,
    },
    ...(canWork
      ? [
          {
            key: "work" as InboxTab,
            label: t("Đang xử lý", "In progress"),
            count: ordered.length,
            alert: unreadTotal,
            icon: ClipboardList,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selectTab(item.key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              <Badge variant="outline" className="text-xs">
                {item.count}
              </Badge>
              {!!item.alert && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <MessageSquareText className="h-3 w-3" />
                  {item.alert}
                </span>
              )}
            </button>
          )
        })}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-2 text-xs text-muted-foreground"
          onClick={() => router.refresh()}
        >
          {t("Làm mới", "Refresh")}
        </Button>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ---- The worklist: one column, 10 buyers per page ---- */}
        <div
          className={cn(
            // justify-between pins the pager to the foot of this column.
            // The grid track is capped at 380px, so rows cannot wrap into the peek.
            "w-full max-w-full min-w-0 flex-col justify-between gap-3 overflow-hidden lg:h-[calc(100dvh-15rem)]",
            focusIsSet ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {activeItems.length === 0 ? (
              <EmptyQueue
                label={
                  tab === "pending"
                    ? t("Không có buyer nào chờ nhận", "No buyers waiting to be claimed")
                    : t(
                        "Chưa có buyer nào đang xử lý. Nhận buyer ở tab “Chờ nhận” để bắt đầu.",
                        "No buyers in progress. Claim one from “To claim” to start.",
                      )
                }
              />
            ) : tab === "pending" ? (
              pendingItems.slice(pageStart, pageStart + BUYERS_PER_PAGE).map((item) => (
                <PendingRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  selected={item.id === pendingId}
                  onSelect={() => setPendingId(item.id)}
                />
              ))
            ) : (
              ordered.slice(pageStart, pageStart + BUYERS_PER_PAGE).map((engagement) => (
                <EngagementRow
                  key={engagement.id}
                  engagement={engagement}
                  locale={locale}
                  selected={engagement.id === engagementId}
                  onSelect={() => setEngagementId(engagement.id)}
                />
              ))
            )}
          </div>

          {pageCount > 1 && (
            <WorklistPager
              page={safePage}
              pageCount={pageCount}
              onPage={setPage}
              locale={locale}
            />
          )}
        </div>

        {/* ---- Read-only peek ---- */}
        <div className={cn("min-w-0 flex-1", !focusIsSet && "hidden lg:block")}>
          {focusIsSet && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 gap-1 lg:hidden"
              onClick={() => {
                setPendingId(null)
                setEngagementId(null)
              }}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              {t("Danh sách", "Back to list")}
            </Button>
          )}

          {tab === "pending" ? (
            selectedPending ? (
              <PendingPeek item={selectedPending} locale={locale} />
            ) : (
              <Placeholder
                title={t("Chọn một buyer chờ nhận", "Pick a buyer to claim")}
                body={t(
                  "Điểm match và nhu cầu ban đầu của buyer hiện ở đây. Mọi thao tác nằm trên hồ sơ buyer.",
                  "The match score and the buyer's initial ask show up here. Actions live on the buyer's own page.",
                )}
              />
            )
          ) : selectedEngagement ? (
            <EngagementPeek engagement={selectedEngagement} locale={locale} />
          ) : (
            <Placeholder
              title={t("Chọn một buyer đang xử lý", "Pick a buyer in progress")}
              body={t(
                "Giai đoạn và phản hồi gần nhất hiện ở đây. Mọi thao tác nằm trên hồ sơ buyer.",
                "The stage and the latest reply show up here. Actions live on the buyer's own page.",
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function PendingRow({
  item,
  locale,
  selected,
  onSelect,
}: {
  item: InboxItem
  locale: "vi" | "en"
  selected: boolean
  onSelect: () => void
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const lead = item.leads
  const score = item.ae_match_scores?.total_score ?? null

  return (
    <MasterRow
      rowId={item.id}
      leadId={item.lead_id}
      selected={selected}
      onSelect={onSelect}
      openLabel={t("Mở hồ sơ buyer", "Open buyer profile")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-foreground">
              {lead?.company_name || t("Không rõ buyer", "Unknown buyer")}
            </span>
            {lead?.has_active_inquiry && (
              <Flame className="h-3.5 w-3.5 shrink-0 text-chart-4" />
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {[lead?.industry, lead?.country].filter(Boolean).join(" · ") || "—"}
          </span>
        </div>
        {score !== null && (
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {Math.round(score)}
            <span className="text-xs font-normal text-muted-foreground">/100</span>
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("text-xs", PRIORITY_TONE[item.priority])}>
          {item.priority === "high"
            ? t("Ưu tiên cao", "High priority")
            : item.priority === "medium"
              ? t("Trung bình", "Medium")
              : t("Thấp", "Low")}
        </Badge>
        {lead?.has_active_inquiry && (
          <Badge variant="outline" className="text-xs">
            {t("Có nhu cầu ngay", "Active inquiry")}
          </Badge>
        )}
      </div>
    </MasterRow>
  )
}

function EngagementRow({
  engagement,
  locale,
  selected,
  onSelect,
}: {
  engagement: Engagement
  locale: "vi" | "en"
  selected: boolean
  onSelect: () => void
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const summary = summarizeEngagement(engagement)

  return (
    <MasterRow
      rowId={engagement.id}
      leadId={engagement.lead_id}
      selected={selected}
      attention={summary.needsAttention}
      onSelect={onSelect}
      openLabel={t("Mở hồ sơ buyer", "Open buyer profile")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium text-foreground">{summary.companyName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {summary.productLabel || t("Chưa rõ sản phẩm", "Product not set")}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {summary.daysInStage <= 0
            ? t("Mới hôm nay", "Today")
            : t(`${summary.daysInStage} ngày`, `${summary.daysInStage}d`)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("text-xs", summary.stageInfo.tone)}>
          {locale === "vi" ? summary.stageInfo.vi : summary.stageInfo.en}
        </Badge>
        {summary.unreadReplies.length > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400"
          >
            <MessageSquareText className="h-3 w-3" />
            {t(
              `${summary.unreadReplies.length} phản hồi mới`,
              `${summary.unreadReplies.length} new`,
            )}
          </Badge>
        )}
        {summary.isSilentTooLong && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {t(`Im lặng ${summary.silentDays} ngày`, `Silent ${summary.silentDays}d`)}
          </Badge>
        )}
      </div>
    </MasterRow>
  )
}

/**
 * One row of the worklist.
 *
 * Selecting the row is what fills the peek pane; the arrow on the right is a
 * real link, so the buyer's page is one click (or one middle-click) away
 * without going through the pane. They are siblings rather than nested, because
 * a link inside a button is invalid markup and swallows the click.
 */
function MasterRow({
  children,
  rowId,
  leadId,
  selected,
  attention = false,
  onSelect,
  openLabel,
}: {
  children: ReactNode
  /** Inbox item or engagement id — used to scroll a focused buyer into view. */
  rowId: string
  leadId: string
  selected: boolean
  attention?: boolean
  onSelect: () => void
  openLabel: string
}) {
  return (
    <div
      id={`inbox-row-${rowId}`}
      className={cn(
        "flex items-stretch gap-1 rounded-lg border bg-card text-card-foreground shadow-sm transition-colors",
        selected && "border-primary bg-primary/5",
        // An unread reply is the one thing that must not be scrolled past.
        attention && !selected && "border-amber-500/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 rounded-l-lg p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="my-2 mr-2 h-8 w-8 shrink-0 self-center text-muted-foreground hover:text-foreground"
      >
        <Link href={`/admin/buyers/${leadId}`} aria-label={openLabel} title={openLabel}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Peeks — read-only. If this pane ever grows a button that changes state, the
// worklist has been broken.
// ---------------------------------------------------------------------------

function PeekCard({
  leadId,
  title,
  subtitle,
  children,
  locale,
}: {
  leadId: string
  title: string
  subtitle: string | null
  children: ReactNode
  locale: "vi" | "en"
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {/* The only interactive thing here: go do the work where the work is. */}
        <Button asChild size="sm" className="gap-2">
          <Link href={`/admin/buyers/${leadId}`}>
            <ExternalLink className="h-4 w-4" />
            {t("Mở hồ sơ buyer", "Open buyer profile")}
          </Link>
        </Button>
      </div>
      {children}
    </div>
  )
}

function PendingPeek({ item, locale }: { item: InboxItem; locale: "vi" | "en" }) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const lead = item.leads
  const score = item.ae_match_scores

  const expiresInDays = Math.ceil(
    (new Date(item.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  )

  return (
    <PeekCard
      leadId={item.lead_id}
      title={lead?.company_name || t("Không rõ buyer", "Unknown buyer")}
      subtitle={[lead?.industry, lead?.country].filter(Boolean).join(" · ") || null}
      locale={locale}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("text-xs", PRIORITY_TONE[item.priority])}>
          {item.priority === "high"
            ? t("Ưu tiên cao", "High priority")
            : item.priority === "medium"
              ? t("Trung bình", "Medium")
              : t("Thấp", "Low")}
        </Badge>
        {score && (
          <Badge variant="secondary" className="text-xs">
            {t("Điểm match", "Match score")}: {Math.round(score.total_score)}/100
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {expiresInDays <= 0
            ? t("Đề xuất đã hết hạn", "Proposal expired")
            : t(`Còn ${expiresInDays} ngày`, `${expiresInDays} days left`)}
        </span>
      </div>

      {/* What the buyer asked for, if they came in through the inquiry form. */}
      {lead?.has_active_inquiry && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {t("Nhu cầu ban đầu", "Initial ask")}
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {lead.inquiry_products && (
              <PeekField label={t("Sản phẩm", "Products")} value={lead.inquiry_products} />
            )}
            {lead.inquiry_quantity && (
              <PeekField label={t("Số lượng / MOQ", "Quantity / MOQ")} value={lead.inquiry_quantity} />
            )}
            {lead.inquiry_target_price && (
              <PeekField label={t("Giá mục tiêu", "Target price")} value={lead.inquiry_target_price} />
            )}
            {lead.inquiry_timeline && (
              <PeekField label={t("Timeline", "Timeline")} value={lead.inquiry_timeline} />
            )}
            {lead.inquiry_channel && (
              <PeekField
                label={t("Kênh", "Channel")}
                value={inquiryChannelLabel(lead.inquiry_channel, locale)}
              />
            )}
          </div>
        </div>
      )}

      {score && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Vì sao AI đề xuất buyer này", "Why the matcher picked this buyer")}
          </span>
          <ScoreBar label={t("Sản phẩm", "Product")} value={score.product_match_score} />
          <ScoreBar label={t("Ngành hàng", "Industry")} value={score.industry_match_score} />
          <ScoreBar label={t("FDA", "FDA")} value={score.fda_compliance_score} />
          <ScoreBar label={t("Workload", "Workload")} value={score.workload_score} />
          <ScoreBar label={t("Win rate", "Win rate")} value={score.win_rate_score} />
          <ScoreBar label={t("Quốc gia", "Country")} value={score.country_match_score} />
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="text-pretty">
          {t(
            "Nhận buyer hoặc từ chối đề xuất này trên hồ sơ buyer — cùng chỗ với mọi thao tác khác.",
            "Claim or reject this proposal on the buyer's page — the same place as every other action.",
          )}
        </span>
      </div>
    </PeekCard>
  )
}

function EngagementPeek({
  engagement,
  locale,
}: {
  engagement: Engagement
  locale: "vi" | "en"
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const summary = summarizeEngagement(engagement)
  const latestReply = summary.replies[0] ?? null
  const versions = [...(engagement.buyer_engagement_shortlist_versions ?? [])].sort(
    (a, b) => b.version_number - a.version_number,
  )
  const sentVersion = versions.find((v) => v.status === "sent") ?? null
  const draftVersion = versions.find((v) => v.status === "draft") ?? null
  const displayVersion = sentVersion ?? draftVersion ?? null
  const items = displayVersion?.buyer_engagement_shortlist_items ?? []
  const interested = items.filter((i) => i.buyer_interested === true).length

  return (
    <PeekCard
      leadId={engagement.lead_id}
      title={summary.companyName}
      subtitle={
        [engagement.leads?.industry, engagement.leads?.country].filter(Boolean).join(" · ") ||
        null
      }
      locale={locale}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("text-xs", summary.stageInfo.tone)}>
          {locale === "vi" ? summary.stageInfo.vi : summary.stageInfo.en}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {summary.daysInStage <= 0
            ? t("Mới hôm nay", "Started today")
            : t(
                `${summary.daysInStage} ngày ở giai đoạn này`,
                `${summary.daysInStage} day${summary.daysInStage === 1 ? "" : "s"} in this stage`,
              )}
        </span>
        {summary.isSilentTooLong && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {t(`Im lặng ${summary.silentDays} ngày`, `Silent ${summary.silentDays} days`)}
          </Badge>
        )}
      </div>

      {/* The reply is why this row is at the top of the list — show it. */}
      {latestReply && (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-md border p-3",
            !latestReply.read_at && "border-amber-500/40 bg-amber-500/5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" />
              {t("Phản hồi gần nhất", "Latest reply")}
            </span>
            {latestReply.ai_intent && (
              <Badge variant="secondary" className="text-xs">
                {(locale === "vi" ? REPLY_INTENT_LABEL_VI : REPLY_INTENT_LABEL_EN)[
                  latestReply.ai_intent
                ] ?? latestReply.ai_intent}
              </Badge>
            )}
            {!latestReply.read_at && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400"
              >
                {t("Chưa đọc", "Unread")}
              </Badge>
            )}
          </div>
          {latestReply.subject && (
            <p className="text-sm font-medium text-foreground">{latestReply.subject}</p>
          )}
          <p className="line-clamp-4 text-sm text-muted-foreground text-pretty">
            {latestReply.ai_summary ?? latestReply.translated_vi ?? latestReply.raw_content}
          </p>
          {summary.replies.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {t(
                `+${summary.replies.length - 1} phản hồi trước đó`,
                `+${summary.replies.length - 1} earlier repl${summary.replies.length - 1 === 1 ? "y" : "ies"}`,
              )}
            </span>
          )}
        </div>
      )}

      {/* Requirements on file — the AE's own notes, so they can decide whether
          the buyer is worth a shortlist without opening the page. */}
      {summary.productLabel || engagement.requested_products ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <PeekField
            label={t("Sản phẩm buyer cần", "Requested products")}
            value={engagement.requested_products || summary.productLabel || "—"}
          />
          {engagement.target_price_range && (
            <PeekField label={t("Giá mục tiêu", "Target price")} value={engagement.target_price_range} />
          )}
          {engagement.moq && <PeekField label={t("MOQ", "MOQ")} value={engagement.moq} />}
          {engagement.payment_terms && (
            <PeekField label={t("Thanh toán", "Payment")} value={engagement.payment_terms} />
          )}
        </div>
      ) : null}

      {displayVersion ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("Shortlist", "Shortlist")} v{displayVersion.version_number}
          </span>
          <Badge variant="outline" className="text-xs">
            {displayVersion.status === "sent"
              ? t("đã gửi", "sent")
              : displayVersion.status === "draft"
                ? t("bản nháp", "draft")
                : displayVersion.status}
          </Badge>
          <span>
            {t(`${items.length} nhà cung cấp`, `${items.length} suppliers`)}
            {interested > 0 && ` · ${t(`${interested} quan tâm`, `${interested} interested`)}`}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("Chưa có shortlist nào.", "No shortlist yet.")}
        </p>
      )}

      <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="text-pretty">
          {t(
            "Ghi nhận nhu cầu, soạn email, gửi shortlist và chuyển cơ hội đều nằm trên hồ sơ buyer.",
            "Recording requirements, writing emails, sending the shortlist and creating deals all live on the buyer's page.",
          )}
        </span>
      </div>
    </PeekCard>
  )
}

function PeekField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 70 ? "bg-chart-4" : pct >= 40 ? "bg-chart-1" : "bg-chart-5",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {Math.round(pct)}
      </span>
    </div>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="max-w-sm text-xs text-muted-foreground text-pretty">{body}</p>
    </div>
  )
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

/**
 * `< 1 2 3 >` pinned to the foot of the left column. Page numbers stay inside
 * that column — they wrap downward if there are many, they do not spill into
 * the peek.
 */
function WorklistPager({
  page,
  pageCount,
  onPage,
  locale,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
  locale: "vi" | "en"
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const pages = pageWindow(page, pageCount)

  return (
    <nav
      aria-label={t("Phân trang danh sách buyer", "Buyer list pages")}
      className="mt-auto flex shrink-0 flex-nowrap items-center justify-center gap-1 border-t bg-background px-1 py-2"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        aria-label={t("Trang trước", "Previous page")}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((entry, index) =>
        entry === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="px-1 text-xs text-muted-foreground"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Button
            key={entry}
            type="button"
            variant={entry === page ? "default" : "outline"}
            size="icon-sm"
            aria-label={t(`Trang ${entry}`, `Page ${entry}`)}
            aria-current={entry === page ? "page" : undefined}
            onClick={() => onPage(entry)}
          >
            {entry}
          </Button>
        ),
      )}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={page >= pageCount}
        aria-label={t("Trang sau", "Next page")}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

/** `1 2 3` when there are few pages; a short window plus the ends when there are many. */
function pageWindow(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages: Array<number | "ellipsis"> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) pages.push("ellipsis")
  for (let n = start; n <= end; n++) pages.push(n)
  if (end < pageCount - 1) pages.push("ellipsis")
  pages.push(pageCount)
  return pages
}
