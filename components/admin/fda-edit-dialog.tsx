"use client"

import { useMemo, useState, useTransition } from "react"
import type { Profile } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateFdaRegistration } from "@/app/admin/clients/actions"
import { useTranslation } from "@/components/i18n/language-provider"
import { getFdaStatus, isFdaPending, type FdaStatus } from "@/lib/fda/status"

interface FdaEditDialogProps {
  client: Pick<
    Profile,
    | "id"
    | "full_name"
    | "company_name"
    | "fda_registration_number"
    | "fda_registered_at"
    | "fda_expires_at"
  > & {
    fda_status?: string | null
  }
}

export function FdaEditDialog({ client }: FdaEditDialogProps) {
  const { t, locale } = useTranslation()
  const [open, setOpen] = useState(false)

  const initialIsPending = isFdaPending(client.fda_status, client.fda_registration_number)
  const initialMode = initialIsPending
    ? "pending_supplement"
    : client.fda_registration_number
      ? "has_number"
      : "has_number"

  const [mode, setMode] = useState<"has_number" | "pending_supplement">(initialMode)
  const [number, setNumber] = useState(
    initialIsPending ? "" : (client.fda_registration_number ?? "")
  )
  const [registeredAt, setRegisteredAt] = useState(client.fda_registered_at ?? "")
  const [expiresAt, setExpiresAt] = useState(client.fda_expires_at ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasExisting = Boolean(client.fda_registration_number)
  const dict = t.admin.clients.fdaDialog

  // Live countdown preview
  const preview = useMemo(() => {
    if (mode === "pending_supplement") {
      return { status: "pending_supplement" as FdaStatus, daysUntilExpiry: null }
    }
    return getFdaStatus(expiresAt || null, new Date(), number)
  }, [expiresAt, mode, number])

  function resolveErrorMessage(code: string): string {
    switch (code) {
      case "invalidLength":
        return dict.errorInvalidLength
      case "invalidFormat":
        return dict.errorInvalidFormat
      case "invalidRegisteredAt":
      case "invalidExpiresAt":
        return dict.errorInvalidDate
      case "expiresBeforeRegistered":
        return dict.errorDateOrder
      case "notAuthenticated":
      case "forbidden":
        return dict.errorForbidden
      case "notFound":
      case "notAClient":
        return dict.errorNotFound
      default:
        return dict.errorGeneric
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateFdaRegistration({
        clientId: client.id,
        fdaNumber: mode === "pending_supplement" ? "PENDING" : number,
        registeredAt: mode === "pending_supplement" ? null : registeredAt || null,
        expiresAt: mode === "pending_supplement" ? null : expiresAt || null,
        fdaStatus: mode === "pending_supplement" ? "pending_supplement" : number ? "valid" : "missing",
      })
      if (!result.ok) {
        setError(resolveErrorMessage(result.error ?? "generic"))
        return
      }
      setOpen(false)
    })
  }

  function handleClear() {
    setError(null)
    startTransition(async () => {
      const result = await updateFdaRegistration({
        clientId: client.id,
        fdaNumber: null,
        registeredAt: null,
        expiresAt: null,
        fdaStatus: "missing",
      })
      if (!result.ok) {
        setError(resolveErrorMessage(result.error ?? "generic"))
        return
      }
      setNumber("")
      setRegisteredAt("")
      setExpiresAt("")
      setMode("has_number")
      setOpen(false)
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      const isPend = isFdaPending(client.fda_status, client.fda_registration_number)
      setMode(isPend ? "pending_supplement" : "has_number")
      setNumber(isPend ? "" : (client.fda_registration_number ?? ""))
      setRegisteredAt(client.fda_registered_at ?? "")
      setExpiresAt(client.fda_expires_at ?? "")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={hasExisting ? "ghost" : "outline"}
          className="h-8 gap-1.5"
        >
          {hasExisting ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-xs">{dict.editButton}</span>
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">{dict.addButton}</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>
            {dict.subtitle.replace(
              "{company}",
              client.company_name ?? client.full_name ?? "—",
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {/* Status Selector */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode("has_number")}
                className={cn(
                  "flex items-center justify-center rounded-md border p-2.5 text-xs font-medium transition-colors",
                  mode === "has_number"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                )}
              >
                {locale === "vi" ? "✓ Đã có mã số FDA" : "✓ Valid FDA Number"}
              </button>
              <button
                type="button"
                onClick={() => setMode("pending_supplement")}
                className={cn(
                  "flex items-center justify-center rounded-md border p-2.5 text-xs font-medium transition-colors",
                  mode === "pending_supplement"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                )}
              >
                {locale === "vi" ? "⏳ Đang bổ sung FDA" : "⏳ In Progress"}
              </button>
            </div>

            {mode === "has_number" ? (
              <>
                <Field data-invalid={error ? "true" : undefined}>
                  <FieldLabel htmlFor="fda-number">{dict.label}</FieldLabel>
                  <Input
                    id="fda-number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder={dict.placeholder}
                    autoComplete="off"
                    autoFocus
                    disabled={isPending}
                    className="font-mono"
                  />
                  <FieldDescription>{dict.help}</FieldDescription>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="fda-registered">{dict.registeredAt}</FieldLabel>
                    <Input
                      id="fda-registered"
                      type="date"
                      value={registeredAt}
                      onChange={(e) => setRegisteredAt(e.target.value)}
                      disabled={isPending}
                      max={expiresAt || undefined}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="fda-expires">{dict.expiresAt}</FieldLabel>
                    <Input
                      id="fda-expires"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      disabled={isPending}
                      min={registeredAt || undefined}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300">
                {locale === "vi"
                  ? "Nhà cung cấp đã cam kết hoàn thiện đăng ký FDA khi chốt đơn hàng với Buyer. Hệ thống sẽ cho phép giới thiệu nhà cung cấp này trong Shortlist cho Buyer."
                  : "Supplier committed to completing FDA registration upon deal confirmation. The system will allow shortlisting and introducing this supplier to buyers."}
              </div>
            )}

            <CountdownPreview
              status={preview.status}
              days={preview.daysUntilExpiry}
              dict={dict.countdown}
              locale={locale}
            />

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>

          <DialogFooter className="mt-6 gap-2 sm:gap-2">
            {hasExisting ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isPending}
                className="mr-auto text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {dict.clear}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {dict.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending || (mode === "has_number" && number.trim().length === 0)}
            >
              {isPending ? <Spinner className="mr-1" /> : null}
              {dict.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface CountdownDict {
  missing: string
  expired: string
  expiringSoon: string
  valid: string
  daysSuffix: string
}

function CountdownPreview({
  status,
  days,
  dict,
  locale,
}: {
  status: FdaStatus
  days: number | null
  dict: CountdownDict
  locale: "vi" | "en"
}) {
  if (status === "missing") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mt-0.5" />
        <span>{dict.missing}</span>
      </div>
    )
  }

  if (status === "pending_supplement") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
        <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          {locale === "vi"
            ? "Đang bổ sung hồ sơ FDA (Đủ điều kiện giới thiệu Buyer)"
            : "FDA registration in progress (Eligible for Buyer shortlist)"}
        </span>
      </div>
    )
  }

  const absDays = Math.abs(days ?? 0)
  const daysLabel = formatDays(absDays, locale, dict.daysSuffix)

  const config = {
    expired: {
      icon: AlertTriangle,
      tone: "border-destructive/40 bg-destructive/10 text-destructive",
      message: dict.expired.replace("{days}", daysLabel),
    },
    expiring_soon: {
      icon: AlertTriangle,
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      message: dict.expiringSoon.replace("{days}", daysLabel),
    },
    valid: {
      icon: CheckCircle2,
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      message: dict.valid.replace("{days}", daysLabel),
    },
  }[status]

  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        config.tone,
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{config.message}</span>
    </div>
  )
}

function formatDays(n: number, locale: "vi" | "en", suffix: string): string {
  const formatted = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(n)
  return `${formatted} ${suffix}`
}
