"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  Timer,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface IntakeSubmissionRow {
  id: string
  status: "pending" | "submitted" | "approved" | "rejected"
  company_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  industries: string[] | null
  submitted_at: string | null
  created_at: string
  expires_at: string
  ae_id: string
  rejection_reason: string | null
  profiles: { full_name: string | null; email: string | null } | null
}

type Locale = "vi" | "en"

const STATUS_FILTERS = [
  { key: "submitted", labelVi: "Chờ duyệt", labelEn: "Awaiting review" },
  { key: "pending", labelVi: "Đã gửi link", labelEn: "Link sent" },
  { key: "approved", labelVi: "Đã duyệt", labelEn: "Approved" },
  { key: "rejected", labelVi: "Đã từ chối", labelEn: "Rejected" },
  { key: "all", labelVi: "Tất cả", labelEn: "All" },
] as const

export function IntakeReviewList({
  rows,
  locale,
}: {
  rows: IntakeSubmissionRow[]
  locale: Locale
}) {
  const [filter, setFilter] = useState<string>("submitted")

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {locale === "vi" ? f.labelVi : f.labelEn}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                filter === f.key
                  ? "bg-primary-foreground/20"
                  : "bg-muted",
              )}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {locale === "vi" ? "Không có hồ sơ nào." : "No profiles here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((row) => (
            <IntakeRow key={row.id} row={row} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}

function IntakeRow({ row, locale }: { row: IntakeSubmissionRow; locale: Locale }) {
  const dateLabel = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—"

  const industries = row.industries ?? []

  const content = (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {row.company_name || (locale === "vi" ? "(Chưa điền tên)" : "(No name yet)")}
          </span>
          <StatusBadge status={row.status} locale={locale} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {row.contact_name && <span>{row.contact_name}</span>}
          {row.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {row.email}
            </span>
          )}
          {row.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {row.phone}
            </span>
          )}
        </div>
        {industries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {industries.map((ind) => (
              <Badge key={ind} variant="secondary" className="text-xs font-normal">
                {ind}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" />
          {row.status === "pending"
            ? `${locale === "vi" ? "Hết hạn" : "Expires"}: ${dateLabel(row.expires_at)}`
            : `${locale === "vi" ? "Gửi lúc" : "Submitted"}: ${dateLabel(row.submitted_at)}`}
        </span>
        <span>
          AE: {row.profiles?.full_name || row.profiles?.email || "—"}
        </span>
      </div>
    </div>
  )

  if (row.status === "submitted" || row.status === "approved") {
    return (
      <Link href={`/admin/clients/intake/${row.id}`} className="block">
        {content}
      </Link>
    )
  }

  return <div>{content}</div>
}

function StatusBadge({
  status,
  locale,
}: {
  status: IntakeSubmissionRow["status"]
  locale: Locale
}) {
  const map: Record<
    IntakeSubmissionRow["status"],
    { labelVi: string; labelEn: string; className: string; icon: typeof Clock }
  > = {
    pending: {
      labelVi: "Đã gửi link",
      labelEn: "Link sent",
      className: "bg-muted text-muted-foreground",
      icon: Clock,
    },
    submitted: {
      labelVi: "Chờ duyệt",
      labelEn: "Awaiting review",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      icon: Timer,
    },
    approved: {
      labelVi: "Đã duyệt",
      labelEn: "Approved",
      className: "bg-primary/15 text-primary",
      icon: CheckCircle2,
    },
    rejected: {
      labelVi: "Đã từ chối",
      labelEn: "Rejected",
      className: "bg-destructive/15 text-destructive",
      icon: XCircle,
    },
  }
  const meta = map[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {locale === "vi" ? meta.labelVi : meta.labelEn}
    </span>
  )
}
