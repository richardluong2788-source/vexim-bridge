"use client"

import { useState, useEffect } from "react"
import { Mail, Sparkles, PenLine, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/components/i18n/language-provider"
import { EmailAttachmentPicker } from "@/components/admin/email-attachment-picker"
import { ProductLinkPicker } from "@/components/admin/product-link-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { Users } from "lucide-react"
import type { EmailType, BuyerContact } from "@/lib/supabase/types"
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
  /** Send manual email directly */
  onSendManual?: (subject: string, content: string, recipient: string) => void
  /** Initial quoted text (e.g. buyer reply to respond to) */
  quoteReply?: string
  /** Callback when quote is cleared */
  onClearQuote?: () => void
  /** Current attachments */
  attachments: UploadedAttachment[]
  /** Callback when attachments change */
  onAttachmentsChange: (attachments: UploadedAttachment[]) => void
  /** Opportunity ID for product link tracking */
  opportunityId?: string
  /** Client ID for fetching products */
  clientId?: string | null
  /** Buyer contacts available to CC (from danh bạ liên hệ) */
  contacts?: BuyerContact[]
  /** Currently selected CC emails */
  ccEmails?: string[]
  /** Callback when CC selection changes */
  onCcChange?: (emails: string[]) => void
}

export function EmailDraftComposer({ 
  loading, 
  onGenerate, 
  onSendManual,
  quoteReply, 
  onClearQuote,
  attachments,
  onAttachmentsChange,
  opportunityId,
  clientId,
  contacts = [],
  ccEmails = [],
  onCcChange,
}: Props) {
  const { t, locale } = useTranslation()
  const s = t.admin.email ?? fallbackStrings

  // AI mode state - default to introduction (cold outreach, no prior contact)
  const [emailType, setEmailType] = useState<EmailType>("introduction")

  // Khi AE bấm "Phản hồi" trên một tin buyer đã gửi, quoteReply sẽ được set
  // từ component cha. Composer này thường đã mount từ trước nên state
  // emailType không tự đổi theo - phải đồng bộ ở đây, vì loại email này
  // ảnh hưởng trực tiếp đến chiến lược viết của AI (EMAIL_TYPE_GUIDANCE):
  // "introduction" ép AI viết như chào hàng lần đầu, sai hoàn toàn khi
  // buyer đã ở giữa cuộc trao đổi và đang chờ trả lời.
  useEffect(() => {
    if (quoteReply) {
      setEmailType("follow_up")
    }
  }, [quoteReply])

  // Manual mode state
  const [manualSubject, setManualSubject] = useState("")
  const [manualContent, setManualContent] = useState("")
  const [manualRecipient, setManualRecipient] = useState("")

  // Prefill recipient from the buyer's primary contact once the contact
  // directory loads. Don't overwrite if the AE already typed something.
  useEffect(() => {
    if (manualRecipient) return
    const primary = contacts.find((c) => c.is_primary && c.email) ?? contacts.find((c) => !!c.email)
    if (primary?.email) setManualRecipient(primary.email)
  }, [contacts, manualRecipient])

  function handleAISubmit() {
    // AI auto-generates based on email type and buyer data - no Vietnamese prompt needed
    onGenerate(emailType, "")
  }

  function handleManualSubmit() {
    if (!manualSubject.trim() || !manualContent.trim() || !manualRecipient.trim()) return
    onSendManual?.(manualSubject.trim(), manualContent.trim(), manualRecipient.trim())
  }

  const ccableContacts = contacts.filter((c) => !!c.email)

  function toggleCc(email: string) {
    if (!onCcChange) return
    if (ccEmails.includes(email)) {
      onCcChange(ccEmails.filter((e) => e !== email))
    } else {
      onCcChange([...ccEmails, email])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Mail className="h-4 w-4 text-primary" />
        {s.composerTitle}
      </div>

      {/* Quote context - shown in both tabs */}
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

      {/* CC picker - danh bạ liên hệ khác của buyer (đa liên hệ) */}
      {ccableContacts.length > 0 && (
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5" />
            CC thêm liên hệ khác
          </div>
          <div className="flex flex-col gap-2">
            {ccableContacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
              >
                <Checkbox
                  checked={ccEmails.includes(contact.email!)}
                  onCheckedChange={() => toggleCc(contact.email!)}
                  disabled={loading}
                />
                <span className="font-medium">{contact.full_name}</span>
                {contact.title && (
                  <span className="text-xs text-muted-foreground">· {contact.title}</span>
                )}
                <span className="text-xs text-muted-foreground">({contact.email})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            AI tự động
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <PenLine className="h-3.5 w-3.5" />
            Thủ công
          </TabsTrigger>
        </TabsList>

        {/* AI Tab */}
        <TabsContent value="ai" className="mt-4 space-y-4">
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
              <FieldLabel>{s.attachmentsLabel ?? "Đính kèm"}</FieldLabel>
              <EmailAttachmentPicker
                attachments={attachments}
                onChange={onAttachmentsChange}
                disabled={loading}
              />
            </Field>

            {/* Product Link Picker */}
            {opportunityId && clientId && (
              <Field>
                <FieldLabel>Link sản phẩm</FieldLabel>
                <ProductLinkPicker
                  opportunityId={opportunityId}
                  clientId={clientId}
                  disabled={loading}
                />
                <FieldDescription>
                  Copy link sản phẩm để gửi cho buyer. Link có tracking để liên kết phản hồi với deal này.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>

          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              AI sẽ tự động tạo email dựa trên thông tin buyer (lịch sử mua hàng, nhà cung cấp, volume...). 
              {quoteReply && " Nếu buyer đã phản hồi, AI sẽ tự động tạo email trả lời phù hợp."}
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAISubmit}
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
        </TabsContent>

        {/* Manual Tab */}
        <TabsContent value="manual" className="mt-4 space-y-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Email người nhận</FieldLabel>
              <Input
                type="email"
                value={manualRecipient}
                onChange={(e) => setManualRecipient(e.target.value)}
                placeholder="buyer@company.com"
                disabled={loading}
              />
              {contacts.filter((c) => !!c.email).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {contacts
                    .filter((c) => !!c.email)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setManualRecipient(c.email!)}
                        disabled={loading}
                        className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {c.full_name} ({c.email}){c.is_primary ? " · Chính" : ""}
                      </button>
                    ))}
                </div>
              )}
              <FieldDescription>
                Email sẽ được gửi trực tiếp đến địa chỉ này.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Tiêu đề email</FieldLabel>
              <Input
                value={manualSubject}
                onChange={(e) => setManualSubject(e.target.value)}
                placeholder="VD: Re: Quotation for Cashew Kernels"
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel>Nội dung email</FieldLabel>
              <Textarea
                rows={8}
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder="Nhập nội dung email bạn muốn gửi cho buyer..."
                disabled={loading}
                className="resize-none font-mono text-sm"
              />
              <FieldDescription>
                Nhập trực tiếp nội dung email (tiếng Anh). Email sẽ được gửi đúng như bạn nhập.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>{s.attachmentsLabel ?? "Đính kèm"}</FieldLabel>
              <EmailAttachmentPicker
                attachments={attachments}
                onChange={onAttachmentsChange}
                disabled={loading}
              />
            </Field>

            {/* Product Link Picker */}
            {opportunityId && clientId && (
              <Field>
                <FieldLabel>Link sản phẩm</FieldLabel>
                <ProductLinkPicker
                  opportunityId={opportunityId}
                  clientId={clientId}
                  disabled={loading}
                />
                <FieldDescription>
                  Copy link sản phẩm để gửi cho buyer.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>

          <Button
            type="button"
            onClick={handleManualSubmit}
            disabled={loading || !manualSubject.trim() || !manualContent.trim() || !manualRecipient.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gửi Email
              </>
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
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
  attachmentsLabel: "Đính kèm",
  generateBtn: "Tạo Email",
  generating: "Đang tạo...",
}
