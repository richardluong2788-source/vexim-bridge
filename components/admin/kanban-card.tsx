"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
import {
  Building2,
  User,
  DollarSign,
  ShieldAlert,
  Pencil,
  AlertTriangle,
  Sparkles,
  Flame,
  Globe2,
  Mail,
  Package,
  Star,
  TrendingDown,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTranslation } from "@/components/i18n/language-provider"
import { assessCountryRisk } from "@/lib/risk/country-risk"
import { normalizeIndustry } from "@/lib/constants/industries"

interface KanbanCardProps {
  opportunity: OpportunityWithClient
  isDragging?: boolean
  onEdit?: (opportunity: OpportunityWithClient) => void
  /** Number of unread buyer replies for this opportunity */
  unreadReplyCount?: number
}

export function KanbanCard({ opportunity, isDragging, onEdit, unreadReplyCount = 0 }: KanbanCardProps) {
  const { t, locale } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: opportunity.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const lead = opportunity.leads
  const client = opportunity.profiles
  const missingFda = !client?.fda_registration_number?.trim()

  // Small indicator icons — hover reveals the full content via tooltip.
  // This keeps each card compact so pipeline columns stay scannable even
  // with many opportunities stacked vertically.
  const hasNextStep = Boolean(opportunity.next_step?.trim())
  const hasActionRequired = Boolean(opportunity.client_action_required?.trim())

  // Country risk surfacing — only render the chip when a country is set AND
  // the level is medium/high. "Low" is quiet by design and we suppress the
  // badge for leads with no country to avoid noisy legacy data.
  const risk = assessCountryRisk(lead?.country ?? null)
  const showRiskBadge =
    Boolean(lead?.country?.trim()) &&
    (risk.level === "high" || risk.level === "medium")

  // ImportYeti data indicators
  const hasHsCode = Boolean(lead?.hs_code?.trim())
  const hasPriority = Boolean(lead?.priority_rating && lead.priority_rating > 0)
  
  // Low season indicator - check if current month is in buyer's low months
  const isLowSeason = (() => {
    const lowMonths = lead?.top_low_months?.toLowerCase() || ""
    if (!lowMonths) return false
    
    const currentMonth = new Date().toLocaleString("en-US", { month: "long" }).toLowerCase()
    const currentMonthShort = new Date().toLocaleString("en-US", { month: "short" }).toLowerCase()
    
    return lowMonths.includes(currentMonth) || lowMonths.includes(currentMonthShort)
  })()

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "p-2.5 cursor-grab active:cursor-grabbing border-border bg-card shadow-sm hover:shadow-md transition-shadow select-none",
          (isSortableDragging || isDragging) && "opacity-50 shadow-lg rotate-1",
        )}
      >
        {/* Row 1: company name + compact status indicators */}
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-foreground truncate leading-tight">
              {lead?.company_name ?? "—"}
            </span>
              {lead?.industry && (
                <span className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                  {normalizeIndustry(lead.industry) ?? lead.industry}
                </span>
              )}
          </div>

          {/* Indicator cluster — all same 6x6 so the row stays tidy */}
          <div className="flex items-center gap-1 shrink-0">
            {hasNextStep && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10"
                    aria-label={t.admin.clients.oppSheet.nextStep}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] whitespace-normal">
                  <p className="text-xs font-medium">{t.admin.clients.oppSheet.nextStep}</p>
                  <p className="text-xs opacity-80 mt-1 leading-relaxed">
                    {opportunity.next_step}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {hasActionRequired && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/10"
                    aria-label={t.admin.clients.oppSheet.actionRequired}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] whitespace-normal">
                  <p className="text-xs font-medium">
                    {t.admin.clients.oppSheet.actionRequired}
                  </p>
                  <p className="text-xs opacity-80 mt-1 leading-relaxed">
                    {opportunity.client_action_required}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {missingFda && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/10"
                    aria-label={t.kanban.complianceBlockTitle}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs font-medium">{t.kanban.complianceBlockTitle}</p>
                  <p className="text-xs opacity-80 mt-1">{t.kanban.complianceBlockDesc}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {showRiskBadge && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md",
                      risk.level === "high" ? "bg-destructive/10" : "bg-chart-5/10",
                    )}
                    aria-label={
                      risk.level === "high"
                        ? t.kanban.riskHighTitle
                        : t.kanban.riskMediumTitle
                    }
                  >
                    {risk.level === "high" ? (
                      <Flame className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Globe2 className="h-3.5 w-3.5 text-chart-5" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] whitespace-normal">
                  <p className="text-xs font-medium">
                    {risk.level === "high"
                      ? t.kanban.riskHighTitle
                      : t.kanban.riskMediumTitle}
                    {risk.countryLabel ? ` · ${risk.countryLabel}` : ""}
                  </p>
                  <p className="text-xs opacity-80 mt-1 leading-relaxed">
                    {risk.reasons[locale][0]}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {unreadReplyCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="relative flex h-6 w-6 items-center justify-center rounded-md bg-chart-2/15"
                    aria-label={`${unreadReplyCount} phản hồi chưa đọc`}
                  >
                    <Mail className="h-3.5 w-3.5 text-chart-2" />
                    <span
                      className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-chart-2 px-0.5 text-[9px] font-bold leading-none text-white"
                      aria-hidden
                    >
                      {unreadReplyCount > 9 ? "9+" : unreadReplyCount}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">
                    {unreadReplyCount} phản hồi mới từ buyer
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {hasHsCode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-chart-3/10"
                    aria-label="HS Code"
                  >
                    <Package className="h-3.5 w-3.5 text-chart-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs font-medium">HS Code</p>
                  <p className="text-xs opacity-80 mt-1 font-mono">{lead?.hs_code}</p>
                  {lead?.main_product && (
                    <p className="text-xs opacity-80 mt-1">{lead.main_product}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}

            {hasPriority && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-chart-5/10"
                    aria-label="Priority rating"
                  >
                    <Star className="h-3.5 w-3.5 text-chart-5 fill-chart-5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">
                    LR Priority: {lead?.priority_rating}/5
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {isLowSeason && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/10"
                    aria-label="Low season"
                  >
                    <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs font-medium">Tháng thấp điểm</p>
                  <p className="text-xs opacity-80 mt-1">
                    Buyer thường mua ít vào tháng này ({lead?.top_low_months})
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {onEdit && (
              <button
                type="button"
                aria-label={t.admin.clients.oppSheet.editButton}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(opportunity)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: assignee + value on a single compact line */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {client?.company_name ?? client?.full_name ?? "—"}
            </span>
          </div>
          {opportunity.potential_value ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <DollarSign className="h-3 w-3 text-chart-4" />
              <span className="text-xs font-medium text-chart-4">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(opportunity.potential_value)}
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
