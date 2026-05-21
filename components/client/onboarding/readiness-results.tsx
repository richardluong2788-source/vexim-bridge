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
  Download,
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
import type { ReadinessAssessment, ReadinessTier } from "@/lib/types/readiness"

// ============================================================
// Types
// ============================================================

interface ReadinessResultsProps {
  assessment: ReadinessAssessment
  companyName?: string
  language: "vi" | "en"
}

// ============================================================
// Helper Components
// ============================================================

function ScoreGauge({
  score,
  tier,
  isVi,
}: {
  score: number
  tier: ReadinessTier
  isVi: boolean
}) {
  const tierInfo = getTierDescription(tier)

  const tierColors: Record<ReadinessTier, string> = {
    gold: "text-yellow-500",
    potential: "text-blue-500",
    pending: "text-orange-500",
  }

  const tierBgColors: Record<ReadinessTier, string> = {
    gold: "bg-yellow-500/10 border-yellow-500/30",
    potential: "bg-blue-500/10 border-blue-500/30",
    pending: "bg-orange-500/10 border-orange-500/30",
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Score Circle */}
      <div className="relative">
        <div
          className={cn(
            "flex h-40 w-40 items-center justify-center rounded-full border-4",
            tierBgColors[tier]
          )}
        >
          <div className="text-center">
            <div className={cn("text-5xl font-bold", tierColors[tier])}>
              {score}
            </div>
            <div className="text-sm text-muted-foreground">/100</div>
          </div>
        </div>
        {tier === "gold" && (
          <Trophy className="absolute -top-2 -right-2 h-8 w-8 text-yellow-500" />
        )}
      </div>

      {/* Tier Badge */}
      <div className="text-center space-y-2">
        <Badge
          variant="outline"
          className={cn(
            "px-4 py-1 text-base font-semibold",
            tierBgColors[tier],
            tierColors[tier]
          )}
        >
          {isVi ? tierInfo.titleVi : tierInfo.title}
        </Badge>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isVi ? tierInfo.descriptionVi : tierInfo.description}
        </p>
      </div>
    </div>
  )
}

function ScoreBreakdownCard({
  label,
  score,
  maxScore,
  isVi,
}: {
  label: string
  score: number
  maxScore: number
  isVi: boolean
}) {
  const percentage = Math.round((score / maxScore) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {score}/{maxScore}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
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

  // Calculate score breakdown from raw score
  // These are estimates based on the tier/score
  const totalScore = assessment.readiness_score ?? 0
  const tier = assessment.tier ?? "pending"

  const urgentActions = actionPlan.filter((a) => a.priority === "urgent")
  const importantActions = actionPlan.filter((a) => a.priority === "important")
  const niceToHaveActions = actionPlan.filter((a) => a.priority === "nice_to_have")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {isVi ? "Kết quả đánh giá" : "Assessment Results"}
        </h1>
        {companyName && (
          <p className="text-muted-foreground">
            {isVi ? `Dành cho ${companyName}` : `For ${companyName}`}
          </p>
        )}
      </div>

      {/* Main Score Card */}
      <Card>
        <CardContent className="pt-8 pb-6">
          <ScoreGauge score={totalScore} tier={tier} isVi={isVi} />
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
                      <p className="text-xs text-muted-foreground">
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

        {/* Gaps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-orange-500" />
              {isVi ? "Cần cải thiện" : "Areas to Improve"}
            </CardTitle>
            <CardDescription>
              {isVi
                ? "Những điểm cần bổ sung để tăng sức cạnh tranh"
                : "Areas to address for better competitiveness"}
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
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {isVi ? gap.titleVi : gap.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            gap.severity === "critical" && "border-red-500/50 text-red-500",
                            gap.severity === "high" && "border-orange-500/50 text-orange-500",
                            gap.severity === "medium" && "border-yellow-500/50 text-yellow-500",
                            gap.severity === "low" && "border-muted-foreground/50"
                          )}
                        >
                          {gap.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
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
              ? "Các bước tiếp theo để cải thiện mức độ sẵn sàng xuất khẩu"
              : "Next steps to improve your export readiness"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Urgent Actions */}
          {urgentActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {isVi ? "Khẩn cấp" : "Urgent"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {isVi ? "Cần xử lý ngay" : "Needs immediate attention"}
                </span>
              </div>
              <ul className="space-y-2 pl-4">
                {urgentActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-xs font-medium text-destructive">
                      {action.order}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {isVi ? action.titleVi : action.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isVi ? action.descriptionVi : action.description}
                      </p>
                      {action.veximCanHelp && action.veximServiceName && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {action.veximServiceName}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {urgentActions.length > 0 && importantActions.length > 0 && (
            <Separator />
          )}

          {/* Important Actions */}
          {importantActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 border-orange-500/50 text-orange-500">
                  <TrendingUp className="h-3 w-3" />
                  {isVi ? "Quan trọng" : "Important"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {isVi ? "Ưu tiên cao" : "High priority"}
                </span>
              </div>
              <ul className="space-y-2 pl-4">
                {importantActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-medium text-orange-500">
                      {action.order}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {isVi ? action.titleVi : action.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isVi ? action.descriptionVi : action.description}
                      </p>
                      {action.veximCanHelp && action.veximServiceName && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {action.veximServiceName}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(urgentActions.length > 0 || importantActions.length > 0) &&
            niceToHaveActions.length > 0 && <Separator />}

          {/* Nice to Have Actions */}
          {niceToHaveActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {isVi ? "Nên có" : "Nice to Have"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {isVi ? "Cải thiện dần" : "Gradual improvements"}
                </span>
              </div>
              <ul className="space-y-2 pl-4">
                {niceToHaveActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {action.order}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {isVi ? action.titleVi : action.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isVi ? action.descriptionVi : action.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionPlan.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-green-500">
              <CheckCircle2 className="h-6 w-6" />
              <p className="font-medium">
                {isVi
                  ? "Tuyệt vời! Bạn đã sẵn sàng cho thị trường Mỹ."
                  : "Excellent! You're ready for the US market."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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

      {/* Completion Note */}
      <p className="text-center text-xs text-muted-foreground">
        {isVi
          ? `Hoàn thành lúc ${new Date(assessment.completed_at ?? "").toLocaleString("vi-VN")}`
          : `Completed on ${new Date(assessment.completed_at ?? "").toLocaleString("en-US")}`}
      </p>
    </div>
  )
}
