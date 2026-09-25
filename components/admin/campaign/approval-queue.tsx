"use client"

// Approval queue (shadow mode) — nơi AE xem/chỉnh/duyệt hoặc từ chối draft AI.
// QA result hiển thị trực tiếp; draft bị QA chặn (status 'draft') không cho gửi.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2, X } from "lucide-react"
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
import { approveCampaignDraftAction, rejectCampaignDraftAction } from "@/app/admin/campaigns/actions"

export interface ApprovalDraft {
  id: string
  status: string
  campaign_step_number: number | null
  generated_subject: string | null
  generated_content_en: string | null
  translated_content_vi: string | null
  recipient_email: string | null
  created_at: string
  enrollment: {
    id: string
    state: string
    current_step_number: number
    lead: { company_name: string | null; contact_person: string | null; contact_email: string | null } | null
  } | null
}

export function ApprovalQueue({ drafts }: { drafts: ApprovalDraft[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<ApprovalDraft | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const pending = drafts.filter((d) => d.status === "pending_approval")
  const blocked = drafts.filter((d) => d.status !== "pending_approval")

  async function approve(draft: ApprovalDraft) {
    setBusyId(draft.id)
    const res = await approveCampaignDraftAction(draft.id)
    setBusyId(null)
    if (res.ok) {
      toast.success("Đã gửi email")
      router.refresh()
    } else {
      toast.error(res.message ?? `Lỗi: ${res.error}`)
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
          busy={busyId === d.id}
          onApprove={() => approve(d)}
          onReject={() => {
            setRejecting(d)
            setRejectReason("")
          }}
        />
      ))}
      {blocked.map((d) => (
        <DraftCard key={d.id} draft={d} busy={busyId === d.id} blocked />
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
  busy,
  blocked,
  onApprove,
  onReject,
}: {
  draft: ApprovalDraft
  busy?: boolean
  blocked?: boolean
  onApprove?: () => void
  onReject?: () => void
}) {
  const router = useRouter()
  const [subject, setSubject] = useState(draft.generated_subject ?? "")
  const [content, setContent] = useState(draft.generated_content_en ?? "")
  const [showVi, setShowVi] = useState(false)

  const lead = draft.enrollment?.lead
  const wordCount = content.split(/\s+/).filter(Boolean).length

  return (
    <Card className={blocked ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20" : ""}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-medium">{lead?.company_name ?? "(không rõ công ty)"}</span>
            <span className="text-muted-foreground"> · {lead?.contact_name ?? "—"} &lt;{lead?.contact_email ?? draft.recipient_email ?? "?"}&gt;</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">Step {draft.campaign_step_number ?? "?"}</Badge>
            {blocked ? (
              <Badge variant="outline" className="border-red-400 text-red-600">
                <AlertTriangle className="mr-1 h-3 w-3" /> QA chặn — KHÔNG gửi
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-400 text-emerald-600">Chờ duyệt</Badge>
            )}
            <Badge variant="outline">{wordCount} từ</Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`subject-${draft.id}`}>Subject</Label>
          <Input id={`subject-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={blocked} />
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
            disabled={blocked}
          />
          {showVi && draft.translated_content_vi && (
            <Textarea rows={8} className="font-mono text-xs" value={draft.translated_content_vi} readOnly />
          )}
        </div>

        {!blocked && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                // Edit được gửi kèm (approve action chấp nhận override).
                approveWithEdit(draft, subject, content, router)
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Duyệt &amp; gửi
            </Button>
            {onReject && (
              <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
                <X className="mr-2 h-4 w-4" /> Từ chối
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function approveWithEdit(draft: ApprovalDraft, subject: string, content: string, router: ReturnType<typeof useRouter>) {
  const edited =
    subject !== (draft.generated_subject ?? "") || content !== (draft.generated_content_en ?? "")
      ? { subject, content }
      : undefined
  const res = await approveCampaignDraftAction(draft.id, edited)
  if (res.ok) {
    toast.success(edited ? "Đã gửi (bản AE đã sửa)" : "Đã gửi")
    router.refresh()
  } else {
    toast.error(res.message ?? `Lỗi: ${res.error}`)
  }
}
