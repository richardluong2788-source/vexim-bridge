"use client"

import { useState } from "react"
import { Mail, Send, X, Copy, ChevronDown, ChevronUp, Check, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useTranslation } from "@/components/i18n/language-provider"
import type { GenerateEmailResult } from "@/lib/ai/email-generator"

interface Props {
  draft: GenerateEmailResult
  sending: boolean
  onSend: (overrides: { subject?: string; content?: string; recipient?: string }) => void
  onReject: () => void
  onBack: () => void
}

export function EmailDraftReviewer({ draft, sending, onSend, onReject, onBack }: Props) {
  const { t } = useTranslation()
  const s = t.admin.email ?? fallbackStrings

  const [showVi, setShowVi] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [subject, setSubject] = useState(draft.subject_en)
  const [content, setContent] = useState(draft.content_en)
  const [recipient, setRecipient] = useState(draft.recipient_email ?? "")

  function handleCopy() {
    const text = `Subject: ${subject}\n\n${content}`
    navigator.clipboard.writeText(text)
    toast.success(s.copied)
  }

  function handleSend() {
    const overrides: { subject?: string; content?: string; recipient?: string } = {}
    if (subject !== draft.subject_en) overrides.subject = subject
    if (content !== draft.content_en) overrides.content = content
    if (recipient !== draft.recipient_email) overrides.recipient = recipient
    onSend(overrides)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="h-4 w-4 text-primary" />
          {s.reviewerTitle}
        </div>
        <Badge variant="secondary" className="text-xs">
          {s.aiGenerated}
        </Badge>
      </div>

      {/* Recipient */}
      <Field>
        <FieldLabel>{s.recipient}</FieldLabel>
        {editMode ? (
          <Input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="buyer@company.com"
            disabled={sending}
          />
        ) : (
          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            {recipient || <span className="text-destructive">{s.noRecipient}</span>}
          </div>
        )}
      </Field>

      {/* Subject */}
      <Field>
        <FieldLabel>{s.subjectLabel}</FieldLabel>
        {editMode ? (
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
          />
        ) : (
          <div className="text-sm font-medium bg-muted/50 px-3 py-2 rounded-md">
            {subject}
          </div>
        )}
      </Field>

      {/* Content EN */}
      <Field>
        <FieldLabel>{s.contentEn}</FieldLabel>
        {editMode ? (
          <Textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={sending}
            className="resize-none font-mono text-sm"
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap bg-muted/50 px-3 py-3 rounded-md max-h-64 overflow-y-auto">
            {content}
          </div>
        )}
      </Field>

      {/* Content VI (collapsible) */}
      <div className="border border-border rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowVi(!showVi)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span>{s.contentVi}</span>
          {showVi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showVi && (
          <div className="px-3 py-3 border-t border-border text-sm whitespace-pre-wrap text-muted-foreground max-h-48 overflow-y-auto">
            {draft.content_vi}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={sending}
        >
          <X className="h-4 w-4" />
          {s.back}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditMode(!editMode)}
          disabled={sending}
        >
          {editMode ? <Check className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          {editMode ? s.doneEdit : s.edit}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={sending}
        >
          <Copy className="h-4 w-4" />
          {s.copy}
        </Button>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onReject}
          disabled={sending}
        >
          <X className="h-4 w-4" />
          {s.reject}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSend}
          disabled={sending || !recipient.trim()}
          className="ml-auto"
        >
          <Send className="h-4 w-4" />
          {sending ? s.sending : s.sendBtn}
        </Button>
      </div>
    </div>
  )
}

const fallbackStrings = {
  reviewerTitle: "Xem lại Email",
  aiGenerated: "AI tạo",
  recipient: "Người nhận",
  noRecipient: "Chưa có email người nhận",
  subjectLabel: "Tiêu đề",
  contentEn: "Nội dung (EN)",
  contentVi: "Bản dịch tiếng Việt (tham khảo)",
  back: "Quay lại",
  edit: "Chỉnh sửa",
  doneEdit: "Xong",
  copy: "Sao chép",
  reject: "Hủy",
  sendBtn: "Gửi Email",
  sending: "Đang gửi...",
  copied: "Đã sao chép vào clipboard",
}
