"use client"

/**
 * The AE inbox — one page, master–detail.
 *
 * "Buyer của tôi" (AI-matched buyers waiting to be claimed) and "Đang xử lý"
 * (buyers already claimed, being worked) used to be two separate destinations.
 * Every step of the flow crossed between them: claim a buyer here, then go
 * there to email them; read a reply there, then come back here. This page holds
 * both queues as tabs and shows the selected buyer in a detail pane, so the AE
 * never loses the row they were working on.
 *
 * The detail pane deliberately reuses the existing renderers — InboxList for a
 * pending match, EngagementList for an engagement — rather than a second
 * implementation of "what a buyer in this state looks like". A list filtered to
 * one row IS the detail view; the compact rows in the left column only carry
 * the headline facts (company, stage, days, unread replies), and those figures
 * come from the same summary module the detail pane uses, so the two columns
 * can never disagree about a buyer.
 *
 * The URL carries `?tab=` and `?focus=`, which is what makes the notification
 * links (`engagementFocusPath()`, plus the legacy `/admin/engagements?focus=`
 * that redirects here) land on the right buyer with their card open.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardList,
  Flame,
  Inbox as InboxIcon,
  MessageSquareText,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EngagementList } from "@/app/admin/ae-inbox/engagement-list"
import { InboxList, type InboxItem } from "@/app/admin/ae-inbox/inbox-list"
import type { Engagement } from "@/lib/buyers/engagement-types"
import {
  sortEngagementsForWorklist,
  summarizeEngagement,
} from "@/lib/buyers/engagement-summary"
import type { AssignableClient } from "@/lib/buyers/engagement-queries"
import type { Role } from "@/lib/supabase/types"

export type InboxTab = "pending" | "work"

interface InboxWorkspaceProps {
  /** AI-matched buyers still waiting for an AE to claim them. */
  pendingItems: InboxItem[]
  /** Buyers already claimed and being worked (open engagements). */
  engagements: Engagement[]
  /**
   * Active clients (FDA in date) — the claim dialog and the shortlist builder
   * both read from this one list, loaded once by the page.
   */
  clients: AssignableClient[]
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

export function InboxWorkspace({
  pendingItems,
  engagements,
  clients,
  locale,
  currentRole,
  initialTab,
  initialFocus = null,
}: InboxWorkspaceProps) {
  const router = useRouter()
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  // Lead Researchers monitor the matching outcome; they have no engagement of
  // their own and no claim button, so the work tab would be an empty promise.
  const canWork = currentRole !== "lead_researcher"

  const [tab, setTab] = useState<InboxTab>(initialTab === "work" && !canWork ? "pending" : initialTab)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [engagementId, setEngagementId] = useState<string | null>(initialFocus)

  // The worklist order: buyers who wrote to us and have not been read first.
  const ordered = useMemo(() => sortEngagementsForWorklist(engagements), [engagements])

  const selectedPending = pendingItems.find((i) => i.id === pendingId) ?? null
  const selectedEngagement = ordered.find((e) => e.id === engagementId) ?? null

  // Keep the address bar shareable without paying for a server round trip on
  // every row click (the data is already here).
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

  const focusIsSet = tab === "work" ? !!selectedEngagement : !!selectedPending

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs — one page, two queues. The counts live here so the AE can see
          whether anything is waiting without opening the other tab. */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ---- Master: the queue ---- */}
        <div className={cn("flex flex-col gap-2", focusIsSet && "hidden lg:flex")}>
          {tab === "pending" ? (
            pendingItems.length === 0 ? (
              <EmptyQueue
                label={t("Không có buyer nào chờ nhận", "No buyers waiting to be claimed")}
              />
            ) : (
              pendingItems.map((item) => (
                <PendingRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  selected={item.id === pendingId}
                  onSelect={() => setPendingId(item.id)}
                />
              ))
            )
          ) : ordered.length === 0 ? (
            <EmptyQueue
              label={t(
                "Chưa có buyer nào đang xử lý. Nhận buyer ở tab “Chờ nhận” để bắt đầu.",
                "No buyers in progress. Claim one from “To claim” to start.",
              )}
            />
          ) : (
            ordered.map((engagement) => (
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

        {/* ---- Detail: everything the AE does with the selected buyer ---- */}
        <div className={cn("min-w-0", !focusIsSet && "hidden lg:block")}>
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
              <ChevronLeft className="h-4 w-4" />
              {t("Danh sách", "Back to list")}
            </Button>
          )}

          {tab === "pending" ? (
            selectedPending ? (
              <InboxList
                items={[selectedPending]}
                clients={clients}
                locale={locale}
                currentRole={currentRole}
              />
            ) : (
              <Placeholder
                title={t("Chọn một buyer chờ nhận", "Pick a buyer to claim")}
                body={t(
                  "Điểm match, nhu cầu ban đầu và nút nhận buyer nằm ở đây.",
                  "Match score, the buyer's initial ask and the claim button show up here.",
                )}
              />
            )
          ) : selectedEngagement ? (
            <EngagementList
              engagements={[selectedEngagement]}
              clients={clients}
              locale={locale}
              showHeader={false}
              defaultExpanded
            />
          ) : (
            <Placeholder
              title={t("Chọn một buyer đang xử lý", "Pick a buyer in progress")}
              body={t(
                "Giai đoạn, phản hồi của buyer và các bước tiếp theo nằm ở đây.",
                "Stage, buyer replies and the stage's next actions show up here.",
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Master rows — headline facts only; the detail pane carries the rest.
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

  const priorityLabel =
    item.priority === "high"
      ? t("Ưu tiên cao", "High priority")
      : item.priority === "medium"
        ? t("Trung bình", "Medium")
        : t("Thấp", "Low")

  return (
    <MasterRow selected={selected} onSelect={onSelect}>
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
          {priorityLabel}
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
    <MasterRow selected={selected} onSelect={onSelect} attention={summary.needsAttention}>
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

function MasterRow({
  children,
  selected,
  attention = false,
  onSelect,
}: {
  children: ReactNode
  selected: boolean
  attention?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border bg-card p-3 text-left text-card-foreground shadow-sm",
        "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary bg-primary/5",
        // An unread reply is the one thing that must not be scrolled past.
        attention && !selected && "border-amber-500/40",
      )}
    >
      {children}
    </button>
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
