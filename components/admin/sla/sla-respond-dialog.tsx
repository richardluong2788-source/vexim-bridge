"use client"

import { useState, useTransition } from "react"
import { Loader2, MessageSquare, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  resolveClientRequest,
  respondToClientRequest,
} from "@/app/admin/sla/actions"

interface Props {
  requestId: string
  /** True if first_response_at is already set — only "resolve" remains. */
  alreadyResponded: boolean
}

/**
 * Two-action button: respond (logs first_response_at) and resolve.
 * Both call existing server actions in app/admin/sla/actions.ts.
 */
export function SlaRespondDialog({ requestId, alreadyResponded }: Props) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submitRespond() {
    startTransition(async () => {
      const res = await respondToClientRequest({
        request_id: requestId,
        note: note.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể ghi phản hồi")
        return
      }
      toast.success("Đã ghi nhận phản hồi đầu tiên")
      setOpen(false)
      setNote("")
      router.refresh()
    })
  }

  function submitResolve() {
    startTransition(async () => {
      const res = await resolveClientRequest({ request_id: requestId })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể đóng yêu cầu")
        return
      }
      toast.success("Đã đóng yêu cầu")
      router.refresh()
    })
  }

  if (alreadyResponded) {
    // Just a resolve button — no dialog needed.
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 gap-1 text-xs"
        onClick={submitResolve}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        Đóng
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-7 px-2 gap-1 text-xs">
          <MessageSquare className="h-3 w-3" />
          Phản hồi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận phản hồi đầu tiên</DialogTitle>
          <DialogDescription>
            Đánh dấu thời điểm bạn lần đầu trả lời client. SLA M4 đo từ{" "}
            <code className="text-xs bg-muted rounded px-1">received_at</code>{" "}
            đến lúc này.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel>Ghi chú nội bộ (tùy chọn)</FieldLabel>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: đã gọi anh A xác nhận lịch giao hàng"
            rows={4}
            disabled={isPending}
          />
          <FieldDescription>
            Ghi chú này lưu kèm <code className="text-xs">first_response_note</code>{" "}
            phục vụ audit, không gửi cho client.
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button onClick={submitRespond} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Xác nhận đã phản hồi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
