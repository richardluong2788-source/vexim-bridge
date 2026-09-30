"use client"

// Approval queue (shadow mode) — nơi AE xem/chỉnh/duyệt hoặc từ chối draft AI.
// QA result hiển thị trực tiếp; draft bị QA chặn (status 'draft') không cho gửi.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { approveCampaignDraftAction, regenerateCampaignDraftAction, rejectCampaignDraftAction } from "@/app/admin/campaigns/actions"

export interface ApprovalDraft {
  id: string
  status: string
  campaign_step_number: number | null
  generated_subject: string | null
  generated_content_en: string | null
  translated_content_vi: string | null
  recipient_email: string | null
  error_message?: string | null
  created_at: string
  enrollment: {
    id: string
    state: string
    current_step_number: number
    lead: { company_name: string | null; contact_person: string | null; contact_email: string | null } | null
  } | null
}

export function ApprovalQueue({
  drafts,
  senderName,
}: {
  drafts: ApprovalDraft[]
  /** Current viewer; approval sends with the authenticated approver's identity. */
  senderName: string | null
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<ApprovalDraft | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const pending = drafts.filter((d) => d.status === "pending_approval")
  const blocked = drafts.filter((d) => d.status !== "pending_approval")

  async function approve(draft: ApprovalDraft, edit?: { subject?: string; content?: string }) {
    setBusyId(draft.id)
    try {
      const res = await approveCampaignDraftAction(draft.id, edit)
      if (res.ok) {
        toast.success(edit ? "Đã gửi (bản AE đã sửa)" : "Đã gửi email")
        router.refresh()
      } else {
        toast.error(res.message ?? `Lỗi: ${res.error}`)
        if (res.error === "not_eligible") router.refresh()
      }
    } catch (error) {
      console.error("[campaign] approve draft:", error)
      toast.error(error instanceof Error ? `Không gửi được: ${error.message}` : "Không gửi được email. Vui lòng thử lại.")
    } finally {
      setBusyId(null)
    }
  }

  async function reject() {
    if (!rejecting) return
    setBusyId(rejecting.id)
    const res = await rejectCampaignDraftAction(rejecting.id, rejectReason)
    setBusyId(null)
    if (res.ok) {
      toast.success("Đã từ chối — scheduler sẽ sinh lại")
      setRejecting(null)
      setRejectReason("")
      router.refresh()
    } else {
      toast.error(res.message ?? "Không từ chối được")
    }
  }

  async function regenerate(draft: ApprovalDraft) {
    if (!window.confirm("Tạo lại email theo prompt hiện tại? Bản đang xem sẽ được thay thế, nhưng không tính là AI bị từ chối và không gửi email.")) return
    setBusyId(draft.id)
    const res = await regenerateCampaignDraftAction(draft.id)
    setBusyId(null)
    if (res.ok) {
      if (res.qaBlocked) {
        toast.error(`Đã tạo bản mới nhưng QA chặn gửi. ${res.qaMessage ?? ""}`)
      } else {
        toast.success(`Đã tạo lại draft (${res.riskLevel}), vẫn chờ AE duyệt.`)
      }
      router.refresh()
    } else {
      toast.error(res.message ?? "Không tạo lại được draft")
      if (res.error === "not_eligible") router.refresh()
    }
  }

  if (drafts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Không có draft nào chờ duyệt.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Hàng đợi duyệt email ({pending.length})</h2>
      {pending.map((d) => (
        <DraftCard
          key={d.id}
          draft={d}
          senderName={senderName}
          busy={busyId === d.id}
          onApprove={(edit) => approve(d, edit)}
          onRegenerate={() => regenerate(d)}
          onReject={() => {
            setRejecting(d)
            setRejectReason("")
          }}
        />
      ))}
      {blocked.map((d) => (
        <DraftCard
          key={d.id}
          draft={d}
          senderName={senderName}
          busy={busyId === d.id}
          blocked
          onRegenerate={() => regenerate(d)}
        />
      ))}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Từ chối draft</DialogTitle>
            <DialogDescription>
              Scheduler sẽ sinh lại draft khác sau ~1 giờ. Lý do được lưu vào audit log
              và là dữ liệu cho learning loop (AI thường sai gì?).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Lý do *</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: quá dài, CTA quá mạnh, sai góc tiếp cận..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={busyId === rejecting?.id || !rejectReason.trim()}
            >
              {busyId === rejecting?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DraftCard({
  draft,
  senderName,
  busy,
  blocked,
  onApprove,
  onRegenerate,
  onReject,
}: {
  draft: ApprovalDraft
  senderName: string | null
  busy?: boolean
  blocked?: boolean
  onApprove?: (edit?: { subject?: string; content?: string }) => Promise<void>
  onRegenerate?: () => void
  onReject?: () => void
}) {
  const previewContent = previewSenderName(draft.generated_content_en, senderName)
  const [subject, setSubject] = useState(draft.generated_subject ?? "")
  const [content, setContent] = useState(previewContent)
  const [showVi, setShowVi] = useState(false)
  const [approving, setApproving] = useState(false)

  // A draft may be regenerated in place; refresh the textarea while preserving
  // the viewer-specific sender-name preview.
  useEffect(() => setContent(previewContent), [previewContent])

  const lead = draft.enrollment?.lead
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const countryMismatch = draft.error_message?.startsWith("not_eligible_country:") ?? false
  const actionBusy = Boolean(busy || approving)

  async function handleApprove() {
    if (!onApprove || actionBusy) return
    const edited =
      subject !== (draft.generated_subject ?? "") || content !== previewContent
        ? { subject, content }
        : undefined
    setApproving(true)
    try {
      await onApprove(edited)
    } finally {
      setApproving(false)
    }
  }

  return (
    <Card className={blocked ? (countryMismatch ? "border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20" : "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20") : ""}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">{lead?.company_name ?? "(không rõ công ty)"}</span>
            <span className="text-muted-foreground"> · {lead?.contact_person ?? "—"} &lt;{lead?.contact_email ?? draft.recipient_email ?? "?"}&gt;</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">Step {draft.campaign_step_number ?? "?"}</Badge>
            {blocked ? (
              <Badge variant="outline" className={countryMismatch ? "border-amber-400 text-amber-700" : "border-red-400 text-red-600"}>
                <AlertTriangle className="mr-1 h-3 w-3" /> {countryMismatch ? "Sai quốc gia campaign — KHÔNG gửi" : "QA chặn — KHÔNG gửi"}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-400 text-emerald-600">Chờ duyệt</Badge>
            )}
            <Badge variant="outline">{wordCount} từ</Badge>
          </div>
        </div>
        {blocked && draft.error_message && (
          <p className={countryMismatch ? "text-xs text-amber-800 dark:text-amber-300" : "text-xs text-red-700 dark:text-red-300"}>
            {draft.error_message.replace(/^not_eligible_country:\s*/, "")}
            {countryMismatch && " Buyer đã bị loại khỏi campaign vì quốc gia hồ sơ không khớp quốc gia mục tiêu."}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`subject-${draft.id}`}>Subject</Label>
          <Input id={`subject-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={blocked || actionBusy} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`content-${draft.id}`}>Nội dung (EN — bản gửi)</Label>
            {draft.translated_content_vi && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowVi(!showVi)}>
                {showVi ? "Ẩn bản dịch" : "Xem bản dịch VI"}
              </Button>
            )}
          </div>
          <Textarea
            id={`content-${draft.id}`}
            rows={10}
            className="font-mono text-xs"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={blocked || actionBusy}
          />
          <p className={senderName ? "text-xs text-muted-foreground" : "text-xs text-amber-700 dark:text-amber-300"}>
            {senderName
              ? `Bản xem trước dùng tên ${senderName}; khi gửi, chữ ký sẽ khớp với hồ sơ của người bấm “Duyệt & gửi”.`
              : "Chưa có họ tên trong hồ sơ người gửi nên chữ ký vẫn hiện {{sender_name}}. Hãy cập nhật hồ sơ trước khi gửi."}
          </p>
          {showVi && draft.translated_content_vi && (
            <Textarea rows={8} className="font-mono text-xs" value={draft.translated_content_vi} readOnly />
          )}
        </div>

        {blocked && onRegenerate && (
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Tạo lại bằng AI
          </Button>
        )}

        {!blocked && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void handleApprove()}
              disabled={actionBusy || !onApprove}
              aria-busy={actionBusy}
            >
              {actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {approving ? "Đang gửi..." : busy ? "Đang xử lý..." : "Duyệt & gửi"}
            </Button>
            {onRegenerate && (
              <Button size="sm" variant="outline" onClick={onRegenerate} disabled={actionBusy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Tạo lại bằng AI
              </Button>
            )}
            {onReject && (
              <Button size="sm" variant="outline" onClick={onReject} disabled={actionBusy}>
                <X className="mr-2 h-4 w-4" /> Từ chối
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function previewSenderName(content: string | null, senderName: string | null): string {
  const source = content ?? ""
  const name = senderName?.trim()
  return name ? source.replace(/\{\{sender_name\}\}/gi, () => name) : source
}
