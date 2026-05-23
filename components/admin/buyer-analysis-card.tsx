/**
 * Buyer Analysis Card Component
 * 
 * Displays AI buyer analysis results with scores and strategy recommendations.
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
  strategy: BuyerStrategy
  locale?: "vi" | "en"
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

function RiskBadge({ level }: { level: "low" | "medium" | "high" }) {
  const variants = {
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  const labels = { low: "Low Risk", medium: "Medium Risk", high: "High Risk" }
  
  return (
    <Badge variant="outline" className={cn("text-xs", variants[level])}>
      {labels[level]}
    </Badge>
  )
}

export function BuyerAnalysisCard({ analysis, strategy, locale = "vi" }: BuyerAnalysisCardProps) {
  const [isOpen, setIsOpen] = useState(true)
  
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {locale === "vi" ? "AI Buyer Analysis" : "AI Buyer Analysis"}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {analysis.companyName}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                <div className="flex items-center gap-2">
                  <TrendIcon trend={healthBreakdown.riskLevel === "low" ? "increasing" : healthBreakdown.riskLevel === "high" ? "decreasing" : "stable"} />
                  <span className="text-sm font-medium">Health Score</span>
                  <RiskBadge level={healthBreakdown.riskLevel} />
                </div>
                <ScoreBar 
                  label="" 
                  score={analysis.healthScore} 
                  colorClass={getScoreColor(analysis.healthScore)}
                  description={`Growth: ${healthBreakdown.growthRate > 0 ? "+" : ""}${healthBreakdown.growthRate}% YoY`}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Supplier Loyalty</span>
                </div>
                <ScoreBar 
                  label="" 
                  score={analysis.loyaltyScore} 
                  colorClass={getLoyaltyColor(analysis.loyaltyScore)}
                  description={`Top: ${loyaltyBreakdown.topSupplierName} (${loyaltyBreakdown.topSupplierTenure})`}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Vietnam Readiness</span>
                  {vietnamBreakdown.hasVnHistory && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Has VN History
                    </Badge>
                  )}
                </div>
                <ScoreBar 
                  label="" 
                  score={analysis.vietnamReadiness} 
                  colorClass={getScoreColor(analysis.vietnamReadiness)}
                  description={vietnamBreakdown.asiaExperience.length > 0 
                    ? `Asia exp: ${vietnamBreakdown.asiaExperience.slice(0, 3).join(", ")}`
                    : "No Asia experience"
                  }
                />
              </div>
            </div>
            
            {/* Strategy Section */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {locale === "vi" ? "Chiến Lược Tiếp Cận" : "Approach Strategy"}
                </span>
                <Badge variant="default" className="text-xs">
                  {strategy.recommendedAngle}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  Confidence: {strategy.confidenceScore}%
                </span>
              </div>
              
              {/* Summary */}
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {strategy.approachSummary}
              </p>
              
              {/* Talking Points */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span>{locale === "vi" ? "Điểm Nói Chuyện" : "Talking Points"}</span>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {strategy.talkingPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">+</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Risk Factors */}
              {strategy.riskFactors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span>{locale === "vi" ? "Rủi Ro Cần Lưu Ý" : "Risk Factors"}</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {strategy.riskFactors.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">!</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Timing */}
              <div className="flex items-start gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                <Calendar className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <span className="text-blue-800 dark:text-blue-300">
                  <strong>{locale === "vi" ? "Thời Điểm Tốt:" : "Best Time:"}</strong> {strategy.timingSuggestion}
                </span>
              </div>
            </div>
            
            {/* Vietnam Suppliers Detail */}
            {vietnamBreakdown.hasVnHistory && vietnamBreakdown.vnSuppliers.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span>{locale === "vi" ? "Supplier Việt Nam Đã Có" : "Existing Vietnam Suppliers"}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {vietnamBreakdown.vnSuppliers.map((supplier, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/50 rounded-md">
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {supplier.shipments.toLocaleString()} shipments
                        {supplier.firstYear && ` | Since ${supplier.firstYear}`}
                        {supplier.businessLength && ` | ${supplier.businessLength}`}
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
