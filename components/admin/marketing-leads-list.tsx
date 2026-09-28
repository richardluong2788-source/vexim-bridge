"use client"

/**
 * Triage list for `public.marketing_leads` (migration 082) — every submission
 * that came in through a public form: the VN landing "Đặt lịch tư vấn 1:1"
 * today, US-buyer RFQ/consultation forms after the marketing phase.
 *
 * Deliberately dumb: the page fetches a window of rows and this component only
 * filters/edits them locally, so the queue keeps working while the DB is being
 * queried (no optimistic cache layer to keep in sync).
 */

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Inbox, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  updateMarketingLeadTriage,
  assignMarketingLeadToMe,
} from "@/app/admin/marketing-leads/actions"
import {
  MARKETING_LEAD_STATUSES,
  isMarketingLeadStatus,
  type MarketingLeadStatus,
} from "@/lib/marketing/status"

export interface MarketingLeadItem {
  id: string
  created_at: string
  audience: string
  source: string
  status: string
  reference: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  industry: string | null
  preferred_time: string | null
  message: string | null
  locale: string | null
  page_path: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  notes: string | null
  last_contacted_at: string | null
  assigned_to: string | null
  assignee_name: string | null
}

const STATUS_LABEL: Record<MarketingLeadStatus, { vi: string; en: string }> = {
  new: { vi: "Chờ xử lý", en: "New" },
  in_review: { vi: "Đang xem", en: "In review" },
  contacted: { vi: "Đã liên hệ", en: "Contacted" },
  converted: { vi: "Đã chuyển vào hệ thống", en: "Converted" },
  junk: { vi: "Rác / spam", en: "Junk" },
  archived: { vi: "Lưu trữ", en: "Archived" },
}

const AUDIENCE_LABEL: Record<string, { vi: string; en: string }> = {
  supplier: { vi: "Nhà máy / supplier", en: "Factory / supplier" },
  buyer: { vi: "Buyer Mỹ", en: "US buyer" },
  other: { vi: "Khác", en: "Other" },
}

type Bucket = "open" | "working" | "closed" | "all"

function bucketOf(status: string): Bucket {
  if (status === "new") return "open"
  if (status === "in_review" || status === "contacted") return "working"
  return "closed"
}

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function MarketingLeadsList({
  items,
  locale,
  canTriage,
  currentUserId,
}: {
  items: MarketingLeadItem[]
  locale: string
  canTriage: boolean
  currentUserId: string
}) {
  const vi = locale === "vi"
  const [bucket, setBucket] = useState<Bucket>("open")

  const counts = useMemo(() => {
    const acc: Record<Bucket, number> = { open: 0, working: 0, closed: 0, all: items.length }
    for (const item of items) acc[bucketOf(item.status)] += 1
    return acc
  }, [items])

  const visible = useMemo(
    () => (bucket === "all" ? items : items.filter((i) => bucketOf(i.status) === bucket)),
    [items, bucket],
  )

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList>
          <TabsTrigger value="open" className="gap-2">
            {vi ? "Chờ xử lý" : "Needs triage"}
            {counts.open > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-[11px]">
                {counts.open}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="working" className="gap-2">
            {vi ? "Đang liên hệ" : "In progress"}
            {counts.working > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[11px]">
                {counts.working}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">{vi ? "Đã đóng" : "Closed"}</TabsTrigger>
          <TabsTrigger value="all">{vi ? "Tất cả" : "All"}</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {vi ? "Không có lead nào trong hàng đợi này" : "Nothing in this queue"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {vi
                ? "Mỗi form công khai đều được ghi vào đây — nếu landing page có truy cập mà hàng đợi trống, kiểm tra app/api/consultation."
                : "Every public form writes here — traffic but an empty queue means something is wrong with /api/consultation."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <MarketingLeadCard
              key={item.id}
              item={item}
              vi={vi}
              locale={locale}
              canTriage={canTriage}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MarketingLeadCard({
  item,
  vi,
  locale,
  canTriage,
  currentUserId,
}: {
  item: MarketingLeadItem
  vi: boolean
  locale: string
  canTriage: boolean
  currentUserId: string
}) {
  const [status, setStatus] = useState<MarketingLeadStatus>(
    isMarketingLeadStatus(item.status) ? item.status : "new",
  )
  const [notes, setNotes] = useState(item.notes ?? "")
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const audience = AUDIENCE_LABEL[item.audience] ?? { vi: item.audience, en: item.audience }
  const utmLine = [item.utm_source, item.utm_medium, item.utm_campaign].filter(Boolean).join(" / ")
  // Hiding the button once the lead is mine keeps the card calm; someone else
  // claiming it is allowed (small team, hand-offs are cheap) and the owner name
  // below makes it visible who is on it.
  const isMine = item.assigned_to === currentUserId

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateMarketingLeadTriage({ id: item.id, status, notes })
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  function assignToMe() {
    setError(null)
    startTransition(async () => {
      const res = await assignMarketingLeadToMe(item.id)
      if (!res.ok) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <Card className={cn("border-border", item.status !== "new" && "bg-muted/30")}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {item.company_name || item.full_name || (vi ? "(không rõ công ty)" : "(no company)")}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{vi ? audience.vi : audience.en}</Badge>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {item.source}
              </Badge>
              {item.reference && (
                <span className="font-mono text-[11px] text-foreground/70">{item.reference}</span>
              )}
              {item.locale && (
                <span className="uppercase tracking-wide">{item.locale}</span>
              )}
            </div>
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(item.created_at, locale)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {item.full_name && <span className="text-foreground/80">{item.full_name}</span>}
          {item.email && (
            <a
              href={`mailto:${item.email}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {item.email}
            </a>
          )}
          {item.phone && (
            <a
              href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {item.phone}
            </a>
          )}
          {item.industry && (
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground/70">{vi ? "Ngành" : "Industry"}:</span>{" "}
              {item.industry}
            </span>
          )}
          {item.preferred_time && (
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground/70">{vi ? "Giờ tiện" : "Preferred"}:</span>{" "}
              {item.preferred_time}
            </span>
          )}
        </div>

        {item.message?.trim() && (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {vi ? "Nội dung" : "Message"}
            </p>
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-foreground/90">
              {item.message.trim()}
            </p>
          </div>
        )}

        {(item.page_path || utmLine || item.referrer) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {item.page_path && <span>page: {item.page_path}</span>}
            {utmLine && <span>utm: {utmLine}</span>}
            {item.referrer && <span className="truncate">ref: {item.referrer}</span>}
          </div>
        )}

        {canTriage ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {vi ? "Trạng thái" : "Status"}
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MarketingLeadStatus)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {MARKETING_LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {vi ? STATUS_LABEL[s].vi : STATUS_LABEL[s].en}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" size="sm" onClick={save} disabled={isPending}>
                {vi ? "Lưu triage" : "Save triage"}
              </Button>
              {!isMine && (
                <Button type="button" size="sm" variant="outline" onClick={assignToMe} disabled={isPending}>
                  <UserCheck className="h-4 w-4" />
                  {vi ? "Gán cho tôi" : "Assign to me"}
                </Button>
              )}
              {item.last_contacted_at && (
                <span className="text-xs text-muted-foreground">
                  {vi ? "Liên hệ gần nhất" : "Last contacted"}:{" "}
                  {formatDateTime(item.last_contacted_at, locale)}
                </span>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={vi ? "Ghi chú nội bộ (không gửi cho khách)…" : "Internal note (never sent to the lead)…"}
              className="text-sm"
            />
            <div className="flex min-h-5 items-center gap-3 text-xs">
              {error && <span className="text-destructive">{error}</span>}
              {saved && !error && <span className="text-muted-foreground">{vi ? "Đã lưu" : "Saved"}</span>}
              {item.assignee_name && (
                <span className="text-muted-foreground">
                  {vi ? "Người phụ trách" : "Owner"}: {item.assignee_name}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {vi
              ? "Chỉ đọc — bạn không có quyền cập nhật trạng thái hàng đợi này."
              : "Read-only — you can view the queue but not change its status."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
