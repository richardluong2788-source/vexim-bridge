"use client"

import { useState } from "react"
import { Mail, Sparkles, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/components/i18n/language-provider"
import { EmailAttachmentPicker } from "@/components/admin/email-attachment-picker"
import type { EmailType } from "@/lib/supabase/types"
import type { UploadedAttachment } from "@/app/api/attachments/upload/route"

const EMAIL_TYPES: { value: EmailType; labelKey: string; descKey: string }[] = [
  { value: "introduction", labelKey: "typeIntro", descKey: "typeIntroDesc" },
  { value: "follow_up", labelKey: "typeFollowUp", descKey: "typeFollowUpDesc" },
  { value: "quotation", labelKey: "typeQuote", descKey: "typeQuoteDesc" },
  { value: "custom", labelKey: "typeCustom", descKey: "typeCustomDesc" },
]

interface Props {
  loading: boolean
  onGenerate: (emailType: EmailType, viPrompt: string) => void
  /** Initial quoted text (e.g. buyer reply to respond to) */
  quoteReply?: string
  /** Callback when quote is cleared */
  onClearQuote?: () => void
  /** Current attachments */
  attachments: UploadedAttachment[]
  /** Callback when attachments change */
  onAttachmentsChange: (attachments: UploadedAttachment[]) => void
}

export function EmailDraftComposer({ 
  loading, 
  onGenerate, 
  quoteReply, 
  onClearQuote,
  attachments,
  onAttachmentsChange,
}: Props) {
  const { t, locale } = useTranslation()
  const s = t.admin.email ?? fallbackStrings

  const [emailType, setEmailType] = useState<EmailType>("follow_up")
  const [viPrompt, setViPrompt] = useState("")

  function handleSubmit() {
    const finalPrompt = viPrompt.trim() || getDefaultPrompt(emailType, locale)
    onGenerate(emailType, finalPrompt)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Mail className="h-4 w-4 text-primary" />
        {s.composerTitle}
      </div>

      {/* Quote context */}
      {quoteReply && (
        <div className="rounded-md bg-muted/50 border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium">Đang phản hồi:</span>
              <br />
              {quoteReply.slice(0, 150)}
              {quoteReply.length > 150 && "..."}
            </p>
            <button
              type="button"
              onClick={onClearQuote}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Xóa quote"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel>{s.emailType}</FieldLabel>
          <Select
            value={emailType}
            onValueChange={(v) => setEmailType(v as EmailType)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TYPES.map((et) => (
                <SelectItem key={et.value} value={et.value}>
                  {s[et.labelKey as keyof typeof s] ?? et.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {s[`${emailType}Desc` as keyof typeof s] ?? ""}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>{s.viPromptLabel}</FieldLabel>
          <Textarea
            rows={4}
            value={viPrompt}
            onChange={(e) => setViPrompt(e.target.value)}
            placeholder={getDefaultPrompt(emailType, locale)}
            disabled={loading}
            className="resize-none"
          />
          <FieldDescription>{s.viPromptHelp}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>{s.attachmentsLabel ?? "Đính kèm"}</FieldLabel>
          <EmailAttachmentPicker
            attachments={attachments}
            onChange={onAttachmentsChange}
            disabled={loading}
          />
        </Field>
      </FieldGroup>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <Spinner className="h-4 w-4" />
            {s.generating}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {s.generateBtn}
          </>
        )}
      </Button>
    </div>
  )
}

function getDefaultPrompt(type: EmailType, locale: string): string {
  const isVi = locale === "vi"
  switch (type) {
    case "introduction":
      return isVi
        ? "Giới thiệu công ty và sản phẩm, đề xuất cuộc gọi ngắn"
        : "Introduce company and products, propose a short call"
    case "follow_up":
      return isVi
        ? "Theo dõi sau email trước, nhắc lại giá trị, đề xuất bước tiếp theo"
        : "Follow up on previous email, reiterate value, propose next step"
    case "quotation":
      return isVi
        ? "Gửi báo giá chi tiết với sản phẩm, số lượng, giá, điều khoản thanh toán"
        : "Send detailed quotation with product, quantity, price, payment terms"
    case "custom":
    default:
      return isVi
        ? "Nhập nội dung email bạn muốn gửi..."
        : "Enter the email content you want to send..."
  }
}

// Fallback strings in case translation file is not updated
const fallbackStrings = {
  composerTitle: "Soạn Email",
  emailType: "Loại email",
  typeIntro: "Giới thiệu",
  typeIntroDesc: "Email giới thiệu công ty đến buyer mới",
  typeFollowUp: "Theo dõi",
  typeFollowUpDesc: "Email theo dõi sau cuộc trao đổi trước",
  typeQuote: "Báo giá",
  typeQuoteDesc: "Email gửi báo giá sản phẩm chi tiết",
  typeCustom: "Tùy chỉnh",
  typeCustomDesc: "Email tự do theo nội dung bạn nhập",
  viPromptLabel: "Nội dung (tiếng Việt)",
  viPromptHelp: "Nhập yêu cầu bằng tiếng Việt, AI sẽ tạo email tiếng Anh chuyên nghiệp",
  generateBtn: "Tạo Email",
  generating: "Đang tạo...",
}
