"use client"

import Link from "next/link"
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Target,
  Sparkles,
  FileText,
  ChevronUp,
  MessageSquareQuote,
  ExternalLink,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { getTierDescription } from "@/lib/ai/readiness-coach"
import type { ReadinessAssessment, ReadinessTier, ActionPlanItem } from "@/lib/types/readiness"

// ============================================================
// Types
// ============================================================

interface ReadinessResultsProps {
  assessment: ReadinessAssessment
  companyName?: string
  language: "vi" | "en"
}

// ============================================================
// Helper: Score Gauge with tier threshold lines
// ============================================================

function ScoreGauge({
  score,
  tier,
  isVi,
  potentialScore,
}: {
  score: number
  tier: ReadinessTier
  isVi: boolean
  potentialScore: number
}) {
  const tierInfo = getTierDescription(tier)

  const tierColors: Record<ReadinessTier, string> = {
    gold: "text-yellow-500",
    potential: "text-blue-500",
    pending: "text-orange-500",
  }

  const tierRingColors: Record<ReadinessTier, string> = {
    gold: "border-yellow-500",
    potential: "border-blue-500",
    pending: "border-orange-500",
  }

  const tierBgColors: Record<ReadinessTier, string> = {
    gold: "bg-yellow-500/10",
    potential: "bg-blue-500/10",
    pending: "bg-orange-500/10",
  }

  // Which next tier are they aiming for?
  const nextTierLabel =
    tier === "pending"
      ? isVi ? "Tiềm năng" : "Potential"
      : tier === "potential"
      ? isVi ? "Gold" : "Gold"
      : null
  const nextTierThreshold = tier === "pending" ? 50 : tier === "potential" ? 75 : null

  const pointsToNextTier =
    nextTierThreshold !== null ? nextTierThreshold - score : null
  const canReachNextTier =
    pointsToNextTier !== null && potentialScore >= nextTierThreshold!

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Score Circle */}
      <div className="relative">
        <div
          className={cn(
            "flex h-44 w-44 items-center justify-center rounded-full border-4",
            tierRingColors[tier],
            tierBgColors[tier]
          )}
        >
          <div className="text-center">
            <div className={cn("text-6xl font-bold tabular-nums", tierColors[tier])}>
              {score}
            </div>
            <div className="text-sm text-muted-foreground font-medium">/100</div>
          </div>
        </div>
        {tier === "gold" && (
          <Trophy className="absolute -top-2 -right-2 h-9 w-9 text-yellow-500 drop-shadow" />
        )}
      </div>

      {/* Tier Badge */}
      <div className="text-center space-y-1.5">
        <Badge
          variant="outline"
          className={cn(
            "px-4 py-1 text-sm font-semibold",
            tierBgColors[tier],
            tierColors[tier],
            tierRingColors[tier].replace("border-", "border-")
          )}
        >
          {isVi ? tierInfo.titleVi : tierInfo.title}
        </Badge>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          {isVi ? tierInfo.descriptionVi : tierInfo.description}
        </p>
      </div>

      {/* Gamification: "You're X points from Gold" */}
      {pointsToNextTier !== null && pointsToNextTier > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium w-full max-w-xs",
            canReachNextTier
              ? "border-green-500/40 bg-green-500/5 text-green-600 dark:text-green-400"
              : "border-muted bg-muted/30 text-muted-foreground"
          )}
        >
          <ChevronUp className="h-4 w-4 shrink-0" />
          <span>
            {canReachNextTier ? (
              isVi
                ? `Chỉ cần thêm ${pointsToNextTier} điểm nữa để đạt hạng ${nextTierLabel}!`
                : `Just ${pointsToNextTier} more points to reach ${nextTierLabel}!`
            ) : (
              isVi
                ? `Cần ${pointsToNextTier} điểm để lên hạng ${nextTierLabel}`
                : `Need ${pointsToNextTier} pts to reach ${nextTierLabel}`
            )}
          </span>
        </div>
      )}

      {/* Potential score after fixing all gaps */}
      {potentialScore > score && (
        <p className="text-xs text-muted-foreground text-center">
          {isVi
            ? `Nếu hoàn thành tất cả action plan: ${potentialScore}/100`
            : `After completing all actions: ${potentialScore}/100`}
        </p>
      )}
    </div>
  )
}

// ============================================================
// Helper: Single Action Item Card
// ============================================================

function ActionCard({
  action,
  isVi,
  priorityColor,
}: {
  action: ActionPlanItem
  isVi: boolean
  priorityColor: { bg: string; text: string; border: string }
}) {
  const title = isVi ? action.titleVi : action.title
  const description = isVi ? action.descriptionVi : action.description
  const advisorNote = isVi ? action.advisorNoteVi : action.advisorNote
  const ctaLabel = isVi ? action.veximCtaLabelVi : action.veximCtaLabel

  return (
    <li className={cn("rounded-lg border p-4 space-y-3", priorityColor.border, "bg-background")}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            priorityColor.bg,
            priorityColor.text
          )}
        >
          {action.order}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
        {action.estimatedTimeToComplete && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            {action.estimatedTimeToComplete}
          </div>
        )}
      </div>

      {/* Advisor note — the "human voice" of the AI */}
      {advisorNote && (
        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2.5">
          <MessageSquareQuote className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            {advisorNote}
          </p>
        </div>
      )}

      {/* Cross-sell CTA */}
      {action.veximCanHelp && ctaLabel && action.veximCtaUrl && (
        <Button
          asChild
          size="sm"
          variant="default"
          className="w-full gap-2 text-xs h-8"
        >
          <Link href={action.veximCtaUrl}>
            <Zap className="h-3.5 w-3.5" />
            {ctaLabel}
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Link>
        </Button>
      )}
    </li>
  )
}

// ============================================================
// Main Component
// ============================================================

export function ReadinessResults({
  assessment,
  companyName,
  language,
}: ReadinessResultsProps) {
  const isVi = language === "vi"

  const strengths = assessment.strengths || []
  const gaps = assessment.gaps || []
  const actionPlan = assessment.action_plan || []
  const totalScore = assessment.readiness_score ?? 0
  const tier = assessment.tier ?? "pending"

  // Calculate potential score after fixing all gaps
  const potentialBoost = gaps.reduce((sum, g) => sum + (g.scoreBoostIfFixed ?? 0), 0)
  const potentialScore = Math.min(100, totalScore + potentialBoost)

  const urgentActions = actionPlan.filter((a) => a.priority === "urgent")
  const importantActions = actionPlan.filter((a) => a.priority === "important")
  const niceToHaveActions = actionPlan.filter((a) => a.priority === "nice_to_have")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {isVi ? "Kết quả đánh giá" : "Assessment Results"}
        </h1>
        {companyName && (
          <p className="text-muted-foreground text-sm">
            {isVi ? `Dành cho ${companyName}` : `For ${companyName}`}
          </p>
        )}
      </div>

      {/* Main Score Card */}
      <Card>
        <CardContent className="pt-8 pb-6">
          <ScoreGauge
            score={totalScore}
            tier={tier}
            isVi={isVi}
            potentialScore={potentialScore}
          />
        </CardContent>
      </Card>

      {/* Strengths & Gaps Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-green-500" />
              {isVi ? "Điểm mạnh" : "Strengths"}
            </CardTitle>
            <CardDescription>
              {isVi
                ? "Những lợi thế của bạn trong thị trường xuất khẩu"
                : "Your advantages in the export market"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {strengths.length > 0 ? (
              <ul className="space-y-3">
                {strengths.slice(0, 5).map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">
                        {isVi ? strength.titleVi : strength.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isVi ? strength.descriptionVi : strength.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isVi
                  ? "Hoàn thành thêm các bước để xác định điểm mạnh"
                  : "Complete more steps to identify strengths"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Gaps with score boost preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-orange-500" />
              {isVi ? "Cần cải thiện" : "Areas to Improve"}
            </CardTitle>
            <CardDescription>
              {isVi
                ? "Giải quyết từng mục để tăng điểm số"
                : "Fix each item to boost your score"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gaps.length > 0 ? (
              <ul className="space-y-3">
                {gaps.slice(0, 5).map((gap, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    {gap.severity === "critical" ? (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    ) : gap.severity === "high" ? (
                      <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {isVi ? gap.titleVi : gap.title}
                        </p>
                        {gap.scoreBoostIfFixed !== undefined && gap.scoreBoostIfFixed > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-0.5 border-green-500/50 text-green-600 dark:text-green-400"
                          >
                            <TrendingUp className="h-2.5 w-2.5" />
                            +{gap.scoreBoostIfFixed} pts
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isVi ? gap.descriptionVi : gap.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">
                  {isVi ? "Không có gaps nghiêm trọng" : "No significant gaps identified"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {isVi ? "Kế hoạch hành động" : "Action Plan"}
          </CardTitle>
          <CardDescription>
            {isVi
              ? "Lộ trình cá nhân hóa để đưa bạn lên cấp độ tiếp theo"
              : "Your personalized roadmap to the next tier"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Urgent Actions */}
          {urgentActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {isVi ? "Khẩn cấp" : "Urgent"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isVi ? "Xử lý ngay — ảnh hưởng lớn nhất" : "Act now — highest impact"}
                </span>
              </div>
              <ul className="space-y-3">
                {urgentActions.map((action, idx) => (
                  <ActionCard
                    key={idx}
                    action={action}
                    isVi={isVi}
                    priorityColor={{
                      bg: "bg-destructive/10",
                      text: "text-destructive",
                      border: "border-red-200 dark:border-red-900/50",
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {urgentActions.length > 0 && importantActions.length > 0 && <Separator />}

          {/* Important Actions */}
          {importantActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 text-xs border-orange-500/50 text-orange-500"
                >
                  <TrendingUp className="h-3 w-3" />
                  {isVi ? "Quan trọng" : "Important"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isVi ? "Ưu tiên sau khi xử lý khẩn cấp" : "Prioritize after urgent items"}
                </span>
              </div>
              <ul className="space-y-3">
                {importantActions.map((action, idx) => (
                  <ActionCard
                    key={idx}
                    action={action}
                    isVi={isVi}
                    priorityColor={{
                      bg: "bg-orange-500/10",
                      text: "text-orange-500",
                      border: "border-orange-200 dark:border-orange-900/50",
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {(urgentActions.length > 0 || importantActions.length > 0) &&
            niceToHaveActions.length > 0 && <Separator />}

          {/* Nice to Have */}
          {niceToHaveActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  {isVi ? "Nên có" : "Nice to Have"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isVi ? "Cải thiện dần để vượt trội đối thủ" : "Gradually improve to stand out"}
                </span>
              </div>
              <ul className="space-y-3">
                {niceToHaveActions.map((action, idx) => (
                  <ActionCard
                    key={idx}
                    action={action}
                    isVi={isVi}
                    priorityColor={{
                      bg: "bg-muted",
                      text: "text-muted-foreground",
                      border: "border-border",
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {actionPlan.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-green-500">
              <CheckCircle2 className="h-6 w-6" />
              <p className="font-medium">
                {isVi
                  ? "Tuyệt vời! Bạn hoàn toàn sẵn sàng cho thị trường Mỹ."
                  : "Excellent! You're fully ready for the US market."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/client">
            {isVi ? "Về trang chủ" : "Go to Dashboard"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="/client/documents">
            {isVi ? "Quản lý hồ sơ" : "Manage Documents"}
            <FileText className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isVi
          ? `Hoàn thành lúc ${new Date(assessment.completed_at ?? "").toLocaleString("vi-VN")}`
          : `Completed on ${new Date(assessment.completed_at ?? "").toLocaleString("en-US")}`}
      </p>
    </div>
  )
}
