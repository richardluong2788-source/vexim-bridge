"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Banknote,
  Ship,
  Upload,
  Check,
  ExternalLink,
  Loader2,
  Globe2,
  Flame,
  UserCheck,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  getOpportunityComplianceState,
  uploadDealDocumentAction,
  verifySwiftAction,
  type OpportunityComplianceState,
} from "@/app/admin/opportunities/compliance-actions"
import { useTranslation } from "@/components/i18n/language-provider"
import { cn } from "@/lib/utils"

interface Props {
  opportunityId: string
  open: boolean
}

type DocKind = "po" | "swift" | "bl"

/**
 * Closing & Compliance section inside the opportunity detail sheet.
 * Implements SOP Phase 3 gates + R-05 Segregation of Duties:
 *   - Upload scanned PO / Swift wire / Bill of Lading
 *   - Dual-control Swift verification: uploader and verifier MUST be
 *     different people (enforced by DB CHECK `deals_swift_sod_check`).
 *   - When the current admin is the one who uploaded the Swift doc, the
 *     verify button is disabled and a dual-control notice is shown
 *     (they need to ask a teammate to log in and verify).
 */
export function OpportunityComplianceSection({ opportunityId, open }: Props) {
  const { t, locale } = useTranslation()
  const [state, setState] = useState<OpportunityComplianceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingKind, setUploadingKind] = useState<DocKind | null>(null)
  const [txRef, setTxRef] = useState("")
  const [pending, startTransition] = useTransition()

  const s = t.admin.clients.compliance

  // Fetch state when the sheet opens.
  useEffect(() => {
    if (!open || !opportunityId) return
    let cancelled = false
    setLoading(true)
    getOpportunityComplianceState(opportunityId)
      .then((res) => {
        if (cancelled) return
        setState(res)
        setTxRef(res.deal?.transaction_reference ?? "")
      })
      .catch((err) => {
        console.error("[v0] compliance fetch failed", err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, opportunityId])

  async function handleUpload(kind: DocKind, file: File) {
    if (!file) return
    setUploadingKind(kind)
    try {
      const fd = new FormData()
      fd.append("opportunityId", opportunityId)
      fd.append("kind", kind)
      fd.append("file", file)
      const res = await uploadDealDocumentAction(fd)
      if (!res.ok) {
        toast.error(s.errorGeneric, {
          description:
            res.error === "fileTooLarge"
              ? s.errorFileTooLarge
              : res.error === "invalidType"
                ? s.errorInvalidType
                : res.error === "missingToken"
                  ? s.errorMissingToken
                  : undefined,
        })
        return
      }
      toast.success(s.uploadSuccess)
      const refreshed = await getOpportunityComplianceState(opportunityId)
      setState(refreshed)
    } finally {
      setUploadingKind(null)
    }
  }

  function handleToggleVerify(nextVerified: boolean) {
    startTransition(async () => {
      const res = await verifySwiftAction({
        opportunityId,
        verified: nextVerified,
        transactionReference: txRef,
      })
      if (!res.ok) {
        if (res.error === "sodViolation") {
          toast.error(s.sodBlockedTitle, { description: s.sodBlockedDesc })
        } else if (res.error === "swiftMissing") {
          toast.error(s.uploadSwiftFirst)
        } else {
          toast.error(s.errorGeneric)
        }
        return
      }
      toast.success(nextVerified ? s.verifiedSuccess : s.unverifiedSuccess)
      const refreshed = await getOpportunityComplianceState(opportunityId)
      setState(refreshed)
    })
  }

  if (loading) {
    return (
      <section>
        <SectionHeader title={s.sectionTitle} />
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-4 w-4" />
        </div>
      </section>
    )
  }

  if (!state?.ok || !state.risk) {
    return (
      <section>
        <SectionHeader title={s.sectionTitle} />
        <p className="text-sm text-muted-foreground">{s.errorLoad}</p>
      </section>
    )
  }

  const { risk, deal, uploader, verifier, canSelfVerifySwift } = state
  const swiftVerified = Boolean(deal?.swift_verified)
  const hasSwift = Boolean(deal?.swift_doc_url)

  // Dual-control blocker: current user uploaded the Swift, so they
  // cannot self-verify. UI replaces the primary CTA with a notice.
  const sodBlocked = hasSwift && !swiftVerified && canSelfVerifySwift === false

  return (
    <section>
      <SectionHeader title={s.sectionTitle} />

      {/* Risk summary */}
      <div
        className={cn(
          "rounded-lg border p-4 mb-4 flex items-start gap-3",
          risk.level === "high"
            ? "border-destructive/30 bg-destructive/10"
            : risk.level === "medium"
              ? "border-chart-5/40 bg-chart-5/10"
              : "border-chart-4/30 bg-chart-4/10",
        )}
      >
        {risk.level === "high" ? (
          <Flame className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        ) : risk.level === "medium" ? (
          <Globe2 className="h-5 w-5 text-chart-5 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              risk.level === "high"
                ? "text-destructive"
                : risk.level === "medium"
                  ? "text-chart-5"
                  : "text-chart-4",
            )}
          >
            {risk.level === "high"
              ? s.riskHighTitle
              : risk.level === "medium"
                ? s.riskMediumTitle
                : s.riskLowTitle}
            {state.lead?.country ? ` · ${state.lead.country}` : ""}
          </p>
          <ul className="text-xs opacity-90 mt-1 space-y-0.5 list-disc pl-4">
            {risk.reasons[locale].map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="text-xs mt-2 font-medium">
            {s.recommendedPayment}: {risk.recommendedPayment[locale]}
          </p>
        </div>
      </div>

      {/* Document upload rows */}
      <div className="flex flex-col gap-3">
        <DocRow
          label={s.poLabel}
          hint={s.poHint}
          icon={<FileText className="h-4 w-4" />}
          url={deal?.po_doc_url ?? null}
          uploading={uploadingKind === "po"}
          onUpload={(f) => handleUpload("po", f)}
          viewLabel={s.view}
          replaceLabel={s.replace}
          uploadLabel={s.upload}
        />
        <DocRow
          label={s.swiftLabel}
          hint={s.swiftHint}
          icon={<Banknote className="h-4 w-4" />}
          url={deal?.swift_doc_url ?? null}
          uploading={uploadingKind === "swift"}
          onUpload={(f) => handleUpload("swift", f)}
          viewLabel={s.view}
          replaceLabel={s.replace}
          uploadLabel={s.upload}
        />
        <DocRow
          label={s.blLabel}
          hint={s.blHint}
          icon={<Ship className="h-4 w-4" />}
          url={deal?.bl_doc_url ?? null}
          uploading={uploadingKind === "bl"}
          onUpload={(f) => handleUpload("bl", f)}
          viewLabel={s.view}
          replaceLabel={s.replace}
          uploadLabel={s.upload}
        />
      </div>

      {/* Swift verification + SoD enforcement */}
      <div
        className={cn(
          "mt-4 rounded-lg border p-4 flex flex-col gap-3",
          swiftVerified
            ? "border-chart-4/40 bg-chart-4/5"
            : sodBlocked
              ? "border-chart-5/40 bg-chart-5/10"
              : "border-border bg-muted/30",
        )}
      >
        <div className="flex items-start gap-3">
          {swiftVerified ? (
            <ShieldCheck className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
          ) : sodBlocked ? (
            <Users className="h-5 w-5 text-chart-5 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-semibold",
                swiftVerified
                  ? "text-chart-4"
                  : sodBlocked
                    ? "text-chart-5"
                    : "text-foreground",
              )}
            >
              {swiftVerified
                ? s.verifiedTitle
                : sodBlocked
                  ? s.sodBlockedTitle
                  : s.unverifiedTitle}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {swiftVerified
                ? s.verifiedDesc
                : sodBlocked
                  ? s.sodBlockedDesc
                  : s.unverifiedDesc}
            </p>
          </div>
        </div>

        {/* Attribution: who uploaded, who verified */}
        {(uploader || verifier) && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-8">
            {uploader && (
              <div className="flex items-center gap-1.5">
                <Upload className="h-3 w-3" aria-hidden="true" />
                <span>
                  {s.uploadedBy}:{" "}
                  <span className="text-foreground font-medium">
                    {uploader.full_name || uploader.email || uploader.id.slice(0, 8)}
                  </span>
                </span>
              </div>
            )}
            {verifier && (
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3 w-3" aria-hidden="true" />
                <span>
                  {s.verifiedBy}:{" "}
                  <span className="text-foreground font-medium">
                    {verifier.full_name || verifier.email || verifier.id.slice(0, 8)}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={txRef}
            onChange={(e) => setTxRef(e.target.value)}
            placeholder={s.txRefPlaceholder}
            disabled={pending}
            className="flex-1 text-sm"
          />
          {swiftVerified ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleToggleVerify(false)}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              {s.revoke}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending || !hasSwift || sodBlocked}
              onClick={() => handleToggleVerify(true)}
              title={sodBlocked ? s.sodBlockedDesc : undefined}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {s.verify}
            </Button>
          )}
        </div>
        {!hasSwift && !swiftVerified && (
          <p className="text-xs text-muted-foreground">{s.uploadSwiftFirst}</p>
        )}
      </div>
    </section>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  )
}

interface DocRowProps {
  label: string
  hint: string
  icon: React.ReactNode
  url: string | null
  uploading: boolean
  onUpload: (file: File) => void
  viewLabel: string
  replaceLabel: string
  uploadLabel: string
}

function DocRow({
  label,
  hint,
  icon,
  url,
  uploading,
  onUpload,
  viewLabel,
  replaceLabel,
  uploadLabel,
}: DocRowProps) {
  const inputId = `upload-${label.replace(/\s+/g, "-")}`
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{hint}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {viewLabel}
          </a>
        )}
        <label
          htmlFor={inputId}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent transition-colors",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {url ? replaceLabel : uploadLabel}
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}
