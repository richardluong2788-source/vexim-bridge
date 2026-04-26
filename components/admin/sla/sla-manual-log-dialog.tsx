"use client"

import { useState, useTransition } from "react"
import { Loader2, PenLine } from "lucide-react"
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
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { logManualClientRequest } from "@/app/admin/sla/actions"

interface ClientOption {
  id: string
  label: string
}

interface Props {
  clients: ClientOption[]
}

/**
 * Lets staff log a request that came in via Zalo, phone, or WhatsApp so it
 * can be measured by the M4 evaluator. Allows a backdated `received_at` up
 * to 30 days back (action-side capped).
 */
export function SlaManualLogDialog({ clients }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [clientId, setClientId] = useState("")
  const [channel, setChannel] = useState<"zalo" | "phone" | "whatsapp" | "email" | "other">(
    "zalo",
  )
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal")
  const [receivedAt, setReceivedAt] = useState("") // datetime-local
  const router = useRouter()

  function reset() {
    setClientId("")
    setChannel("zalo")
    setSubject("")
    setBody("")
    setPriority("normal")
    setReceivedAt("")
  }

  function submit() {
    if (!clientId || !subject.trim()) {
      toast.error("Chọn client và nhập tiêu đề")
      return
    }
    startTransition(async () => {
      const res = await logManualClientRequest({
        client_id: clientId,
        channel,
        subject: subject.trim(),
        body: body.trim() || null,
        priority,
        received_at: receivedAt
          ? new Date(receivedAt).toISOString()
          : undefined,
      })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể log yêu cầu")
        return
      }
      toast.success("Đã log yêu cầu vào hệ thống SLA")
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PenLine className="h-3.5 w-3.5" />
          Log yêu cầu (Zalo/phone)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log yêu cầu thủ công</DialogTitle>
          <DialogDescription>
            Dùng khi client liên hệ qua Zalo, điện thoại hay WhatsApp. SLA
            đếm từ <code className="text-xs">received_at</code> bạn nhập tại
            đây.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Client</FieldLabel>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Kênh</FieldLabel>
              <Select
                value={channel}
                onValueChange={(v) =>
                  setChannel(v as "zalo" | "phone" | "whatsapp" | "email" | "other")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zalo">Zalo</SelectItem>
                  <SelectItem value="phone">Điện thoại</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Mức ưu tiên</FieldLabel>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "low" | "normal" | "high" | "urgent")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Thấp</SelectItem>
                  <SelectItem value="normal">Bình thường</SelectItem>
                  <SelectItem value="high">Cao</SelectItem>
                  <SelectItem value="urgent">Khẩn</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>Tiêu đề</FieldLabel>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Hỏi về tiến độ đơn 12/04"
              maxLength={200}
            />
          </Field>

          <Field>
            <FieldLabel>Nội dung</FieldLabel>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Tóm tắt yêu cầu của client"
            />
          </Field>

          <Field>
            <FieldLabel>Thời điểm nhận (tùy chọn)</FieldLabel>
            <Input
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
            <FieldDescription>
              Để trống = bây giờ. Backdate tối đa 30 ngày.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
