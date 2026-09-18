/**
 * Buyer Analysis Card Component
 *
 * Displays the persisted AI buyer analysis (scores) plus the approach
 * strategy, so an AE can understand a buyer at a glance before writing a
 * single word to them.
 *
 * Data source: `leads.buyer_analysis` / `leads.buyer_strategy` (migration 079),
 * snapshotted once when the Lead Researcher creates the buyer from ImportYeti
 * data. `strategy` is optional on purpose — it is produced by an LLM call and
 * can be missing (AI failure -> generateFallbackStrategy, or the LR submitted
 * the form before the background analysis finished) while the deterministic
 * scores are still present and still useful.
 */

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  MapPin,
  Target,
  AlertTriangle,
  MessageSquare,
  Calendar,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuyerAnalysisResult } from "@/lib/ai/buyer-analyzer"
import type { BuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

interface BuyerAnalysisCardProps {
  analysis: BuyerAnalysisResult
  /** Optional — see file header. Card renders scores-only when absent. */
  strategy?: BuyerStrategy | null
  locale?: "vi" | "en"
  /** When the snapshot was taken (`leads.buyer_analysis_at`). */
  generatedAt?: string | null
}

function ScoreBar({ 
  label, 
  score, 
  colorClass = "bg-primary",
  description,
}: { 
  label: string
  score: number
  colorClass?: string
  description?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{score}/100</span>
      </div>
      <Progress value={score} className="h-2" indicatorClassName={colorClass} />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function TrendIcon({ trend }: { trend: "increasing" | "stable" | "decreasing" }) {
  switch (trend) {
    case "increasing":
      return <TrendingUp className="h-4 w-4 text-green-500" />
    case "decreasing":
      return <TrendingDown className="h-4 w-4 text-red-500" />
    default:
      return <Minus className="h-4 w-4 text-yellow-500" />
  }
}

function RiskBadge({
  level,
  locale,
}: {
  level: "low" | "medium" | "high"
  locale: "vi" | "en"
}) {
  const variants = {
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  const labels = {
    low: locale === "vi" ? "Rủi ro thấp" : "Low risk",
    medium: locale === "vi" ? "Rủi ro vừa" : "Medium risk",
    high: locale === "vi" ? "Rủi ro cao" : "High risk",
  }

  return (
    <Badge variant="outline" className={cn("text-xs", variants[level])}>
      {labels[level]}
    </Badge>
  )
}

export function BuyerAnalysisCard({
  analysis,
  strategy,
  locale = "vi",
  generatedAt = null,
}: BuyerAnalysisCardProps) {
  const [isOpen, setIsOpen] = useState(true)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const { healthBreakdown, loyaltyBreakdown, vietnamBreakdown } = analysis
  
  // Determine score color classes
  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-green-500"
    if (score >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }
  
  // For loyalty, lower is better (easier to approach)
  const getLoyaltyColor = (score: number) => {
    if (score <= 40) return "bg-green-500"
    if (score <= 70) return "bg-yellow-500"
    return "bg-red-500"
  }

  const growthRate = healthBreakdown.growthRate ?? 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <CardTitle className="min-w-0 truncate text-base">
                  {t("Phân tích buyer (AI)", "AI buyer analysis")}
                </CardTitle>
                <Badge variant="secondary" className="max-w-[12rem] shrink-0 truncate text-xs">
                  {analysis.companyName}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Score Overview */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TrendIcon trend={healthBreakdown.riskLevel === "low" ? "increasing" : healthBreakdown.riskLevel === "high" ? "decreasing" : "stable"} />
                  <span className="text-sm font-medium">
                    {t("Sức khoẻ nhập hàng", "Buyer health")}
                  </span>
                  <RiskBadge level={healthBreakdown.riskLevel} locale={locale} />
                </div>
                <ScoreBar 
                  label="" 
                  score={analysis.healthScore} 
                  colorClass={getScoreColor(analysis.healthScore)}
                  description={t(
                    `Tăng trưởng ${growthRate > 0 ? "+" : ""}${growthRate}% so với năm trước`,
                    `Growth ${growthRate > 0 ? "+" : ""}${growthRate}% YoY`,
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t("Độ gắn bó với supplier", "Supplier loyalty")}
                  </span>
                </div>
                <ScoreBar 
                  label="" 
                  score={analysis.loyaltyScore} 
                  colorClass={getLoyaltyColor(analysis.loyaltyScore)}
                  description={
                    loyaltyBreakdown.topSupplierName
                      ? t(
                          `Supplier chính: ${loyaltyBreakdown.topSupplierName}${
                            loyaltyBreakdown.topSupplierTenure
                              ? ` (${loyaltyBreakdown.topSupplierTenure})`
                              : ""
                          }`,
                          `Top: ${loyaltyBreakdown.topSupplierName}${
                            loyaltyBreakdown.topSupplierTenure
                              ? ` (${loyaltyBreakdown.topSupplierTenure})`
                              : ""
                          }`,
                        )
                      : t("Chưa xác định được supplier chính", "No dominant supplier detected")
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "Điểm càng thấp = buyer càng dễ mở với supplier mới.",
                    "Lower score = buyer is more open to a new supplier.",
                  )}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t("Mức sẵn sàng với Việt Nam", "Vietnam readiness")}
                  </span>
                  {vietnamBreakdown.hasVnHistory && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {t("Đã từng mua từ VN", "Has VN history")}
                    </Badge>
                  )}
                </div>
                <ScoreBar 
                  label="" 
                  score={analysis.vietnamReadiness} 
                  colorClass={getScoreColor(analysis.vietnamReadiness)}
                  description={vietnamBreakdown.asiaExperience.length > 0 
                    ? t(
                        `Đã mua từ châu Á: ${vietnamBreakdown.asiaExperience.slice(0, 3).join(", ")}`,
                        `Asia experience: ${vietnamBreakdown.asiaExperience.slice(0, 3).join(", ")}`,
                      )
                    : t("Chưa có kinh nghiệm mua từ châu Á", "No Asia sourcing experience")
                  }
                />
              </div>
            </div>

            {/* Quick facts */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
              <span>
                {t("Tổng lô hàng", "Total shipments")}:{" "}
                <strong className="text-foreground">
                  {analysis.totalShipments?.toLocaleString(locale === "vi" ? "vi-VN" : "en-US") ?? "—"}
                </strong>
              </span>
              <span>
                {t("Năm hoạt động", "Years active")}:{" "}
                <strong className="text-foreground">{analysis.yearsActive ?? "—"}</strong>
              </span>
              {generatedAt && (
                <span>
                  {t("Phân tích lúc", "Analysed")}:{" "}
                  <strong className="text-foreground">
                    {new Date(generatedAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </span>
              )}
            </div>

            {/* Strategy Section — only when the LLM call succeeded */}
            {strategy ? (
              <div className="border-t pt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {t("Chiến lược tiếp cận", "Approach strategy")}
                  </span>
                  <Badge variant="default" className="text-xs">
                    {strategy.recommendedAngle}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("Độ tin cậy", "Confidence")}: {strategy.confidenceScore}%
                  </span>
                </div>

                {/* Summary */}
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md text-pretty">
                  {strategy.approachSummary}
                </p>

                {/* Talking Points */}
                {strategy.talkingPoints.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      <span>{t("Điểm nói chuyện", "Talking points")}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {strategy.talkingPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-600 mt-1">+</span>
                          <span className="min-w-0 text-pretty">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk Factors */}
                {strategy.riskFactors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>{t("Rủi ro cần lưu ý", "Risk factors")}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {strategy.riskFactors.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-yellow-600 mt-1">!</span>
                          <span className="min-w-0 text-pretty">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Timing */}
                <div className="flex items-start gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                  <Calendar className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <span className="text-blue-800 dark:text-blue-300 text-pretty">
                    <strong>{t("Thời điểm tốt:", "Best time:")}</strong> {strategy.timingSuggestion}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 border-t pt-4 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                <span className="text-pretty">
                  {t(
                    "Buyer này chưa có chiến lược tiếp cận do AI sinh ra (chỉ có điểm phân tích). Ba điểm ở trên vẫn dùng được để đánh giá buyer.",
                    "No AI-generated approach strategy for this buyer (scores only). The three scores above are still usable to assess the buyer.",
                  )}
                </span>
              </div>
            )}
            
            {/* Vietnam Suppliers Detail */}
            {vietnamBreakdown.hasVnHistory && vietnamBreakdown.vnSuppliers.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span>{t("Supplier Việt Nam đang dùng", "Existing Vietnam suppliers")}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {vietnamBreakdown.vnSuppliers.map((supplier, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/50 rounded-md">
                      <div className="font-medium break-words">{supplier.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(
                          `${supplier.shipments.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} lô hàng`,
                          `${supplier.shipments.toLocaleString()} shipments`,
                        )}
                        {supplier.firstYear && ` · ${t("từ", "since")} ${supplier.firstYear}`}
                        {supplier.businessLength && ` · ${supplier.businessLength}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
