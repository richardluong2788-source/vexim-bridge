"use client"

import { useState, useTransition } from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { submitClientRequest } from "@/app/client/requests/actions"

interface Props {
  responseTargetHours: number
}

/**
 * Inline form on /client/sla — clients submit questions / requests that
 * go straight into client_requests with channel='portal'. The SLA
 * evaluator measures response time from received_at = NOW().
 */
export function ClientRequestForm({ responseTargetHours }: Props) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">(
    "normal",
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    if (subject.trim().length < 2) {
      toast.error("Vui lòng nhập tiêu đề")
      return
    }
    startTransition(async () => {
      const res = await submitClientRequest({
        subject: subject.trim(),
        body: body.trim() || undefined,
        priority,
      })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể gửi yêu cầu")
        return
      }
      toast.success("Đã gửi yêu cầu. Đội ngũ sẽ phản hồi sớm.")
      setSubject("")
      setBody("")
      setPriority("normal")
      router.refresh()
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          Gửi yêu cầu mới
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Vexim cam kết phản hồi đầu tiên trong{" "}
          <span className="font-medium text-foreground">
            {responseTargetHours} giờ làm việc
          </span>{" "}
          (T2-T6, không tính ngày lễ Việt Nam).
        </p>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="req-subject">Tiêu đề</FieldLabel>
            <Input
              id="req-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Cập nhật tiến độ đơn ABC-001"
              maxLength={200}
              disabled={isPending}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="req-body">Nội dung chi tiết</FieldLabel>
            <Textarea
              id="req-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Mô tả vấn đề bạn cần hỗ trợ"
              disabled={isPending}
            />
            <FieldDescription>Tối đa 4000 ký tự</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="req-priority">Mức độ ưu tiên</FieldLabel>
            <Select
              value={priority}
              onValueChange={(v) =>
                setPriority(v as "low" | "normal" | "high" | "urgent")
              }
              disabled={isPending}
            >
              <SelectTrigger id="req-priority">
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

          <Button onClick={submit} disabled={isPending} className="w-full gap-1.5">
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Gửi yêu cầu
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
