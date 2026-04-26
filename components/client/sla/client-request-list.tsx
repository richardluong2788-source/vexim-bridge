"use client"

import { useState, useTransition } from "react"
import {
  CheckCircle2,
  Clock,
  Globe,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  X,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cancelClientRequest } from "@/app/client/requests/actions"
import { cn } from "@/lib/utils"

export interface ClientRequestListRow {
  id: string
  subject: string
  body: string | null
  channel: string
  priority: string
  status: string
  received_at: string
  first_response_at: string | null
  first_response_note: string | null
  resolved_at: string | null
  logged_via_channel: boolean
}

interface Props {
  requests: ClientRequestListRow[]
  responseTargetHours: number
}

const CHANNEL_ICON: Record<string, LucideIcon> = {
  email: Mail,
  zalo: MessageCircle,
  whatsapp: MessageCircle,
  phone: Phone,
  portal: Globe,
  other: Inbox,
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  zalo: "Zalo",
  whatsapp: "WhatsApp",
  phone: "Điện thoại",
  portal: "Portal",
  other: "Khác",
}

const STATUS_LABEL: Record<string, string> = {
  open: "Mới",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
  closed: "Đã đóng",
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function elapsedHours(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

function timerTone(hours: number, target: number): string {
  if (hours >= target) return "text-rose-600 dark:text-rose-400 font-semibold"
  if (hours >= target * 0.75) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

export function ClientRequestList({ requests, responseTargetHours }: Props) {
  const [isPending, startTransition] = useTransition()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const router = useRouter()

  function cancel(id: string) {
    setCancellingId(id)
    startTransition(async () => {
      const res = await cancelClientRequest({ request_id: id })
      setCancellingId(null)
      if (!res.ok) {
        toast.error(res.error ?? "Không thể huỷ yêu cầu")
        return
      }
      toast.success("Đã đóng yêu cầu")
      router.refresh()
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Yêu cầu gần đây ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {requests.length === 0 ? (
          <Empty className="border-0 py-10">
            <EmptyTitle>Chưa có yêu cầu</EmptyTitle>
            <EmptyDescription>
              Gửi yêu cầu đầu tiên ở form bên cạnh hoặc liên hệ trực tiếp với
              account manager.
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => {
              const Icon = CHANNEL_ICON[r.channel] ?? Inbox
              const isOpen = r.status === "open" || r.status === "in_progress"
              const elapsed = elapsedHours(r.received_at)
              const respondedHours = r.first_response_at
                ? Math.round(
                    (new Date(r.first_response_at).getTime() -
                      new Date(r.received_at).getTime()) /
                      3_600_000,
                  )
                : null

              return (
                <li
                  key={r.id}
                  className="px-5 py-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {r.subject}
                      </p>
                      {r.logged_via_channel && (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wide"
                        >
                          Staff log
                        </Badge>
                      )}
                    </div>
                    {r.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {r.body}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-muted-foreground">
                      <span>{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(r.received_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    {/* Response status row */}
                    <div className="mt-2 text-xs flex items-center gap-2 flex-wrap">
                      {respondedHours != null ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Phản hồi sau {respondedHours}h
                        </span>
                      ) : isOpen ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 tabular-nums",
                            timerTone(elapsed, responseTargetHours),
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {elapsed}h trôi qua / target {responseTargetHours}h
                        </span>
                      ) : null}
                      {r.first_response_note && (
                        <span className="text-muted-foreground italic line-clamp-1">
                          &ldquo;{r.first_response_note}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen && !r.first_response_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-rose-600"
                      onClick={() => cancel(r.id)}
                      disabled={isPending && cancellingId === r.id}
                      aria-label="Đóng yêu cầu"
                      title="Đã giải quyết / không cần hỗ trợ"
                    >
                      {isPending && cancellingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
