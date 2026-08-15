"use client"

import { useState } from "react"
import { Mail, Send, X, Copy, ChevronDown, ChevronUp, Check, Edit3, Paperclip, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useTranslation } from "@/components/i18n/language-provider"
import { EmailRecipientPicker, type RecipientOption } from "@/components/admin/email-recipient-picker"
import type { GenerateEmailResult } from "@/lib/ai/email-generator"
import type { UploadedAttachment } from "@/app/api/attachments/upload/route"

interface Props {
  draft: GenerateEmailResult
  sending: boolean
  onSend: (overrides: { subject?: string; content?: string; recipient?: string; cc?: string[] }) => void
  onReject: () => void
  onBack: () => void
  /** Attachments to include with the email */
  attachments: UploadedAttachment[]
  /** Callback to remove an attachment */
  onRemoveAttachment: (index: number) => void
  /** Buyer contacts available for the To/CC pickers (from buyer_contacts). */
  contactOptions?: RecipientOption[]
}

export function EmailDraftReviewer({ 
  draft, 
  sending, 
  onSend, 
  onReject, 
  onBack,
  attachments,
  onRemoveAttachment,
  contactOptions = [],
}: Props) {
  const { t, locale } = useTranslation()
  const s = t.admin.email ?? fallbackStrings

  const [showVi, setShowVi] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [subject, setSubject] = useState(draft.subject_en)
  const [content, setContent] = useState(draft.content_en)
  const [toEmails, setToEmails] = useState<string[]>(
    draft.recipient_email
      ? draft.recipient_email.split(",").map((e) => e.trim()).filter(Boolean)
      : [],
  )
  const [ccEmails, setCcEmails] = useState<string[]>([])

  function handleCopy() {
    const text = `Subject: ${subject}\n\n${content}`
    navigator.clipboard.writeText(text)
    toast.success(s.copied)
  }

  function handleSend() {
    const overrides: { subject?: string; content?: string; recipient?: string; cc?: string[] } = {}
    if (subject !== draft.subject_en) overrides.subject = subject
    if (content !== draft.content_en) overrides.content = content
    const toJoined = toEmails.join(",")
    if (toJoined !== (draft.recipient_email ?? "")) overrides.recipient = toJoined
    overrides.cc = ccEmails
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

      {/* Recipients: To / CC */}
      <div className="grid gap-3 sm:grid-cols-2">
        <EmailRecipientPicker
          label={s.recipient}
          placeholder={locale === "vi" ? "Chọn người nhận (To)..." : "Select recipients (To)..."}
          options={contactOptions}
          selectedEmails={toEmails}
          onChange={setToEmails}
          locale={locale}
          disabled={sending}
        />
        <EmailRecipientPicker
          label={locale === "vi" ? "CC" : "CC"}
          placeholder={locale === "vi" ? "Chọn liên hệ CC..." : "Select CC contacts..."}
          options={contactOptions.filter((opt) => !toEmails.some((e) => e.toLowerCase() === opt.email.toLowerCase()))}
          selectedEmails={ccEmails}
          onChange={setCcEmails}
          locale={locale}
          disabled={sending}
        />
      </div>
      {toEmails.length === 0 && (
        <p className="text-xs text-destructive">{s.noRecipient}</p>
      )}

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

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <Field>
          <FieldLabel className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            {s.attachments ?? "Đính kèm"} ({attachments.length})
          </FieldLabel>
          <ul className="space-y-2 mt-2">
            {attachments.map((att, index) => (
              <li
                key={att.url}
                className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2"
              >
                {att.contentType.startsWith("image/") ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{att.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(att.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onRemoveAttachment(index)}
                  disabled={sending}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Xóa</span>
                </Button>
              </li>
            ))}
          </ul>
        </Field>
      )}

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
          disabled={sending || toEmails.length === 0}
          className="ml-auto"
        >
          <Send className="h-4 w-4" />
          {sending ? s.sending : s.sendBtn}
        </Button>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
