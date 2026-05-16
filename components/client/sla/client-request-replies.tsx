"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Send, User } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addReplyToRequest } from "@/app/client/requests/reply-actions"
import { createClient } from "@/lib/supabase/client"

interface Reply {
  id: string
  client_request_id: string
  sender_id: string
  sender_role: "client" | "admin" | "staff"
  body: string
  created_at: string
}

interface ClientRequest {
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
  requestId: string
  initialRequest: ClientRequest
  onClose: () => void
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
  initialRequest,
  onClose,
}: Props) {
  const [replyText, setReplyText] = useState("")
  const [isPending, startTransition] = useTransition()
  const [replies, setReplies] = useState<Reply[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const router = useRouter()
  const supabase = createClient()

  // Load replies and current user on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setCurrentUserId(user.id)
        
        // Load replies
        const { data, error } = await supabase
          .from("client_request_replies")
          .select("*")
          .eq("client_request_id", requestId)
          .order("created_at", { ascending: true })
        
        if (error) {
          console.error("[sla] Failed to load replies", error)
          toast.error("Không thể tải cuộc trò chuyện")
        } else {
          setReplies(data || [])
        }
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [requestId, supabase])

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
      router.refresh()
      
      // Reload replies
      const { data } = await supabase
        .from("client_request_replies")
        .select("*")
        .eq("client_request_id", requestId)
        .order("created_at", { ascending: true })
      if (data) setReplies(data)
    })
  }

  const canReply = initialRequest.status === "open" || initialRequest.status === "in_progress"

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Initial request */}
      <div className="p-4 bg-muted/20 rounded-lg border border-border">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">Bạn</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(initialRequest.received_at)}
              </span>
            </div>
            <div className="text-sm">
              {initialRequest.body && (
                <p className="whitespace-pre-wrap break-words">
                  {initialRequest.body}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin/staff replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          {replies.map((reply) => {
            const isOwnReply = reply.sender_id === currentUserId
            const roleLabel =
              reply.sender_role === "client" ? "Bạn" : "Hỗ trợ"

            return (
              <div
                key={reply.id}
                className={`p-4 rounded-lg border flex gap-3 ${
                  isOwnReply
                    ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                    : "bg-muted/20 border-border"
                }`}
              >
                <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{roleLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {reply.body}
                  </p>
                </div>
              </div>
            )
          })}
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
