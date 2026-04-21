"use client"

import Link from "next/link"
import type { Profile } from "@/lib/supabase/types"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, XCircle, Building2, Clock, ExternalLink, Star } from "lucide-react"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { useTranslation } from "@/components/i18n/language-provider"
import { FdaEditDialog } from "@/components/admin/fda-edit-dialog"
import { getFdaStatus, formatFdaDate } from "@/lib/fda/status"

interface ClientsTableProps {
  clients: Profile[]
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const { t, locale } = useTranslation()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

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

  return (
    <Card className="border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-medium">{t.admin.clients.company}</TableHead>
            <TableHead className="font-medium">{t.auth.login.email}</TableHead>
            <TableHead className="font-medium">{t.admin.clients.industry}</TableHead>
            <TableHead className="font-medium">{t.admin.clients.fdaRegistration}</TableHead>
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
                      {client.company_name ?? "—"}
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
              <TableCell className="text-sm text-muted-foreground">
                {new Date(client.created_at).toLocaleDateString(dateLocale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
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
