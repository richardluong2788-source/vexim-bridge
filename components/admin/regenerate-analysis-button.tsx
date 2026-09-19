"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles, Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { regenerateBuyerAnalysis } from "@/app/admin/buyers/actions"
import type { BuyerAnalysisResult } from "@/lib/ai/buyer-analyzer"
import type { BuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

interface Props {
  buyerId: string
  sourceRef: string | null
  locale?: "vi" | "en"
  /** Called when regeneration succeeds with fresh data — lets parent render BuyerAnalysisCard immediately without full page reload */
  onRegenerated?: (data: {
    analysis: BuyerAnalysisResult
    strategy: BuyerStrategy | null
    generatedAt: string
    model: string | null
  }) => void
  /** variant: "create" shows "Tạo phân tích AI" (for fallback/empty), "regenerate" shows "Chạy lại" */
  variant?: "create" | "regenerate"
  size?: "default" | "sm" | "lg" | "icon"
}

export function RegenerateAnalysisButton({
  buyerId,
  sourceRef,
  locale = "vi",
  onRegenerated,
  variant = "create",
  size = "default",
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hasLink = !!sourceRef?.trim()
  const isCreate = variant === "create"

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  function handleConfirm() {
    if (!hasLink) {
      toast.error(
        t(
          "Buyer này chưa có ImportYeti link. Hãy bổ sung link trước.",
          "This buyer has no ImportYeti link. Please add one first.",
        ),
      )
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await regenerateBuyerAnalysis(buyerId)
      if (!res.ok) {
        const raw = res.error
        // Strip prefix like "missing_importyeti_link: ..."
        const msg = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : raw
        setError(msg)
        toast.error(msg || t("Tạo phân tích thất bại", "Failed to generate analysis"))
        return
      }

      toast.success(
        t(
          `Đã tạo phân tích AI thành công${res.data.creditsRemaining != null ? ` (còn ${res.data.creditsRemaining} credits)` : ""}`,
          `Analysis generated${res.data.creditsRemaining != null ? ` (${res.data.creditsRemaining} credits left)` : ""}`,
        ),
      )
      setOpen(false)
      onRegenerated?.({
        analysis: res.data.analysis,
        strategy: res.data.strategy,
        generatedAt: res.data.generatedAt,
        model: res.data.model,
      })
      // Ensure server components revalidate as well
      router.refresh()
    })
  }

  // Disabled state when no source_ref
  if (!hasLink) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button variant="outline" size={size} disabled className="gap-2">
          <AlertTriangle className="h-4 w-4" />
          {isCreate
            ? t("Chưa có ImportYeti link", "No ImportYeti link")
            : t("Chạy lại phân tích AI", "Regenerate AI analysis")}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {t(
            "Cần bổ sung link ImportYeti (source_ref) để tạo phân tích. Ví dụ: https://importyeti.com/company/...",
            "Add an ImportYeti link (source_ref) to generate analysis. e.g. https://importyeti.com/company/...",
          )}
        </p>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isCreate ? "default" : "outline"}
          size={size}
          className="gap-2"
        >
          {isCreate ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isCreate
            ? t("Tạo / Chạy lại phân tích AI", "Create / Regenerate AI analysis")
            : t("Chạy lại phân tích AI", "Regenerate AI analysis")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isCreate
              ? t("Tạo phân tích AI đầy đủ?", "Generate full AI analysis?")
              : t("Chạy lại phân tích AI?", "Regenerate AI analysis?")}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {t(
              "Hệ thống sẽ quét lại dữ liệu ImportYeti từ link đã lưu và chạy AI để tạo bản phân tích đầy đủ (điểm sức khỏe, độ gắn bó, mức sẵn sàng VN + chiến lược tiếp cận). Thao tác này tốn 1 credit ImportYeti và sẽ ghi đè phân tích cũ (nếu có).",
              "The system will re-fetch ImportYeti data from the saved link and run AI to generate the full analysis (health, loyalty, Vietnam readiness + strategy). This costs 1 ImportYeti credit and will overwrite any existing analysis.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted p-3 text-xs">
          <p className="font-medium">ImportYeti link:</p>
          <p className="mt-1 break-all text-muted-foreground">{sourceRef}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-pretty">{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={pending} className="gap-2">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("Đang tạo...", "Generating...")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t("Xác nhận tạo (1 credit)", "Confirm (1 credit)")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
