"use client"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Package,
  Building2,
  ShieldCheck,
  Briefcase,
  TrendingUp,
  Globe,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreBreakdownProps {
  totalScore: number
  productMatch: number
  industryMatch: number
  fdaCompliance: number
  workload: number
  winRate: number
  countryMatch: number
  locale?: "vi" | "en"
  showTotal?: boolean
  compact?: boolean
}

interface FactorRowProps {
  icon: React.ReactNode
  label: string
  labelVi: string
  value: number
  weight: number
  locale: "vi" | "en"
  tooltip?: string
}

// ---------------------------------------------------------------------------
// Labels & Configuration
// ---------------------------------------------------------------------------

const FACTOR_CONFIG = {
  productMatch: {
    icon: Package,
    label: "Product Match",
    labelVi: "Sản phẩm khớp",
    weight: 25,
    tooltip:
      "HS codes và keywords của buyer khớp với sản phẩm của client dưới quyền AE",
  },
  industryMatch: {
    icon: Building2,
    label: "Industry Match",
    labelVi: "Ngành khớp",
    weight: 20,
    tooltip: "Ngành hàng của buyer khớp với ngành của client dưới quyền AE",
  },
  fdaCompliance: {
    icon: ShieldCheck,
    label: "FDA Compliance",
    labelVi: "FDA còn hạn",
    weight: 10,
    tooltip: "Tỷ lệ client của AE có FDA còn hiệu lực",
  },
  workload: {
    icon: Briefcase,
    label: "Workload Capacity",
    labelVi: "Sức tải",
    weight: 20,
    tooltip: "AE càng ít opportunity đang xử lý, điểm càng cao",
  },
  winRate: {
    icon: TrendingUp,
    label: "Win Rate",
    labelVi: "Tỷ lệ thắng",
    weight: 20,
    tooltip: "Lịch sử win/loss của AE trong ngành này",
  },
  countryMatch: {
    icon: Globe,
    label: "Country/Region",
    labelVi: "Quốc gia",
    weight: 5,
    tooltip: "Kinh nghiệm làm việc với buyer từ quốc gia này",
  },
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MatchScoreBreakdown({
  totalScore,
  productMatch,
  industryMatch,
  fdaCompliance,
  workload,
  winRate,
  countryMatch,
  locale = "en",
  showTotal = true,
  compact = false,
}: ScoreBreakdownProps) {
  const scores = {
    productMatch,
    industryMatch,
    fdaCompliance,
    workload,
    winRate,
    countryMatch,
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600"
    if (score >= 50) return "text-amber-600"
    return "text-red-600"
  }

  const getProgressColor = (score: number) => {
    if (score >= 75) return "bg-green-500"
    if (score >= 50) return "bg-amber-500"
    return "bg-red-500"
  }

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {Object.entries(FACTOR_CONFIG).map(([key, config]) => {
            const value = scores[key as keyof typeof scores]
            const Icon = config.icon
            return (
              <Tooltip key={key}>
                <TooltipTrigger>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      getScoreColor(value)
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{value}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">
                    {locale === "vi" ? config.labelVi : config.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config.tooltip}
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-4">
      {showTotal && (
        <div className="flex items-center justify-between pb-2 border-b">
          <span className="text-sm font-medium">
            {locale === "vi" ? "Tổng điểm" : "Total Score"}
          </span>
          <span className={cn("text-2xl font-bold", getScoreColor(totalScore))}>
            {totalScore.toFixed(0)}
          </span>
        </div>
      )}

      <TooltipProvider>
        <div className="space-y-3">
          {Object.entries(FACTOR_CONFIG).map(([key, config]) => {
            const value = scores[key as keyof typeof scores]
            const Icon = config.icon
            const weightedValue = (value * config.weight) / 100

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {locale === "vi" ? config.labelVi : config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({config.weight}%)
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px]">
                      <p className="text-xs">{config.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", getScoreColor(value))}>
                      {value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (+{weightedValue.toFixed(1)})
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all",
                      getProgressColor(value)
                    )}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini Score Badge
// ---------------------------------------------------------------------------

export function MatchScoreBadge({
  score,
  locale = "en",
}: {
  score: number
  locale?: "vi" | "en"
}) {
  const getColor = () => {
    if (score >= 75) return "bg-green-500/10 text-green-700 border-green-500/20"
    if (score >= 50) return "bg-amber-500/10 text-amber-700 border-amber-500/20"
    return "bg-red-500/10 text-red-700 border-red-500/20"
  }

  const getLabel = () => {
    if (score >= 75)
      return locale === "vi" ? "Khớp cao" : "High match"
    if (score >= 50)
      return locale === "vi" ? "Khớp vừa" : "Medium match"
    return locale === "vi" ? "Khớp thấp" : "Low match"
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium",
        getColor()
      )}
    >
      <span className="font-bold">{score.toFixed(0)}</span>
      <span className="opacity-75">{getLabel()}</span>
    </div>
  )
}
