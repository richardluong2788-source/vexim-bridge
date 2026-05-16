"use client"

import { useState, useTransition } from "react"
import { Loader2, Send, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addReplyToRequest } from "@/app/client/requests/reply-actions"

interface Reply {
  id: string
  client_request_id: string
  sender_id: string
  sender_role: "client" | "admin" | "staff"
  body: string
  created_at: string
}

interface Props {
  requestId: string
  replies: Reply[]
  currentUserId: string
  canReply: boolean
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

export function ClientRequestReplies({
  requestId,
  replies,
  currentUserId,
  canReply,
}: Props) {
  const [replyText, setReplyText] = useState("")
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (replyText.trim().length < 1) {
      toast.error("Vui lòng nhập nội dung phản hồi")
      return
    }

    startTransition(async () => {
      const res = await addReplyToRequest({
        request_id: requestId,
        body: replyText.trim(),
      })

      if (!res.ok) {
        toast.error(res.error ?? "Không thể gửi phản hồi")
        return
      }

      toast.success("Đã gửi phản hồi")
      setReplyText("")
      window.location.reload() // Refresh to get new replies
    })
  }

  if (replies.length === 0 && !canReply) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Existing replies thread */}
      {replies.length > 0 && (
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span>Cuộc trò chuyện ({replies.length})</span>
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {replies.map((reply) => {
              const isOwnReply = reply.sender_id === currentUserId
              const roleLabel =
                reply.sender_role === "client" ? "Bạn" : "Hỗ trợ"

              return (
                <div
                  key={reply.id}
                  className={`p-3 rounded border ${
                    isOwnReply
                      ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-slate-900 border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <User className="h-3 w-3" />
                    <span className="font-medium">{roleLabel}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {reply.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reply input */}
      {canReply && (
        <div className="space-y-2 p-4 bg-muted/20 rounded-lg border border-border">
          <label className="text-sm font-medium">Phản hồi</label>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Nhập phản hồi của bạn..."
            rows={3}
            disabled={isPending}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {replyText.length} / 2000
            </span>
            <Button
              onClick={submit}
              disabled={isPending || replyText.trim().length === 0}
              size="sm"
              gap="1.5"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Gửi phản hồi
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
