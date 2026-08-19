"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { runAIMatching } from "@/app/admin/buyers/matching-actions"
import type { MatchingResult } from "@/lib/matching/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunAIMatchButtonProps {
  buyerId: string
  buyerName: string
  locale?: "vi" | "en"
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RunAIMatchButton({
  buyerId,
  buyerName,
  locale = "en",
  variant = "outline",
  size = "sm",
  className,
}: RunAIMatchButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [result, setResult] = useState<MatchingResult | null>(null)

  const handleRunMatch = () => {
    startTransition(async () => {
      const response = await runAIMatching(buyerId)

      if (response.ok) {
        setResult(response.data)
        setDialogOpen(true)
        router.refresh()
      } else {
        toast.error(
          locale === "vi"
            ? `Lỗi matching: ${response.error}`
            : `Matching error: ${response.error}`
        )
      }
    })
  }

  const topCandidate = result?.topCandidate
  const hasAutoAssigned = result?.autoAssigned

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleRunMatch}
        disabled={pending}
        className={className}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        {pending
          ? locale === "vi"
            ? "Đang match..."
            : "Matching..."
          : locale === "vi"
            ? "AI Match"
            : "AI Match"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {locale === "vi" ? "Kết quả AI Matching" : "AI Matching Results"}
            </DialogTitle>
            <DialogDescription>
              {locale === "vi"
                ? `Buyer "${buyerName}" đã được AI phân tích và match với các AE phù hợp.`
                : `Buyer "${buyerName}" has been analyzed and matched with suitable AEs.`}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {locale === "vi" ? "Tổng số AE được đánh giá" : "Total AEs evaluated"}
                  </p>
                  <p className="text-2xl font-bold">{result.scores.length}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {locale === "vi" ? "Đề xuất inbox" : "Inbox suggestions"}
                  </p>
                  <p className="text-2xl font-bold">{result.inboxItems.length}</p>
                </div>
              </div>

              {/* Auto-assigned notification */}
              {hasAutoAssigned && topCandidate && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-700">
                      {locale === "vi" ? "Đã tự động gán!" : "Auto-assigned!"}
                    </p>
                    <p className="text-xs text-green-600">
                      {locale === "vi"
                        ? `AE có điểm cao nhất (${topCandidate.totalScore.toFixed(0)}) đã được tự động chọn.`
                        : `Top scoring AE (${topCandidate.totalScore.toFixed(0)}) was automatically assigned.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Top candidates */}
              {result.scores.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {locale === "vi" ? "Top AE phù hợp:" : "Top matching AEs:"}
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {result.scores.slice(0, 5).map((score, idx) => (
                      <div
                        key={score.accountManagerId}
                        className="flex items-center justify-between p-2 rounded-md bg-background border"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-5">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-medium">
                            {score.accountManagerName || score.accountManagerId.slice(0, 8) + "..."}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              score.recommendation === "auto_assign"
                                ? "bg-green-500/10 text-green-700 border-green-500/20"
                                : score.recommendation === "inbox"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                  : "bg-slate-500/10 text-slate-700 border-slate-500/20"
                            }
                          >
                            {/* "auto_assign" here only reflects a high raw
                                score (>= auto_assign threshold) — the buyer
                                still lands in every qualifying AE's inbox
                                for the shortlist, it is never actually
                                auto-assigned to a single AE. */}
                            {score.recommendation === "auto_assign"
                              ? locale === "vi"
                                ? "Đề xuất mạnh"
                                : "Top pick"
                              : score.recommendation === "inbox"
                                ? locale === "vi"
                                  ? "Inbox"
                                  : "Inbox"
                                : locale === "vi"
                                  ? "Bỏ qua"
                                  : "Skip"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={isNaN(score.totalScore) ? 0 : score.totalScore}
                            className="h-2 w-16"
                          />
                          <span className="text-sm font-bold w-8 text-right">
                            {isNaN(score.totalScore) ? "—" : score.totalScore.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <X className="h-5 w-5 text-amber-600" />
                  <p className="text-sm text-amber-700">
                    {locale === "vi"
                      ? "Không có AE nào đủ điều kiện match."
                      : "No AEs qualified for matching."}
                  </p>
                </div>
              )}

              {/* Inbox notification */}
              {result.inboxItems.length > 0 && !hasAutoAssigned && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">
                      {locale === "vi"
                        ? `${result.inboxItems.length} AE đã nhận được đề xuất`
                        : `${result.inboxItems.length} AEs received match suggestions`}
                    </p>
                    <p className="text-xs text-blue-600">
                      {locale === "vi"
                        ? "Các AE sẽ thấy buyer này trong inbox và có thể chọn client để tạo opportunity."
                        : "AEs will see this buyer in their inbox and can select a client to create an opportunity."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)}>
              {locale === "vi" ? "Đóng" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
