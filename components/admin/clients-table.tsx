"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import type { Profile } from "@/lib/supabase/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, CheckCircle2, XCircle, Building2, Clock, ExternalLink, Star, Trash2 } from "lucide-react"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { useTranslation } from "@/components/i18n/language-provider"
import { FdaEditDialog } from "@/components/admin/fda-edit-dialog"
import { AccountManagerSelect, type ManagerOption } from "@/components/admin/account-manager-select"
import { getFdaStatus, formatFdaDate } from "@/lib/fda/status"
import { GRADE_COLORS } from "@/lib/assessment/scoring"
import { deleteClient } from "@/app/admin/clients/actions"

type ClientWithProfile = Profile & {
  client_profiles?: Array<{ display_name: string | null }> | null
}

interface ClientsTableProps {
  clients: ClientWithProfile[]
  /** Staff list shown in the "Account Manager" dropdown. */
  managers: ManagerOption[]
  /** Map of managerId -> label, used to render read-only cells. */
  managerLabels: Record<string, string>
  /** True when the current viewer has CLIENT_WRITE. */
  canAssignManager: boolean
  /** True when the current viewer is super_admin — enables the delete button. */
  isSuperAdmin?: boolean
  /** Map client_id -> assessment score/grade. */
  assessmentMap?: Record<string, { score_total: number | null; score_grade: string | null }>
}

export function ClientsTable({
  clients,
  managers,
  managerLabels,
  canAssignManager,
  isSuperAdmin = false,
  assessmentMap = {},
}: ClientsTableProps) {
  const { t, locale } = useTranslation()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return
    startTransition(async () => {
      await deleteClient(pendingDeleteId)
      setPendingDeleteId(null)
    })
  }

  if (clients.length === 0) {
    return (
      <Card className="border-border">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t.admin.clients.empty}</EmptyTitle>
            <EmptyDescription>{t.admin.clients.emptyDesc}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  const pendingClient = clients.find((c) => c.id === pendingDeleteId)
  const pendingName =
    pendingClient?.client_profiles?.[0]?.display_name ??
    pendingClient?.company_name ??
    pendingClient?.full_name ??
    "khách hàng này"

  return (
    <>
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa khách hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa <span className="font-semibold text-foreground">{pendingName}</span>?
              Hành động này không thể hoàn tác và sẽ xóa toàn bộ dữ liệu liên quan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card className="border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-medium">{t.admin.clients.company}</TableHead>
            <TableHead className="font-medium">{t.auth.login.email}</TableHead>
            <TableHead className="font-medium">{t.admin.clients.industry}</TableHead>
            <TableHead className="font-medium">{t.admin.clients.fdaRegistration}</TableHead>
            <TableHead className="font-medium">Năng lực</TableHead>
            <TableHead className="font-medium">Account Manager</TableHead>
            <TableHead className="font-medium">{t.admin.clients.joined}</TableHead>
            <TableHead className="font-medium text-right">{t.admin.clients.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="hover:bg-muted/30">
              <TableCell>
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center gap-2 group"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors flex items-center gap-1">
                      {client.client_profiles?.[0]?.display_name ?? client.company_name ?? "—"}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="text-xs text-muted-foreground">{client.full_name}</span>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{client.email}</TableCell>
              <TableCell className="text-sm">
                <IndustriesCell
                  industries={client.industries}
                  fallback={client.industry}
                />
              </TableCell>
              <TableCell>
                <FdaCell
                  number={client.fda_registration_number}
                  expiresAt={client.fda_expires_at}
                  t={t.admin.clients}
                  locale={locale}
                />
              </TableCell>
              <TableCell>
                <GradeCell grade={assessmentMap[client.id]?.score_grade ?? null} score={assessmentMap[client.id]?.score_total ?? null} />
              </TableCell>
              <TableCell>
                <AccountManagerSelect
                  clientId={client.id}
                  currentManagerId={client.account_manager_id ?? null}
                  currentManagerLabel={
                    client.account_manager_id
                      ? (managerLabels[client.account_manager_id] ?? null)
                      : null
                  }
                  managers={managers}
                  canEdit={canAssignManager}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(client.created_at).toLocaleDateString(dateLocale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {client.role === "client" ? (
                    <FdaEditDialog
                      client={{
                        id: client.id,
                        full_name: client.full_name,
                        company_name: client.company_name,
                        fda_registration_number: client.fda_registration_number,
                        fda_registered_at: client.fda_registered_at,
                        fda_expires_at: client.fda_expires_at,
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingDeleteId(client.id)}
                      aria-label="Xóa khách hàng"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
    </>
  )
}

/**
 * Renders the list of industries a client operates in.
 *
 * The first item in `industries` is the primary industry (marked with a
 * star icon) and is the one used by the AI email generator. If the row
 * doesn't have a populated `industries` array yet (pre-migration data),
 * we fall back to the legacy single `industry` column.
 */
function IndustriesCell({
  industries,
  fallback,
}: {
  industries: string[] | null | undefined
  fallback: string | null
}) {
  const list =
    industries && industries.length > 0
      ? industries
      : fallback
        ? [fallback]
        : []

  if (list.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const [primary, ...rest] = list
  return (
    <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
      <Badge variant="secondary" className="gap-1 font-normal">
        <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
        {primary}
      </Badge>
      {rest.slice(0, 2).map((ind) => (
        <Badge key={ind} variant="outline" className="font-normal">
          {ind}
        </Badge>
      ))}
      {rest.length > 2 && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{rest.length - 2}
        </Badge>
      )}
    </div>
  )
}

/** Badge diem nang luc nha may (A/B/C/D). */
function GradeCell({ grade, score }: { grade: string | null; score: number | null }) {
  if (!grade) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <Badge variant="outline" className={`text-xs font-semibold ${GRADE_COLORS[grade] ?? ""}`}>
      {grade}
      {score != null && <span className="ml-1 font-normal opacity-80">· {score}</span>}
    </Badge>
  )
}

interface FdaCellProps {
  number: string | null
  expiresAt: string | null
  locale: "vi" | "en"
  t: {
    compliant: string
    nonCompliant: string
    fdaExpiresOn: string
    fdaExpired: string
    fdaExpiringSoon: string
    fdaNoExpiry: string
  }
}

/**
 * Inline FDA status cell. Shows:
 *   - A colored icon (check / warn / X) reflecting validity
 *   - The facility number
 *   - A secondary line with either the expiry date or "no expiry set"
 *   - A warning badge when we're inside the 90-day window
 */
function FdaCell({ number, expiresAt, locale, t }: FdaCellProps) {
  if (!number) {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
        <Badge variant="destructive" className="text-xs">
          {t.nonCompliant}
        </Badge>
      </div>
    )
  }

  const info = getFdaStatus(expiresAt)

  let Icon = CheckCircle2
  let iconClass = "text-chart-4"
  let secondaryLine: React.ReactNode = (
    <span className="text-[11px] text-muted-foreground">{t.fdaNoExpiry}</span>
  )

  if (info.status === "expired") {
    Icon = XCircle
    iconClass = "text-destructive"
    secondaryLine = (
      <span className="text-[11px] text-destructive font-medium">
        {t.fdaExpired.replace("{date}", formatFdaDate(expiresAt, locale))}
      </span>
    )
  } else if (info.status === "expiring_soon") {
    Icon = AlertTriangle
    iconClass = "text-amber-600 dark:text-amber-400"
    secondaryLine = (
      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
        {t.fdaExpiringSoon
          .replace("{days}", String(info.daysUntilExpiry ?? 0))
          .replace("{date}", formatFdaDate(expiresAt, locale))}
      </span>
    )
  } else if (info.status === "valid") {
    secondaryLine = (
      <span className="text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3 inline mr-1 -mt-0.5" />
        {t.fdaExpiresOn.replace("{date}", formatFdaDate(expiresAt, locale))}
      </span>
    )
  }

  return (
    <div className="flex items-start gap-1.5 min-w-[160px]">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconClass}`} />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-mono text-foreground leading-tight">{number}</span>
        {secondaryLine}
      </div>
    </div>
  )
}
