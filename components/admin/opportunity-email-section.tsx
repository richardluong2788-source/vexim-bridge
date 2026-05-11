"use client"

import { useState, useEffect, useTransition } from "react"
import { Mail, CheckCircle2, History, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { EmailDraftComposer } from "@/components/admin/email-draft-composer"
import { EmailDraftReviewer } from "@/components/admin/email-draft-reviewer"
import {
  generateEmailDraftAction,
  sendEmailDraftAction,
  rejectEmailDraftAction,
  fetchEmailDraftsAction,
  type EmailDraftRow,
} from "@/app/admin/opportunities/email-actions"
import { useTranslation } from "@/components/i18n/language-provider"
import type { EmailType } from "@/lib/supabase/types"
import type { GenerateEmailResult } from "@/lib/ai/email-generator"

type FlowState = "compose" | "review" | "success"

interface Props {
  opportunityId: string
  open: boolean
}

export function OpportunityEmailSection({ opportunityId, open }: Props) {
  const { t } = useTranslation()
  const s = t.admin.email ?? fallbackStrings

  const [flowState, setFlowState] = useState<FlowState>("compose")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<GenerateEmailResult | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)

  // History
  const [history, setHistory] = useState<EmailDraftRow[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, startHistoryTransition] = useTransition()

  // Load history when section opens
  useEffect(() => {
    if (open && opportunityId) {
      startHistoryTransition(async () => {
        const res = await fetchEmailDraftsAction(opportunityId)
        if (res.ok) {
          setHistory(res.drafts.filter((d) => d.status === "sent"))
        }
      })
    }
  }, [open, opportunityId])

  async function handleGenerate(emailType: EmailType, viPrompt: string) {
    setGenerating(true)
    try {
      const res = await generateEmailDraftAction({
        opportunityId,
        emailType,
        viPrompt,
      })
      if (!res.ok) {
        if (res.error === "noLead") {
          toast.error(s.errorNoLead)
        } else if (res.error === "unauthorized") {
          toast.error(s.errorUnauthorized)
        } else {
          toast.error(res.message ?? s.errorGenerate)
        }
        return
      }
      setDraft(res.data)
      setDraftId(res.data.draftId)
      setFlowState("review")
    } catch (err) {
      toast.error(s.errorGenerate)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSend(overrides: { subject?: string; content?: string; recipient?: string }) {
    if (!draftId) return
    setSending(true)
    try {
      const res = await sendEmailDraftAction({
        draftId,
        overrideSubject: overrides.subject,
        overrideContent: overrides.content,
        overrideRecipient: overrides.recipient,
      })
      if (!res.ok) {
        if (res.error === "noRecipient") {
          toast.error(s.errorNoRecipient)
        } else if (res.error === "alreadySent") {
          toast.error(s.errorAlreadySent)
        } else {
          toast.error(res.message ?? s.errorSend)
        }
        return
      }
      toast.success(s.sendSuccess)
      setFlowState("success")
      // Refresh history
      const historyRes = await fetchEmailDraftsAction(opportunityId)
      if (historyRes.ok) {
        setHistory(historyRes.drafts.filter((d) => d.status === "sent"))
      }
    } catch (err) {
      toast.error(s.errorSend)
    } finally {
      setSending(false)
    }
  }

  async function handleReject() {
    if (!draftId) return
    try {
      await rejectEmailDraftAction(draftId)
      toast.info(s.rejected)
    } catch {
      // Ignore
    }
    resetFlow()
  }

  function resetFlow() {
    setFlowState("compose")
    setDraft(null)
    setDraftId(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{s.sectionTitle}</h3>
      </div>

      {/* Main Flow */}
      <div className="border border-border rounded-lg p-4 bg-card">
        {flowState === "compose" && (
          <EmailDraftComposer loading={generating} onGenerate={handleGenerate} />
        )}

        {flowState === "review" && draft && (
          <EmailDraftReviewer
            draft={draft}
            sending={sending}
            onSend={handleSend}
            onReject={handleReject}
            onBack={resetFlow}
          />
        )}

        {flowState === "success" && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium text-foreground">{s.successTitle}</p>
            <p className="text-sm text-muted-foreground">{s.successDesc}</p>
            <button
              type="button"
              onClick={resetFlow}
              className="text-sm text-primary hover:underline"
            >
              {s.sendAnother}
            </button>
          </div>
        )}
      </div>

      {/* Email History */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            {s.historyTitle}
            {history.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {history.length}
              </Badge>
            )}
          </span>
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showHistory && (
          <div className="border-t border-border">
            {historyLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className="h-5 w-5" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mr-2" />
                {s.noHistory}
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                {history.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.generated_subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.sentTo}: {item.recipient_email ?? "—"}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.sent_at
                          ? new Date(item.sent_at).toLocaleDateString()
                          : "—"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

const fallbackStrings = {
  sectionTitle: "Email Buyer",
  errorNoLead: "Opportunity chưa có lead/buyer liên kết",
  errorUnauthorized: "Bạn không có quyền gửi email",
  errorGenerate: "Không thể tạo email, vui lòng thử lại",
  errorNoRecipient: "Chưa có email người nhận",
  errorAlreadySent: "Email này đã được gửi trước đó",
  errorSend: "Gửi email thất bại, vui lòng thử lại",
  sendSuccess: "Email đã được gửi thành công!",
  rejected: "Đã hủy email draft",
  successTitle: "Email đã gửi!",
  successDesc: "Email đã được gửi đến buyer thành công.",
  sendAnother: "Soạn email khác",
  historyTitle: "Lịch sử email đã gửi",
  noHistory: "Chưa có email nào được gửi",
  sentTo: "Gửi đến",
}
