"use client"

/**
 * Claim bar — the AI match proposal, decided on the buyer's own page.
 *
 * This used to be a pair of buttons on the inbox card. The inbox is a worklist
 * now (no work happens there), so the decision moved to the page where the AE
 * can actually evaluate it: they read the analysis and the ImportYeti data
 * first, then claim or reject.
 *
 * Claiming hands the buyer to this AE's "Đang xử lý" queue; rejecting records
 * why, which is the signal the matcher learns from — so the reason is asked for
 * by name rather than being a free-text afterthought.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { claimBuyer } from "@/app/admin/ae-inbox/engagement-actions"
import { rejectMatch } from "@/app/admin/buyers/matching-actions"

export interface PendingMatch {
  id: string
  priority: string
  expires_at: string
  account_manager_id: string
  /** AE the matcher proposed, when the viewer is not them (admins). */
  proposedAeName?: string | null
}

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  low: "bg-slate-500/10 text-slate-600 border-slate-500/20",
}

export function BuyerClaimBar({
  match,
  buyerName,
  locale,
  readOnly = false,
}: {
  match: PendingMatch
  buyerName: string
  locale: "vi" | "en"
  /** Lead Researchers monitor matching; they decide nothing here. */
  readOnly?: boolean
}) {
  const router = useRouter()
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const [pending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")

  const daysLeft = Math.ceil(
    (new Date(match.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  )

  function handleClaim() {
    startTransition(async () => {
      const result = await claimBuyer(match.id)
      if (!result.ok) {
        toast.error(t(`Lỗi: ${result.error}`, `Error: ${result.error}`))
        return
      }
      toast.success(
        t("Đã nhận buyer — bắt đầu bằng email mở đầu", "Buyer claimed — start with the opening email"),
      )
      // The engagement now exists, so this page swaps the claim bar for the
      // stage action bar: "Soạn email mở đầu" appears right here.
      router.refresh()
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectMatch({
        inboxItemId: match.id,
        reason: reason.trim() || undefined,
      })
      if (!result.ok) {
        toast.error(t(`Lỗi: ${result.error}`, `Error: ${result.error}`))
        return
      }
      toast.success(t("Đã từ chối đề xuất", "Match rejected"))
      setRejectOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        {t("AI đề xuất buyer này cho bạn", "The matcher proposed this buyer for you")}
      </span>

      <Badge variant="outline" className={`text-xs ${PRIORITY_TONE[match.priority] ?? ""}`}>
        {match.priority === "high"
          ? t("Ưu tiên cao", "High priority")
          : match.priority === "medium"
            ? t("Trung bình", "Medium")
            : t("Thấp", "Low")}
      </Badge>

      {match.proposedAeName && (
        <span className="text-xs text-muted-foreground">
          {t(`Đề xuất cho ${match.proposedAeName}`, `Proposed for ${match.proposedAeName}`)}
        </span>
      )}

      <span className="text-xs text-muted-foreground">
        {daysLeft <= 0
          ? t("Đề xuất đã hết hạn", "Proposal expired")
          : t(`Còn ${daysLeft} ngày để quyết định`, `${daysLeft} days left to decide`)}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {readOnly ? (
          <span className="text-xs text-muted-foreground">
            {t("Chế độ chỉ xem — chỉ AE quyết định được.", "Read-only — only an AE can decide.")}
          </span>
        ) : (
          <>
            <Button size="sm" className="gap-2" onClick={handleClaim} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t("Nhận buyer", "Claim buyer")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setReason("")
                setRejectOpen(true)
              }}
              disabled={pending}
            >
              <X className="h-4 w-4" />
              {t("Từ chối đề xuất", "Reject")}
            </Button>
          </>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Từ chối đề xuất này?", "Reject this match?")}</DialogTitle>
            <DialogDescription>
              {t(
                `${buyerName} sẽ không vào danh sách đang xử lý của bạn. Lý do được lưu lại để bộ máy match học từ đó.`,
                `${buyerName} will not enter your in-progress list. The reason is kept so the matcher can learn from it.`,
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              "Vì sao không phù hợp? (ví dụ: sản phẩm không khớp client nào)",
              "Why doesn't it fit? (e.g. no client matches the product)",
            )}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>
              {t("Giữ lại", "Keep it")}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Từ chối đề xuất", "Reject match")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
