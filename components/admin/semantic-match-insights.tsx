"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Brain, Sparkles, Search, ArrowRight } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SemanticMatch {
  clientId: string
  similarity: number
  matchedProduct: string
  sourceType?: string
}

interface SemanticInsightsProps {
  semanticScore?: number
  ruleBasedScore?: number
  hybridScore?: number
  scoringMode: "hybrid" | "rule-based"
  topMatches?: SemanticMatch[]
  locale?: "vi" | "en"
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SemanticMatchInsights({
  semanticScore,
  ruleBasedScore,
  hybridScore,
  scoringMode,
  topMatches = [],
  locale = "en",
}: SemanticInsightsProps) {
  const isHybrid = scoringMode === "hybrid"

  const labels = {
    title: locale === "vi" ? "AI Semantic Matching" : "AI Semantic Matching",
    hybrid: locale === "vi" ? "Kết hợp" : "Hybrid",
    ruleBased: locale === "vi" ? "Quy tắc" : "Rule-based",
    semantic: locale === "vi" ? "Ngữ nghĩa" : "Semantic",
    topMatches: locale === "vi" ? "Sản phẩm khớp nhất" : "Top Matching Products",
    similarity: locale === "vi" ? "Độ tương đồng" : "Similarity",
    noEmbeddings:
      locale === "vi"
        ? "Chưa có dữ liệu embedding. Hệ thống đang dùng rule-based matching."
        : "No embeddings available. Using rule-based matching.",
  }

  return (
    <div className="rounded-lg border bg-gradient-to-br from-violet-50/50 to-indigo-50/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
            <Brain className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {labels.title}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isHybrid ? "70% semantic + 30% rules" : labels.ruleBased}
            </p>
          </div>
        </div>
        <Badge
          variant={isHybrid ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isHybrid && "bg-violet-600 hover:bg-violet-700"
          )}
        >
          {isHybrid ? (
            <>
              <Sparkles className="mr-1 h-3 w-3" />
              {labels.hybrid}
            </>
          ) : (
            labels.ruleBased
          )}
        </Badge>
      </div>

      {/* Score Comparison */}
      {isHybrid && semanticScore !== undefined && ruleBasedScore !== undefined && (
        <div className="grid grid-cols-3 gap-2">
          <ScoreBox
            label={labels.semantic}
            score={semanticScore}
            color="violet"
          />
          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <ScoreBox
            label={labels.hybrid}
            score={hybridScore ?? 0}
            color="indigo"
            highlight
          />
        </div>
      )}

      {/* Not Hybrid - Show Message */}
      {!isHybrid && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <Search className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{labels.noEmbeddings}</p>
        </div>
      )}

      {/* Top Matches */}
      {isHybrid && topMatches.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">
            {labels.topMatches}
          </h5>
          <div className="space-y-1.5">
            {topMatches.slice(0, 3).map((match, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-md border p-2 text-xs",
                        "bg-white/60 hover:bg-white/80 transition-colors cursor-default"
                      )}
                    >
                      <span className="truncate max-w-[180px] font-medium">
                        {match.matchedProduct}
                      </span>
                      <SimilarityBadge similarity={match.similarity} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[250px]">
                    <p className="text-xs">{match.matchedProduct}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {labels.similarity}: {(match.similarity * 100).toFixed(1)}%
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function ScoreBox({
  label,
  score,
  color,
  highlight = false,
}: {
  label: string
  score: number
  color: "violet" | "indigo" | "slate"
  highlight?: boolean
}) {
  const colorClasses = {
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border p-2",
        colorClasses[color],
        highlight && "ring-2 ring-offset-1 ring-indigo-400"
      )}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-75">
        {label}
      </span>
      <span className="text-lg font-bold">{score.toFixed(0)}</span>
    </div>
  )
}

function SimilarityBadge({ similarity }: { similarity: number }) {
  const percent = similarity * 100
  const color =
    percent >= 80
      ? "bg-green-100 text-green-700"
      : percent >= 60
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700"

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
        color
      )}
    >
      {percent.toFixed(0)}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// Compact Version for Lists
// ---------------------------------------------------------------------------

export function SemanticMatchBadge({
  scoringMode,
  semanticScore,
  locale = "en",
}: {
  scoringMode: "hybrid" | "rule-based"
  semanticScore?: number
  locale?: "vi" | "en"
}) {
  if (scoringMode !== "hybrid" || semanticScore === undefined) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 text-xs text-violet-600">
            <Sparkles className="h-3 w-3" />
            <span className="font-medium">{semanticScore.toFixed(0)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {locale === "vi"
              ? `Điểm AI semantic: ${semanticScore.toFixed(0)}`
              : `AI Semantic Score: ${semanticScore.toFixed(0)}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
