"use client"

import Link from "next/link"
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  Target,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getTierDescription } from "@/lib/ai/readiness-coach"
import type { ReadinessAssessment, ReadinessTier } from "@/lib/types/readiness"

interface ClientReadinessCardProps {
  assessment: ReadinessAssessment | null | undefined
  clientId: string
  language?: "vi" | "en"
}

export function ClientReadinessCard({
  assessment,
  clientId,
  language = "vi",
}: ClientReadinessCardProps) {
  const isVi = language === "vi"

  // No assessment yet
  if (!assessment) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" />
            {isVi ? "Đánh giá xuất khẩu" : "Export Readiness"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="rounded-full bg-muted p-3">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isVi ? "Chưa có đánh giá" : "No assessment yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isVi
                  ? "Client chưa hoàn thành đánh giá mức độ sẵn sàng xuất khẩu"
                  : "Client has not completed export readiness assessment"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // In progress assessment
  if (assessment.status === "in_progress") {
    const progress = ((assessment.current_step - 1) / 4) * 100

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            {isVi ? "Đánh giá xuất khẩu" : "Export Readiness"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isVi ? "Đang thực hiện" : "In Progress"}
              </span>
              <span className="font-medium">
                {isVi
                  ? `Bước ${assessment.current_step}/4`
                  : `Step ${assessment.current_step}/4`}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isVi
                ? "Client đang hoàn thành đánh giá"
                : "Client is completing the assessment"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Completed assessment
  const tier = assessment.tier ?? "pending"
  const score = assessment.readiness_score ?? 0
  const tierInfo = getTierDescription(tier)
  const gaps = assessment.gaps || []
  const criticalGaps = gaps.filter((g) => g.severity === "critical")

  const tierColors: Record<ReadinessTier, { text: string; bg: string; border: string }> = {
    gold: {
      text: "text-yellow-600",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
    },
    potential: {
      text: "text-blue-600",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
    },
    pending: {
      text: "text-orange-600",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
    },
  }

  const colors = tierColors[tier]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {tier === "gold" ? (
              <Trophy className="h-4 w-4 text-yellow-500" />
            ) : tier === "potential" ? (
              <TrendingUp className="h-4 w-4 text-blue-500" />
            ) : (
              <Target className="h-4 w-4 text-orange-500" />
            )}
            {isVi ? "Đánh giá xuất khẩu" : "Export Readiness"}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn("font-medium", colors.bg, colors.border, colors.text)}
          >
            {isVi ? tierInfo.titleVi : tierInfo.title}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border-2",
              colors.bg,
              colors.border
            )}
          >
            <span className={cn("text-xl font-bold", colors.text)}>{score}</span>
          </div>
          <div className="flex-1 space-y-1">
            <Progress value={score} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isVi ? tierInfo.descriptionVi : tierInfo.description}
            </p>
          </div>
        </div>

        {/* Critical Gaps Alert */}
        {criticalGaps.length > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {isVi
                  ? `${criticalGaps.length} vấn đề nghiêm trọng`
                  : `${criticalGaps.length} critical issue${criticalGaps.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {criticalGaps.slice(0, 2).map((gap, idx) => (
                <li key={idx} className="text-xs text-destructive/80">
                  • {isVi ? gap.titleVi : gap.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-lg font-semibold text-green-600">
              {(assessment.strengths || []).length}
            </p>
            <p className="text-xs text-muted-foreground">
              {isVi ? "Điểm mạnh" : "Strengths"}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-lg font-semibold text-orange-600">{gaps.length}</p>
            <p className="text-xs text-muted-foreground">
              {isVi ? "Cần cải thiện" : "Gaps"}
            </p>
          </div>
        </div>

        {/* View Full Report */}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link
            href={`/admin/clients/${clientId}/readiness`}
            target="_blank"
          >
            {isVi ? "Xem báo cáo đầy đủ" : "View Full Report"}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
