"use client"

import { useState, useEffect } from "react"
import {
  FileCheck2,
  FileX2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { DocumentGapAnalysis } from "@/lib/ai/document-advisor"

interface Props {
  opportunityId: string
  clientId: string
  open: boolean
}

export function DocumentAdvisorSection({ opportunityId, clientId, open }: Props) {
  const [analysis, setAnalysis] = useState<DocumentGapAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function loadAnalysis() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/documents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      })

      if (!response.ok) throw new Error("Failed to analyze documents")

      const data = await response.json()
      setAnalysis(data)
    } catch (err) {
      console.error("[v0] Document analysis error:", err)
      setError("Không thể phân tích hồ sơ")
    } finally {
      setLoading(false)
    }
  }

  // Load on first open
  useEffect(() => {
    if (open && !analysis && !loading) {
      loadAnalysis()
    }
  }, [open])

  if (!open) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-primary" />
          AI Document Advisor
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={loadAnalysis}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {loading && !analysis && (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-5 w-5" />
          <span className="ml-2 text-sm text-muted-foreground">
            Đang phân tích hồ sơ cần thiết...
          </span>
        </div>
      )}

      {error && !analysis && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={loadAnalysis}>
            Thử lại
          </Button>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className={cn(
            "p-4 rounded-lg border",
            analysis.summary.readinessScore >= 80
              ? "border-green-200 bg-green-50"
              : analysis.summary.readinessScore >= 50
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sản phẩm Buyer
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {analysis.buyerProduct}
                </p>
                {analysis.hsCode && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    HS Code: {analysis.hsCode}
                  </p>
                )}
                {/* Market Badge */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px] px-2">
                    {analysis.destinationCountry}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-2 bg-blue-100 text-blue-800"
                  >
                    {getMarketLabel(analysis.destinationMarket)}
                  </Badge>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold" style={{
                  color: analysis.summary.readinessScore >= 80 ? '#16a34a' :
                         analysis.summary.readinessScore >= 50 ? '#d97706' : '#dc2626'
                }}>
                  {analysis.summary.readinessScore}%
                </div>
                <p className="text-xs text-muted-foreground">Độ sẵn sàng</p>
              </div>
            </div>

            <Progress
              value={analysis.summary.readinessScore}
              className="h-2 mt-3"
            />

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <StatBadge
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                label="Hợp lệ"
                value={analysis.summary.valid}
                variant="success"
              />
              <StatBadge
                icon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
                label="Sắp hết hạn"
                value={analysis.summary.expiringSoon}
                variant="warning"
              />
              <StatBadge
                icon={<XCircle className="h-3.5 w-3.5 text-red-600" />}
                label="Hết hạn"
                value={analysis.summary.expired}
                variant="error"
              />
              <StatBadge
                icon={<FileX2 className="h-3.5 w-3.5 text-gray-600" />}
                label="Còn thiếu"
                value={analysis.summary.missing}
                variant="neutral"
              />
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-900 mb-1">
                  Gợi ý từ AI
                </p>
                <p className="text-sm text-blue-800 whitespace-pre-line">
                  {analysis.aiRecommendation}
                </p>
              </div>
            </div>
          </div>

          {/* Document Status List */}
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Chi tiết hồ sơ ({analysis.documentStatus.length})</span>
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {analysis.documentStatus.map((doc) => (
                  <DocumentStatusRow key={doc.code} doc={doc} clientId={clientId} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </section>
  )
}

// Helper to get market display label
function getMarketLabel(market: string): string {
  const labels: Record<string, string> = {
    US: "FDA/USDA",
    EU: "CE/REACH",
    CN: "CCC/GACC",
    JP: "JIS/MHLW",
    KR: "KC/MFDS",
    ASEAN: "ATIGA",
    OTHER: "Standard",
  }
  return labels[market] || market
}

function StatBadge({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode
  label: string
  value: number
  variant: "success" | "warning" | "error" | "neutral"
}) {
  return (
    <div className={cn(
      "flex flex-col items-center p-2 rounded-md",
      variant === "success" && "bg-green-100",
      variant === "warning" && "bg-amber-100",
      variant === "error" && "bg-red-100",
      variant === "neutral" && "bg-gray-100"
    )}>
      {icon}
      <span className="text-lg font-bold mt-1">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

function DocumentStatusRow({
  doc,
  clientId,
}: {
  doc: DocumentGapAnalysis["documentStatus"][0]
  clientId: string
}) {
  const statusConfig = {
    has_valid: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      badge: "Hợp lệ",
      badgeVariant: "default" as const,
      bgColor: "bg-green-50 border-green-200",
    },
    has_expiring: {
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      badge: "Sắp hết hạn",
      badgeVariant: "secondary" as const,
      bgColor: "bg-amber-50 border-amber-200",
    },
    has_expired: {
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      badge: "Hết hạn",
      badgeVariant: "destructive" as const,
      bgColor: "bg-red-50 border-red-200",
    },
    missing: {
      icon: <FileX2 className="h-4 w-4 text-gray-500" />,
      badge: "Thiếu",
      badgeVariant: "outline" as const,
      bgColor: "bg-gray-50 border-gray-200",
    },
  }

  const config = statusConfig[doc.status]

  return (
    <div className={cn(
      "p-3 rounded-lg border flex items-start gap-3",
      config.bgColor
    )}>
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {doc.nameVi}
          </span>
          <Badge
            variant={config.badgeVariant}
            className={cn(
              "text-[10px] px-1.5 py-0",
              doc.priority === "critical" && doc.status === "missing" && "bg-red-600 text-white"
            )}
          >
            {config.badge}
          </Badge>
          {doc.priority === "critical" && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Bắt buộc
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{doc.name}</p>
        <p className="text-xs text-foreground/80 mt-1 italic">{doc.action}</p>

        {doc.clientDoc && doc.clientDoc.expiresAt && (
          <p className="text-xs text-muted-foreground mt-1">
            {doc.status === "has_expiring" || doc.status === "has_expired"
              ? `Hết hạn: ${new Date(doc.clientDoc.expiresAt).toLocaleDateString("vi-VN")}`
              : `Còn hạn đến: ${new Date(doc.clientDoc.expiresAt).toLocaleDateString("vi-VN")}`}
          </p>
        )}
      </div>

      {doc.status === "missing" && (
        <a
          href={`/admin/clients/${clientId}`}
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
          Thêm
        </a>
      )}
    </div>
  )
}
