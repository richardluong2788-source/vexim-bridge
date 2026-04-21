import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Lock,
  MapPin,
  Package,
  Ship,
  Tag,
  XCircle,
} from "lucide-react"
import { maskBuyer } from "@/lib/protection/mask"
import { stageToClientPhase, type ClientPhase } from "@/lib/pipeline/phases"
import { PhaseProgress } from "./phase-progress"
import type { Stage } from "@/lib/supabase/types"

interface LeadCardProps {
  opportunity: {
    id: string
    stage: Stage
    potential_value: number | null
    buyer_code: string | null
    products_interested: string | null
    quantity_required: string | null
    target_price_usd: number | null
    price_unit: string | null
    incoterms: string | null
    payment_terms: string | null
    destination_port: string | null
    target_close_date: string | null
    next_step: string | null
    client_action_required: string | null
    last_updated: string
    created_at: string
  }
  lead: {
    company_name: string
    industry: string | null
    region: string | null
    website: string | null
    linkedin_url: string | null
    contact_person: string | null
    contact_email: string | null
    contact_phone: string | null
  }
  stageLabel: string
  dateLocale: string
  t: {
    anonymousBuyer: string
    anonymousHint: string
    revealedHint: string
    fullyRevealedHint: string
    lostHint: string
    nextStepTitle: string
    nextStepFallback: string
    actionRequiredTitle: string
    dealDetailsTitle: string
    productLabel: string
    quantityLabel: string
    unitPriceLabel: string
    totalValueLabel: string
    incotermsLabel: string
    paymentTermsLabel: string
    destinationPortLabel: string
    targetCloseLabel: string
    assignedLabel: string
    updatedLabel: string
    industryLabel: string
    regionLabel: string
    phaseProgress: string
    phase: Record<ClientPhase, string>
    phaseDesc: Record<ClientPhase, string>
  }
}

function formatCurrency(value: number | null, compact = false) {
  if (value === null || value === undefined) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

function formatDate(value: string | null, locale: string) {
  if (!value) return null
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function LeadCard({ opportunity: opp, lead, stageLabel, dateLocale, t }: LeadCardProps) {
  const masked = maskBuyer(lead, opp.stage, opp.buyer_code)
  const phase = stageToClientPhase(opp.stage)
  const isLost = phase === "closed_lost"
  const isWon = phase === "closed_won"

  const disclosureHint =
    masked.level === 1
      ? t.anonymousHint
      : masked.level === 2
        ? t.revealedHint
        : t.fullyRevealedHint

  // Detail rows only shown when actually populated
  const details: Array<{ label: string; value: string; icon: ReactNode }> = []
  if (opp.products_interested) {
    details.push({
      label: t.productLabel,
      value: opp.products_interested,
      icon: <Package className="h-3.5 w-3.5" />,
    })
  }
  if (opp.quantity_required) {
    details.push({
      label: t.quantityLabel,
      value: opp.quantity_required,
      icon: <Tag className="h-3.5 w-3.5" />,
    })
  }
  if (opp.target_price_usd) {
    const formatted = formatCurrency(opp.target_price_usd)
    if (formatted) {
      details.push({
        label: t.unitPriceLabel,
        value: opp.price_unit ? `${formatted} ${opp.price_unit}` : formatted,
        icon: <Tag className="h-3.5 w-3.5" />,
      })
    }
  }
  if (opp.incoterms) {
    details.push({
      label: t.incotermsLabel,
      value: opp.incoterms,
      icon: <Ship className="h-3.5 w-3.5" />,
    })
  }
  if (opp.payment_terms) {
    details.push({
      label: t.paymentTermsLabel,
      value: opp.payment_terms,
      icon: <Tag className="h-3.5 w-3.5" />,
    })
  }
  if (opp.destination_port) {
    details.push({
      label: t.destinationPortLabel,
      value: opp.destination_port,
      icon: <MapPin className="h-3.5 w-3.5" />,
    })
  }
  if (opp.target_close_date) {
    const formatted = formatDate(opp.target_close_date, dateLocale)
    if (formatted) {
      details.push({
        label: t.targetCloseLabel,
        value: formatted,
        icon: <Calendar className="h-3.5 w-3.5" />,
      })
    }
  }

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="flex flex-col gap-6 p-6">
        {/* Header: identity + stage */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              {masked.level >= 2 ? (
                <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              ) : (
                <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {masked.displayName}
                </h3>
                {masked.level === 1 && (
                  <Badge variant="secondary" className="font-normal gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span className="text-xs">{t.anonymousBuyer}</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {masked.industry && (
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {masked.industry}
                  </span>
                )}
                {masked.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {masked.region}
                  </span>
                )}
                <span>
                  {t.updatedLabel}{" "}
                  {formatDate(opp.last_updated, dateLocale)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              variant={isWon ? "default" : isLost ? "destructive" : "outline"}
              className="font-normal"
            >
              {isWon && <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />}
              {isLost && <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />}
              {stageLabel}
            </Badge>
            {opp.potential_value !== null && (
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(opp.potential_value, true)}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar (hidden if lost) */}
        {!isLost && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.phaseProgress}
              </span>
            </div>
            <PhaseProgress stage={opp.stage} phaseLabels={t.phase} phaseDesc={t.phaseDesc} />
          </div>
        )}

        {/* Next step (admin-authored) */}
        <div
          className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3"
          role="status"
        >
          <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isLost ? "" : t.nextStepTitle}
            </span>
            <p className="text-sm text-foreground text-pretty">
              {isLost
                ? t.lostHint
                : (opp.next_step?.trim() || t.nextStepFallback)}
            </p>
          </div>
        </div>

        {/* Action required banner */}
        {opp.client_action_required?.trim() && !isLost && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3"
            role="alert"
          >
            <AlertTriangle
              className="h-4 w-4 text-destructive shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                {t.actionRequiredTitle}
              </span>
              <p className="text-sm text-destructive/90 text-pretty">
                {opp.client_action_required}
              </p>
            </div>
          </div>
        )}

        {/* Deal details grid */}
        {details.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.dealDetailsTitle}
            </span>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              {details.map((d) => (
                <div key={d.label} className="flex flex-col gap-0.5 min-w-0">
                  <dt className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    {d.icon}
                    {d.label}
                  </dt>
                  <dd className="text-sm font-medium text-foreground truncate">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Disclosure hint footer */}
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 border-t border-border pt-4">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="text-pretty">{disclosureHint}</span>
        </p>
      </CardContent>
    </Card>
  )
}
