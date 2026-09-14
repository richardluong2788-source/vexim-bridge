"use client"

/**
 * Admin-only dialog: manually assign a buyer to a specific AE, overriding
 * the AI matching recommendation.
 *
 * Shows each AE with their AI score for this buyer and current workload,
 * requires a reason whenever the chosen AE contradicts the AI's top pick,
 * and enforces the workload cap (super_admin may override). The actual
 * guards live server-side in lib/matching/manual-assignment.ts.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserCheck, AlertTriangle, Sparkles, Inbox } from "lucide-react"
import { toast } from "sonner"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  AE_WORKLOAD_HARD_CAP,
  AE_WORKLOAD_SOFT_WARN,
  MANUAL_ASSIGN_REASON_SCORE_GAP,
} from "@/lib/buyers/constants"
import {
  assignBuyerToAE,
  listAssignmentCandidates,
} from "@/app/admin/buyers/assignment-actions"
import type { Role } from "@/lib/supabase/types"

interface AssignBuyerDialogProps {
  buyerId: string
  buyerName: string
  currentRole: Role
  locale: "vi" | "en"
  /** Optional trigger; defaults to an outline button. */
  children?: React.ReactNode
  variant?: "outline" | "ghost" | "default"
  size?: "default" | "sm" | "icon"
  /** Called after a successful assignment (in addition to router.refresh). */
  onAssigned?: () => void
}

type Candidate = {
  id: string
  fullName: string | null
  email: string | null
  role: string | null
  activeEngagements: number
  openOpportunities: number
  matchScore: number | null
  hasPendingInbox: boolean
  isCurrentOwner: boolean
}

const ERROR_COPY: Record<string, { vi: string; en: string }> = {
  reason_required: {
    vi: "Cần nhập lý do khi gán khác đề xuất của AI",
    en: "A reason is required when overriding the AI recommendation",
  },
  ae_at_capacity: {
    vi: "AE này đã đạt giới hạn buyer đang xử lý",
    en: "This AE has reached the active-buyer workload cap",
  },
  already_owned_by_target: {
    vi: "Buyer này đã thuộc về AE được chọn",
    en: "This buyer already belongs to the selected AE",
  },
  engagement_already_closed: {
    vi: "Buyer đã đóng, không thể gán lại ở đây",
    en: "This buyer is already closed and cannot be reassigned here",
  },
  target_not_ae: {
    vi: "Người được gán phải là Account Executive",
    en: "The assignee must be an Account Executive",
  },
  forbidden: { vi: "Bạn không có quyền gán buyer", en: "You are not allowed to assign buyers" },
}

export function AssignBuyerDialog({
  buyerId,
  buyerName,
  currentRole,
  locale,
  children,
  variant = "outline",
  size = "sm",
  onAssigned,
}: AssignBuyerDialogProps) {
  const router = useRouter()
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [override, setOverride] = useState(false)

  const isSuperAdmin = currentRole === "super_admin"

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setSelectedId("")
    setReason("")
    setOverride(false)
    listAssignmentCandidates(buyerId).then((res) => {
      if (!active) return
      if (res.ok) {
        const sorted = [...res.data].sort((a, b) => {
          if (a.isCurrentOwner !== b.isCurrentOwner) return a.isCurrentOwner ? -1 : 1
          if (a.hasPendingInbox !== b.hasPendingInbox) return a.hasPendingInbox ? -1 : 1
          const sa = a.matchScore ?? -1
          const sb = b.matchScore ?? -1
          if (sb !== sa) return sb - sa
          return a.activeEngagements - b.activeEngagements
        })
        setCandidates(sorted)
      } else {
        toast.error(res.error)
        setOpen(false)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [open, buyerId])

  const selected = candidates.find((c) => c.id === selectedId) ?? null
  const topScore = candidates.reduce<number | null>(
    (max, c) => (c.matchScore === null ? max : Math.max(max ?? -1, c.matchScore)),
    null,
  )
  const contradictsAi =
    !!selected &&
    (selected.matchScore === null ||
      (topScore !== null && topScore - (selected.matchScore ?? 0) >= MANUAL_ASSIGN_REASON_SCORE_GAP))
  const reasonRequired = !selected?.isCurrentOwner && contradictsAi
  const atHardCap = !!selected && selected.activeEngagements >= AE_WORKLOAD_HARD_CAP
  const canSubmit =
    !!selected &&
    !saving &&
    (!reasonRequired || reason.trim().length > 0) &&
    (!atHardCap || (isSuperAdmin && override))

  async function handleSubmit() {
    if (!selected) return
    if (reasonRequired && !reason.trim()) {
      toast.error(t("Vui lòng nhập lý do gán khác đề xuất AI", "Please explain why you overrode the AI pick"))
      return
    }
    if (atHardCap && !(isSuperAdmin && override)) {
      toast.error(
        t(
          `AE này đã có ${AE_WORKLOAD_HARD_CAP} buyer đang xử lý`,
          `This AE already has ${AE_WORKLOAD_HARD_CAP} active buyers`,
        ),
      )
      return
    }

    setSaving(true)
    const res = await assignBuyerToAE({
      buyerId,
      aeId: selected.id,
      reason: reason.trim(),
      overrideCapacity: override,
    })
    setSaving(false)

    if (!res.ok) {
      const copy = ERROR_COPY[res.error]
      toast.error(copy ? (locale === "vi" ? copy.vi : copy.en) : res.error)
      return
    }
    toast.success(
      res.data.wasNewClaim
        ? t(`Đã gán "${buyerName}" cho AE được chọn`, `Assigned "${buyerName}" to the selected AE`)
        : t(`Đã chuyển "${buyerName}" cho AE được chọn`, `Transferred "${buyerName}" to the selected AE`),
    )
    setOpen(false)
    router.refresh()
    onAssigned?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant={variant} size={size} className="gap-1.5">
            <UserCheck className="h-4 w-4" />
            {t("Gán cho AE", "Assign to AE")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Gán buyer cho AE", "Assign buyer to an AE")}</DialogTitle>
          <DialogDescription>
            {t(
              `Gán thủ công "${buyerName}" cho một Account Executive cụ thể, thay vì để AI tự phân bổ.`,
              `Manually pin "${buyerName}" to a specific Account Executive instead of AI auto-routing.`,
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("Đang tải danh sách AE...", "Loading AEs...")}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {candidates.map((c) => {
                const active = selectedId === c.id
                const load = c.activeEngagements
                const loadTone =
                  load >= AE_WORKLOAD_HARD_CAP
                    ? "text-destructive"
                    : load >= AE_WORKLOAD_SOFT_WARN
                      ? "text-amber-600"
                      : "text-muted-foreground"
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {c.fullName || c.email || c.id}
                        </span>
                        {c.isCurrentOwner && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {t("Đang phụ trách", "Current owner")}
                          </Badge>
                        )}
                        {c.hasPendingInbox && !c.isCurrentOwner && (
                          <Badge variant="outline" className="shrink-0 gap-0.5 text-[10px]">
                            <Inbox className="h-2.5 w-2.5" />
                            {t("Có trong inbox", "In inbox")}
                          </Badge>
                        )}
                      </span>
                      <span className={cn("text-xs", loadTone)}>
                        {t(
                          `${load} buyer đang xử lý · ${c.openOpportunities} cơ hội mở`,
                          `${load} active buyers · ${c.openOpportunities} open opps`,
                        )}
                        {load >= AE_WORKLOAD_HARD_CAP &&
                          ` — ${t("đã quá tải", "over capacity")}`}
                      </span>
                    </span>
                    {c.matchScore === null ? (
                      <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                        {t("AI chưa chấm", "No AI score")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 gap-0.5 text-[10px]",
                          c.matchScore >= 75
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                            : c.matchScore >= 50
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                              : "border-muted text-muted-foreground",
                        )}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        {Math.round(c.matchScore)}
                      </Badge>
                    )}
                  </button>
                )
              })}
              {candidates.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("Chưa có AE nào trong hệ thống", "No AEs found")}
                </p>
              )}
            </div>

            {selected && (
              <>
                <div className="space-y-1.5">
                  <Label>
                    {reasonRequired
                      ? t("Lý do gán (bắt buộc — khác đề xuất AI)", "Reason (required — overrides AI)")
                      : t("Lý do (tùy chọn)", "Reason (optional)")}
                  </Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder={t(
                      "Ví dụ: Buyer do AE này gặp trực tiếp tại hội chợ, yêu cầu làm việc với người quen...",
                      "E.g. This AE met the buyer at a trade fair, they asked to work with them...",
                    )}
                  />
                  {reasonRequired && (
                    <p className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {t(
                        `AE này thấp hơn đề xuất tốt nhất của AI từ ${MANUAL_ASSIGN_REASON_SCORE_GAP} điểm trở lên (hoặc chưa được chấm điểm).`,
                        `This AE is ${MANUAL_ASSIGN_REASON_SCORE_GAP}+ points below the AI's top pick (or has no score).`,
                      )}
                    </p>
                  )}
                </div>

                {atHardCap &&
                  (isSuperAdmin ? (
                    <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700">
                      <Checkbox
                        checked={override}
                        onCheckedChange={(v) => setOverride(v === true)}
                        className="mt-0.5"
                      />
                      <span>
                        {t(
                          `AE này đã đạt giới hạn ${AE_WORKLOAD_HARD_CAP} buyer đang xử lý. Tôi xác nhận vẫn gán (quyền Super Admin).`,
                          `This AE is at the ${AE_WORKLOAD_HARD_CAP}-buyer cap. I confirm the override (Super Admin).`,
                        )}
                      </span>
                    </label>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {t(
                        "AE này đã quá tải — vui lòng chọn AE khác hoặc nhờ Super Admin.",
                        "This AE is over capacity — choose another AE or ask a Super Admin.",
                      )}
                    </p>
                  ))}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <UserCheck className="h-4 w-4" />
            {t("Xác nhận gán", "Confirm assignment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
