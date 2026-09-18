"use client"

/**
 * Stage dialogs for the pre-opportunity (engagement) pipeline.
 *
 * These used to live inside app/admin/ae-inbox/engagement-list.tsx, which meant
 * the buyer profile could not offer them: the only way to record requirements,
 * build a shortlist or create the opportunities was to leave the buyer page and
 * find the card in "Đang xử lý". They are exported here and rendered by BOTH
 * surfaces — the inbox card and the buyer profile's "Phân tích" tab — through
 * `EngagementStageDialogHost`, which maps a stage-action key to its dialog.
 *
 * The bodies are unchanged from the inbox originals.
 */

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ClipboardList,
  CornerUpLeft,
  Inbox,
  Link2,
  Loader2,
  Mail,
  Reply,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  approveAndSendShortlist,
  buildShortlist,
  convertEngagementToOpportunities,
  saveBuyerRequirements,
  type ConvertRoleAssignment,
  type SaveRequirementsInput,
  dropEngagement,
  listTransferCandidateAEs,
  transferEngagement,
  type TransferCandidateAE,
} from "@/app/admin/ae-inbox/engagement-actions"
import { returnBuyerToInbox } from "@/app/admin/buyers/assignment-actions"
import {
  generateFollowUpReplyEmailAction,
  generateRequirementInquiryEmailAction,
  markFollowUpResentAction,
} from "@/app/admin/ae-inbox/requirement-email-actions"
import { sendEmailDraftAction } from "@/app/admin/opportunities/email-actions"
import { getAIMatchedClients } from "@/app/admin/buyers/actions"
import type { ClientMatchResult } from "@/lib/matching/client-types"
import { LOW_MATCH_SCORE_THRESHOLD, MEDIUM_MATCH_SCORE_THRESHOLD } from "@/lib/matching/client-types"
import { RequirementEmailComposer } from "@/components/admin/requirement-email-composer"
import type { StageActionKey } from "@/lib/buyers/engagement-stages"
import type {
  Engagement,
  EngagementActionTarget,
  EngagementClient,
  EngagementReplyRow,
} from "@/lib/buyers/engagement-types"

const CONTACT_CHANNEL_LABELS: Record<string, { vi: string; en: string }> = {
  system_email: { vi: "Email trong hệ thống", en: "In-system email" },
  linkedin: { vi: "LinkedIn", en: "LinkedIn" },
  whatsapp: { vi: "WhatsApp", en: "WhatsApp" },
  phone: { vi: "Điện thoại", en: "Phone" },
  other: { vi: "Khác", en: "Other" },
}

// Dialog: Manually resend a follow-up when the buyer has gone quiet — either
// because the earlier email never reached them, or they simply haven't
// replied yet. Available any time at "requirement_email_sent" /
// "shortlist_sent" / "buyer_viewed" (not gated behind the 14-day silent
// warning, so the AE can nudge earlier if they want). AI drafts a short,
// polite check-in referencing the shortlist link when one was already sent,
// otherwise a light reminder of the original opening email.
// ---------------------------------------------------------------------------

function ResendFollowUpDialog({
  engagement,
  locale,
  onClose,
  onSent,
}: {
  engagement: Engagement
  locale: "vi" | "en"
  onClose: () => void
  onSent: () => void
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai")
  const [viPrompt, setViPrompt] = useState("")
  const [manualSubject, setManualSubject] = useState("")
  const [manualContent, setManualContent] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<{
    draftId: string
    subject_en: string
    content_en: string
    recipient_email: string | null
    usedFallback?: boolean
  } | null>(null)

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  // If a shortlist was already sent to this buyer, the follow-up should
  // remind them about that link rather than the earlier opening email.
  const sentVersion = engagement.buyer_engagement_shortlist_versions.find((v) => v.status === "sent")
  const shareLink = sentVersion
    ? engagement.shortlist_share_links.find((l) => l.version_id === sentVersion.id) ?? null
    : null
  const shortlistUrl = shareLink
    ? typeof window !== "undefined"
      ? `${window.location.origin}/shortlist/${shareLink.token}`
      : `/shortlist/${shareLink.token}`
    : undefined

  // If the buyer has ever replied in this engagement, thread this follow-up
  // onto their most recent message (In-Reply-To/References) instead of
  // starting a brand-new conversation. Gmail is far more likely to keep an
  // email in the Primary tab when it's a reply within an existing,
  // already-read thread than when it opens a new thread from scratch.
  const latestReplyMessageId = [...(engagement.buyer_replies ?? [])].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  )[0]?.message_id

  const handleGenerate = async () => {
    if (mode === "manual" && !manualContent.trim()) {
      toast.error(t("Vui lòng nhập nội dung email", "Please enter the email content"))
      return
    }
    setGenerating(true)
    const result = await generateRequirementInquiryEmailAction(
      mode === "manual"
        ? {
            engagementId: engagement.id,
            viPrompt: "",
            emailType: "requirement_followup",
            shortlistUrl,
            isManual: true,
            manualSubject: manualSubject.trim() || t("(không có chủ đề)", "(no subject)"),
            manualContent: manualContent.trim(),
          }
        : {
            engagementId: engagement.id,
            viPrompt,
            emailType: "requirement_followup",
            shortlistUrl,
          },
    )
    setGenerating(false)
    if (!result.ok) {
      toast.error(result.message || result.error)
      return
    }
    if (result.data.usedFallback) {
      toast.warning(
        t(
          "AI tạm không phản hồi — đã dùng mẫu email có sẵn, vui lòng kiểm tra lại trước khi gửi",
          "AI is temporarily unavailable — a fallback template was used, please review before sending",
        ),
      )
    }
    setDraft(result.data)
  }

  const handleSend = async () => {
    if (!draft) return
    if (!draft.recipient_email) {
      toast.error(t("Buyer chưa có email liên hệ", "Buyer has no contact email"))
      return
    }
    setSending(true)
    const sendResult = await sendEmailDraftAction({
      draftId: draft.draftId,
      replyToMessageId: latestReplyMessageId,
    })
    if (!sendResult.ok) {
      setSending(false)
      toast.error(sendResult.message || sendResult.error)
      return
    }
    await markFollowUpResentAction(engagement.id)
    setSending(false)
    toast.success(t("Đã gửi lại email cho buyer", "Follow-up email sent"))
    onSent()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Gửi lại email cho buyer", "Resend follow-up email")}</DialogTitle>
          <DialogDescription>
            {t(
              shortlistUrl
                ? "AI sẽ soạn email nhắc buyer về shortlist đã gửi trước đó, phòng trường hợp họ chưa xem hoặc email trước không đến được."
                : "AI sẽ soạn email nhắc lại nhẹ nhàng về email mở đầu đã gửi trước đó, phòng trường hợp email đó không đến được buyer.",
              shortlistUrl
                ? "AI will draft an email reminding the buyer about the shortlist already sent, in case they missed it or it never arrived."
                : "AI will draft a light reminder referencing the earlier opening email, in case it never reached the buyer.",
            )}
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "ai" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("Soạn bằng AI", "AI draft")}
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "manual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("Soạn tay", "Write manually")}
              </button>
            </div>

            {mode === "ai" ? (
              <>
                <Label htmlFor="resend-vi-prompt">
                  {t("Hướng dẫn thêm cho AI (không bắt buộc)", "Extra instructions for AI (optional)")}
                </Label>
                <Textarea
                  id="resend-vi-prompt"
                  value={viPrompt}
                  onChange={(e) => setViPrompt(e.target.value)}
                  placeholder={t(
                    "VD: hỏi buyer có cần thêm thông tin gì để ra quyết định...",
                    "E.g. ask if the buyer needs any more information to decide...",
                  )}
                  rows={3}
                />
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="manual-resend-subject">{t("Chủ đề", "Subject")}</Label>
                  <Input
                    id="manual-resend-subject"
                    value={manualSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                    placeholder={t("VD: Following up — ...", "E.g. Following up — ...")}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-resend-content">{t("Nội dung email", "Email content")}</Label>
                  <Textarea
                    id="manual-resend-content"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder={t(
                      "Viết nội dung email nhắc lại gửi buyer tại đây...",
                      "Write the follow-up email content here...",
                    )}
                    rows={8}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {draft.usedFallback && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-px" />
                <span>
                  {t(
                    "AI tạm không phản hồi (lỗi hoặc timeout) — nội dung dưới đây là mẫu email có sẵn (fallback), vui lòng đọc kỹ và chỉnh sửa trước khi gửi.",
                    "AI did not respond (error or timeout) — the content below is a static fallback template. Please review and edit before sending.",
                  )}
                </span>
              </div>
            )}
            <div>
              <Label>{t("Chủ đề", "Subject")}</Label>
              <Input
                value={draft.subject_en}
                onChange={(e) => setDraft({ ...draft, subject_en: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("Nội dung (English)", "Content (English)")}</Label>
              <Textarea
                value={draft.content_en}
                onChange={(e) => setDraft({ ...draft, content_en: e.target.value })}
                rows={8}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Người nhận: ", "Recipient: ")}
              {draft.recipient_email || t("(chưa có email)", "(no email on file)")}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          {!draft ? (
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "manual" ? (
                <CornerUpLeft className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {mode === "manual"
                ? t("Xem lại email", "Review email")
                : t("Soạn bằng AI", "Generate with AI")}
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("Gửi email", "Send email")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Reply to a SPECIFIC buyer message mid-negotiation. Works at any
// stage — buyer replies can arrive before requirements are fully captured,
// and the AE needs to keep answering without leaving this workspace.
// Threads the outgoing email onto the buyer's original message and stamps
// the reply as answered on send.
// ---------------------------------------------------------------------------

function ReplyFollowUpDialog({
  engagement,
  reply,
  locale,
  onClose,
  onSent,
}: {
  engagement: Engagement
  reply: EngagementReplyRow
  locale: "vi" | "en"
  onClose: () => void
  onSent: () => void
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai")
  const [viPrompt, setViPrompt] = useState("")
  const [manualSubject, setManualSubject] = useState(
    reply.subject && !/^re:/i.test(reply.subject.trim()) ? `Re: ${reply.subject.trim()}` : reply.subject || "",
  )
  const [manualContent, setManualContent] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<{
    draftId: string
    subject_en: string
    content_en: string
    content_vi: string
    recipient_email: string | null
    inReplyToMessageId: string | null
    usedFallback?: boolean
  } | null>(null)

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleGenerate = async () => {
    if (mode === "manual" && !manualContent.trim()) {
      toast.error(t("Vui lòng nhập nội dung email", "Please enter the email content"))
      return
    }
    setGenerating(true)
    const result = await generateFollowUpReplyEmailAction(
      mode === "manual"
        ? {
            engagementId: engagement.id,
            replyId: reply.id,
            viPrompt: "",
            isManual: true,
            manualSubject: manualSubject.trim() || t("Re: (không có chủ đề)", "Re: (no subject)"),
            manualContent: manualContent.trim(),
          }
        : {
            engagementId: engagement.id,
            replyId: reply.id,
            viPrompt,
          },
    )
    setGenerating(false)
    if (!result.ok) {
      toast.error(result.message || result.error)
      return
    }
    if (result.data.usedFallback) {
      toast.warning(
        t(
          "AI tạm không phản hồi — đã dùng mẫu email có sẵn, vui lòng kiểm tra lại trước khi gửi",
          "AI is temporarily unavailable — a fallback template was used, please review before sending",
        ),
      )
    }
    setDraft(result.data)
  }

  const handleSend = async () => {
    if (!draft) return
    if (!draft.recipient_email) {
      toast.error(t("Không xác định được email người nhận", "Could not determine recipient email"))
      return
    }
    setSending(true)
    const sendResult = await sendEmailDraftAction({
      draftId: draft.draftId,
      replyToMessageId: draft.inReplyToMessageId,
      markReplyId: reply.id,
    })
    setSending(false)
    if (!sendResult.ok) {
      toast.error(sendResult.message || sendResult.error)
      return
    }
    toast.success(t("Đã gửi email trả lời", "Reply email sent"))
    onSent()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Trả lời buyer", "Reply to buyer")}</DialogTitle>
          <DialogDescription>
            {t(
              "AI sẽ soạn email tr��� lời đúng n���i dung buyer vừa gửi. Bạn có thể chỉnh trước khi gửi.",
              "AI will draft a reply grounded in what the buyer just wrote. Review before sending.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("Buyer vừa viết: ", "Buyer wrote: ")}
          </p>
          <p className="text-foreground text-pretty line-clamp-4">
            {reply.translated_vi && locale === "vi" ? reply.translated_vi : reply.raw_content}
          </p>
        </div>

        {!draft ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "ai" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("Soạn bằng AI", "AI draft")}
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "manual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("Soạn tay", "Write manually")}
              </button>
            </div>

            {mode === "ai" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="vi-followup-prompt">
                    {t("Bạn muốn trả lời/đàm phán điểm gì?", "What should the reply address or negotiate?")}
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() =>
                      setViPrompt(
                        "Cảm ơn buyer đã quan tâm và phản hồi. Hỏi cụ thể để nắm yêu cầu chi tiết: 1) sản phẩm/spec cụ thể cần, 2) khoảng giá mục tiêu, 3) MOQ (số lượng đặt hàng tối thiểu), 4) điều kiện thanh toán mong muốn, 5) yêu cầu v�� bao bì/đóng gói, 6) các yêu cầu khác nếu có. Giữ giọng văn thân thiện, dễ trả lời theo từng điểm.",
                      )
                    }
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {t("Hỏi yêu cầu chi tiết", "Ask for detailed requirements")}
                  </Button>
                </div>
                <Textarea
                  id="vi-followup-prompt"
                  value={viPrompt}
                  onChange={(e) => setViPrompt(e.target.value)}
                  placeholder={t(
                    "VD: xác nhận có chứng nhận GlobalGAP, báo giá container 20ft...",
                    "E.g. confirm GlobalGAP certification, quote 20ft container price...",
                  )}
                  rows={3}
                />
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="manual-followup-subject">{t("Chủ đề", "Subject")}</Label>
                  <Input
                    id="manual-followup-subject"
                    value={manualSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-followup-content">{t("Nội dung email", "Email content")}</Label>
                  <Textarea
                    id="manual-followup-content"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder={t(
                      "Viết nội dung email trả lời buyer tại đây...",
                      "Write the reply email content here...",
                    )}
                    rows={8}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {draft.usedFallback && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-px" />
                <span>
                  {t(
                    "AI tạm không phản hồi (lỗi hoặc timeout) — nội dung dưới đây là mẫu email có sẵn (fallback), vui lòng đọc kỹ và chỉnh sửa trước khi gửi.",
                    "AI did not respond (error or timeout) — the content below is a static fallback template. Please review and edit before sending.",
                  )}
                </span>
              </div>
            )}
            <div>
              <Label>{t("Chủ đề", "Subject")}</Label>
              <Input
                value={draft.subject_en}
                onChange={(e) => setDraft({ ...draft, subject_en: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("Nội dung (English)", "Content (English)")}</Label>
              <Textarea
                value={draft.content_en}
                onChange={(e) => setDraft({ ...draft, content_en: e.target.value })}
                rows={8}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Người nhận: ", "Recipient: ")}
              {draft.recipient_email || t("(chưa có email)", "(no email on file)")}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          {!draft ? (
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "manual" ? (
                <CornerUpLeft className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {mode === "manual" ? t("Xem lại email", "Review email") : t("Soạn bằng AI", "Generate with AI")}
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
              {t("Gửi trả lời", "Send reply")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Record buyer requirements (stage: requirement_email_sent)
// ---------------------------------------------------------------------------

function RequirementFormDialog({
  engagement,
  locale,
  onClose,
  onSaved,
}: {
  engagement: Engagement
  locale: "vi" | "en"
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Omit<SaveRequirementsInput, "engagementId">>({
    requestedProducts: engagement.requested_products ?? "",
    targetPriceRange: engagement.target_price_range ?? "",
    moq: engagement.moq ?? "",
    paymentTerms: engagement.payment_terms ?? "",
    packagingRequirements: engagement.packaging_requirements ?? "",
    otherRequirements: engagement.other_requirements ?? "",
    // Default to "system_email" once the engagement has moved past
    // "claimed" (i.e. the in-system email was actually sent), otherwise
    // leave it unset so the AE must pick how they reached the buyer.
    contactChannel:
      (engagement.contact_channel as SaveRequirementsInput["contactChannel"]) ??
      (engagement.stage !== "claimed" ? "system_email" : undefined),
    contactChannelNote: engagement.contact_channel_note ?? "",
  })
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleSave = async () => {
    if (!form.contactChannel) {
      toast.error(
        t(
          "Vui lòng chọn kênh đã liên hệ với buyer",
          "Please select how you reached the buyer",
        ),
      )
      return
    }
    setSaving(true)
    const result = await saveBuyerRequirements({ engagementId: engagement.id, ...form })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(t("Đã lưu nhu cầu buyer", "Buyer requirements saved"))
    onSaved()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Nhu cầu của buyer", "Buyer requirements")}</DialogTitle>
          <DialogDescription>
            {t(
              "Nhập lại nội dung buyer đã phản hồi (qua email/điện thoại/WhatsApp).",
              "Record what the buyer answered (via email, phone, or WhatsApp).",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <Label>
              {t("Bạn đã liên hệ với buyer qua đâu?", "How did you reach the buyer?")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t(
                "Cập nhật lại nếu email hệ thống không đến được buyer, hoặc bạn (hoặc đồng nghiệp) đã liên hệ qua một kênh khác — kể cả sau khi đã gửi email.",
                "Update this if the in-system email never reached the buyer, or if you (or a colleague) contacted them through another channel — even after an email was already sent.",
              )}
            </p>
            <Select
              value={form.contactChannel}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, contactChannel: v as SaveRequirementsInput["contactChannel"] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Chọn kênh liên hệ", "Select a channel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system_email">{CONTACT_CHANNEL_LABELS.system_email[locale]}</SelectItem>
                <SelectItem value="linkedin">{CONTACT_CHANNEL_LABELS.linkedin[locale]}</SelectItem>
                <SelectItem value="whatsapp">{CONTACT_CHANNEL_LABELS.whatsapp[locale]}</SelectItem>
                <SelectItem value="phone">{CONTACT_CHANNEL_LABELS.phone[locale]}</SelectItem>
                <SelectItem value="other">{CONTACT_CHANNEL_LABELS.other[locale]}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t(
                "Ghi chú (VD: link LinkedIn, số điện thoại)",
                "Note (e.g. LinkedIn profile, phone number)",
              )}
              value={form.contactChannelNote}
              onChange={(e) => setForm((f) => ({ ...f, contactChannelNote: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("Sản phẩm / quy cách", "Product / spec")}</Label>
            <Textarea
              value={form.requestedProducts}
              onChange={(e) => setForm((f) => ({ ...f, requestedProducts: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Khoảng giá mục tiêu", "Target price range")}</Label>
              <Input
                value={form.targetPriceRange}
                onChange={(e) => setForm((f) => ({ ...f, targetPriceRange: e.target.value }))}
              />
            </div>
            <div>
              <Label>MOQ</Label>
              <Input value={form.moq} onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Điều kiện thanh toán", "Payment terms")}</Label>
              <Input
                value={form.paymentTerms}
                onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("Bao bì", "Packaging")}</Label>
              <Input
                value={form.packagingRequirements}
                onChange={(e) => setForm((f) => ({ ...f, packagingRequirements: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>{t("Yêu cầu khác", "Other requirements")}</Label>
            <Textarea
              value={form.otherRequirements}
              onChange={(e) => setForm((f) => ({ ...f, otherRequirements: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("Lưu", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Build the AI shortlist (stage: requirements_received / shortlist_ready)
// ---------------------------------------------------------------------------

function ShortlistBuilderDialog({
  engagement,
  clients,
  locale,
  onClose,
  onBuilt,
}: {
  engagement: Engagement
  clients: EngagementClient[]
  locale: "vi" | "en"
  onClose: () => void
  onBuilt: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [matches, setMatches] = useState<ClientMatchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const draftVersion = engagement.buyer_engagement_shortlist_versions.find((v) => v.status === "draft")
  const [selected, setSelected] = useState<Set<string>>(
    new Set((draftVersion?.buyer_engagement_shortlist_items ?? []).map((s) => s.client_id)),
  )
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const assignableIds = new Set(clients.map((c) => c.id))

  const handleLoadSuggestions = async () => {
    setLoading(true)
    setError(null)
    const result = await getAIMatchedClients(engagement.lead_id)
    setLoading(false)
    setLoaded(true)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMatches(result.data.filter((m) => assignableIds.has(m.clientId)))
  }

  const toggle = (clientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        if (next.size >= 3) {
          toast.error(t("Tối đa 3 supplier", "Maximum 3 suppliers"))
          return prev
        }
        next.add(clientId)
      }
      return next
    })
  }

  const handleBuild = async () => {
    if (selected.size < 1) {
      toast.error(t("Chọn ít nhất 1 supplier", "Select at least 1 supplier"))
      return
    }
    setSaving(true)
    const result = await buildShortlist(engagement.id, Array.from(selected))
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(t("Đã tạo shortlist", "Shortlist created"))
    onBuilt()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Chọn tối đa 3 supplier phù hợp nhất", "Pick up to 3 best-fit suppliers")}</DialogTitle>
          <DialogDescription>
            {t(
              "Dựa trên nhu cầu buyer đã ghi nhận, AI xếp hạng supplier phù hợp. Buyer sẽ thấy đúng 3 lựa chọn (Option A/B/C) — nếu chọn ít hơn 3, hãy đảm bảo có lý do rõ ràng (ví dụ: không đủ supplier đạt tiêu chí) để có thể giải thích cho buyer.",
              "Based on the buyer's recorded requirements, AI ranks the best-fit suppliers. The buyer will see exactly 3 options (Option A/B/C) — if you select fewer than 3, make sure you have a clear reason (e.g. not enough qualifying suppliers) you can explain to the buyer.",
            )}
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <Button onClick={handleLoadSuggestions} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("Tải gợi ý AI", "Load AI suggestions")}
            </Button>
          </div>
        ) : error && matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{error}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {matches.length > 0 && matches.every((m) => m.finalScore < LOW_MATCH_SCORE_THRESHOLD) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-px" />
                <span>
                  {t(
                    "Chưa có supplier nào thực sự phù hợp với nhu cầu buyer (điểm khớp đều dưới " +
                      LOW_MATCH_SCORE_THRESHOLD +
                      "/100). Cân nhắc báo buyer chờ thêm thời gian tìm supplier, mở rộng tiêu chí tìm kiếm, hoặc bổ sung supplier mới vào hệ thống trước khi gửi shortlist.",
                    "No supplier is a strong fit for this buyer's requirements (all match scores are below " +
                      LOW_MATCH_SCORE_THRESHOLD +
                      "/100). Consider telling the buyer you need more time to source, broadening the search criteria, or onboarding a new supplier before sending a shortlist.",
                  )}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
              {matches.map((m, idx) => {
                const scoreTone =
                  m.finalScore < LOW_MATCH_SCORE_THRESHOLD
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                    : m.finalScore < MEDIUM_MATCH_SCORE_THRESHOLD
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                return (
                  <label
                    key={m.clientId}
                    className="flex items-center gap-2.5 rounded-md border bg-background px-2.5 py-2 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selected.has(m.clientId)}
                      onCheckedChange={() => toggle(m.clientId)}
                    />
                    <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                    <span className="flex-1 truncate text-sm font-medium">{m.clientName}</span>
                    {m.finalScore < LOW_MATCH_SCORE_THRESHOLD && (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <Badge variant="outline" className={cn("shrink-0 text-[10px]", scoreTone)}>
                      {m.finalScore}
                    </Badge>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleBuild} disabled={saving || selected.size === 0} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t(`Tạo shortlist (${selected.size})`, `Create shortlist (${selected.size})`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Create the share link + draft & send the shortlist_delivery email
// (stage: shortlist_ready)
// ---------------------------------------------------------------------------

function SendShortlistDialog({
  engagement,
  locale,
  onClose,
  onSent,
}: {
  engagement: Engagement
  locale: "vi" | "en"
  onClose: () => void
  onSent: () => void
}) {
  const [step, setStep] = useState<"link" | "email">("link")
  const [url, setUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<{
    draftId: string
    subject_en: string
    content_en: string
    recipient_email: string | null
    usedFallback?: boolean
  } | null>(null)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const draftVersion = engagement.buyer_engagement_shortlist_versions.find((v) => v.status === "draft")

  // The shortlist is almost always sent after the buyer already replied to
  // the opening/requirement email — thread it onto their most recent
  // message so Gmail keeps it in the same (already Primary) conversation
  // instead of starting a brand-new thread that gets re-classified.
  const latestReplyMessageId = [...(engagement.buyer_replies ?? [])].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  )[0]?.message_id

  const handleCreateLink = async () => {
    if (!draftVersion) {
      toast.error(t("Không tìm thấy bản nháp shortlist", "No draft shortlist version found"))
      return
    }
    setCreating(true)
    const result = await approveAndSendShortlist(draftVersion.id)
    setCreating(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setUrl(result.data.url)
    setStep("email")
  }

  const handleGenerate = async () => {
    if (!url) return
    setGenerating(true)
    const result = await generateRequirementInquiryEmailAction({
      engagementId: engagement.id,
      viPrompt: "",
      emailType: "shortlist_delivery",
      shortlistUrl: url,
    })
    setGenerating(false)
    if (!result.ok) {
      toast.error(result.message || result.error)
      return
    }
    if (result.data.usedFallback) {
      toast.warning(
        t(
          "AI tạm không phản hồi — đã dùng mẫu email có sẵn, vui lòng kiểm tra lại trước khi gửi",
          "AI is temporarily unavailable — a fallback template was used, please review before sending",
        ),
      )
    }
    setDraft(result.data)
  }

  const handleSend = async () => {
    if (!draft) return
    if (!draft.recipient_email) {
      toast.error(t("Buyer chưa có email liên hệ", "Buyer has no contact email"))
      return
    }
    setSending(true)
    const result = await sendEmailDraftAction({
      draftId: draft.draftId,
      replyToMessageId: latestReplyMessageId,
    })
    setSending(false)
    if (!result.ok) {
      toast.error(result.message || result.error)
      return
    }
    toast.success(t("Đã gửi shortlist cho buyer", "Shortlist sent to buyer"))
    onSent()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Gửi shortlist cho buyer", "Send shortlist to buyer")}</DialogTitle>
          <DialogDescription>
            {t(
              "Tạo link công khai cho buyer xem profile các supplier, rồi soạn email mời họ mở link.",
              "Create a public link so the buyer can view supplier profiles, then draft an email inviting them to open it.",
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "link" ? (
          <div className="py-4">
            <Button onClick={handleCreateLink} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t("Tạo link shortlist", "Create shortlist link")}
            </Button>
          </div>
        ) : !draft ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              <span className="truncate">{url}</span>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("Soạn email bằng AI", "Generate email with AI")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {draft.usedFallback && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-px" />
                <span>
                  {t(
                    "AI tạm không phản hồi (lỗi hoặc timeout) — nội dung dưới đây là mẫu email có sẵn (fallback), vui lòng đọc kỹ và chỉnh sửa trước khi gửi.",
                    "AI did not respond (error or timeout) — the content below is a static fallback template. Please review and edit before sending.",
                  )}
                </span>
              </div>
            )}
            <div>
              <Label>{t("Chủ đề", "Subject")}</Label>
              <Input value={draft.subject_en} onChange={(e) => setDraft({ ...draft, subject_en: e.target.value })} />
            </div>
            <div>
              <Label>{t("Nội dung", "Content")}</Label>
              <Textarea
                value={draft.content_en}
                onChange={(e) => setDraft({ ...draft, content_en: e.target.value })}
                rows={7}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Người nhận: ", "Recipient: ")}
              {draft.recipient_email || t("(chưa có email)", "(no email on file)")}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          {draft && (
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("Gửi email", "Send email")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Convert to opportunity — pick final client(s) among the shortlist
// ---------------------------------------------------------------------------

type SupplierRole = "primary" | "backup" | "alternative"

const ROLE_LABELS: Record<SupplierRole, { vi: string; en: string }> = {
  primary: { vi: "Chính", en: "Primary" },
  backup: { vi: "Dự phòng", en: "Backup" },
  alternative: { vi: "Thay thế", en: "Alternative" },
}

function ConvertDialog({
  engagement,
  locale,
  onClose,
  onConverted,
}: {
  engagement: Engagement
  locale: "vi" | "en"
  onClose: () => void
  onConverted: () => void
}) {
  // Prefer the sent (immutable, buyer-facing) version's items since that
  // reflects what the buyer actually reacted to; fall back to the newest
  // version otherwise.
  const versions = [...engagement.buyer_engagement_shortlist_versions].sort(
    (a, b) => b.version_number - a.version_number,
  )
  const items = (versions.find((v) => v.status === "sent") ?? versions[0])?.buyer_engagement_shortlist_items ?? []

  const [roles, setRoles] = useState<Map<string, SupplierRole>>(() => {
    const initial = new Map<string, SupplierRole>()
    const interested = items.filter((s) => s.buyer_interested === true)
    interested.forEach((s, idx) => initial.set(s.client_id, idx === 0 ? "primary" : "backup"))
    return initial
  })
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const toggle = (clientId: string) => {
    setRoles((prev) => {
      const next = new Map(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.set(clientId, next.size === 0 ? "primary" : "backup")
      }
      return next
    })
  }

  const setRole = (clientId: string, role: SupplierRole) => {
    setRoles((prev) => new Map(prev).set(clientId, role))
  }

  const handleConvert = async () => {
    if (roles.size === 0) {
      toast.error(t("Chọn ít nhất 1 client", "Select at least 1 client"))
      return
    }
    if (!Array.from(roles.values()).includes("primary")) {
      toast.error(t("Phải có 1 supplier vai trò Chính", "One supplier must be marked Primary"))
      return
    }
    const assignments: ConvertRoleAssignment[] = Array.from(roles.entries()).map(([clientId, role]) => ({
      clientId,
      role,
    }))
    setSaving(true)
    const result = await convertEngagementToOpportunities(engagement.id, assignments)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      t(
        `Đã tạo ${result.data.opportunityIds.length} opportunity, buyer chuyển vào Kanban`,
        `${result.data.opportunityIds.length} opportunity created — buyer moved to Kanban`,
      ),
    )
    onConverted()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Gán client & tạo Opportunity", "Assign client & create Opportunity")}</DialogTitle>
          <DialogDescription>
            {t(
              "Chọn (những) client buyer đã quan tâm và gán vai trò để tạo opportunity, chuyển vào Kanban pipeline. Cần đúng 1 supplier vai trò Chính.",
              "Pick the client(s) the buyer showed interest in and assign a role to create opportunities and move them onto the Kanban pipeline. Exactly one supplier must be Primary.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {items.map((s) => {
            const role = roles.get(s.client_id)
            return (
              <div key={s.client_id} className="flex items-center gap-2.5 rounded-md border bg-background px-2.5 py-2">
                <Checkbox checked={!!role} onCheckedChange={() => toggle(s.client_id)} />
                <span className="flex-1 truncate text-sm font-medium">
                  {s.profiles?.company_name || s.profiles?.full_name || "—"}
                </span>
                {s.buyer_interested === true && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]" variant="outline">
                    {t("Quan tâm", "Interested")}
                  </Badge>
                )}
                {role && (
                  <div className="flex gap-1">
                    {(["primary", "backup", "alternative"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(s.client_id, r)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          role === r
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {t(ROLE_LABELS[r].vi, ROLE_LABELS[r].en)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleConvert} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {t("Tạo Opportunity", "Create Opportunity")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



// ══════════════════════════════════════════════════════════════════════════════
// Host — map a stage-action key to the dialog that performs it
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Renders the dialog for `action`, or nothing when `action` is null.
 *
 * Both surfaces use this, which is what makes "the inbox and the buyer page do
 * the same things" structural rather than a promise: there is one mapping from
 * `StageActionKey` to dialog, and adding a stage action means editing
 * lib/buyers/engagement-stages.ts (what to offer) plus this switch (how to do
 * it) — never a second copy of a dialog.
 *
 * `emailVariant` lets the buyer page open the composer as a side panel
 * (`sheet`, so the analysis stays visible) while the inbox keeps its modal.
 */
export function EngagementStageDialogHost({
  action,
  engagement,
  clients,
  locale,
  emailVariant = "dialog",
  emailContextHints,
  onClose,
  onDone,
}: {
  /** Which stage action to perform; null renders nothing. */
  action: StageActionKey | null
  /** Fully-loaded engagement row (shortlist versions + replies included). */
  engagement: Engagement
  /** Assignable clients — required by the shortlist builder only. */
  clients: EngagementClient[]
  locale: "vi" | "en"
  emailVariant?: "dialog" | "sheet"
  /** Bullets for the composer's context block (buyer page only). */
  emailContextHints?: string[]
  onClose: () => void
  /** Called after a successful action, in addition to closing. */
  onDone: () => void
}) {
  if (!action) return null

  switch (action) {
    case "draft_opening_email":
      return (
        <RequirementEmailComposer
          engagementId={engagement.id}
          locale={locale}
          variant={emailVariant}
          contextHints={emailContextHints}
          onClose={onClose}
          onSent={onDone}
        />
      )
    case "record_requirements":
    case "record_requirements_offline":
      return (
        <RequirementFormDialog
          engagement={engagement}
          locale={locale}
          onClose={onClose}
          onSaved={onDone}
        />
      )
    case "resend_email":
      return (
        <ResendFollowUpDialog
          engagement={engagement}
          locale={locale}
          onClose={onClose}
          onSent={onDone}
        />
      )
    case "pick_suppliers":
    case "new_shortlist_version":
      return (
        <ShortlistBuilderDialog
          engagement={engagement}
          clients={clients}
          locale={locale}
          onClose={onClose}
          onBuilt={onDone}
        />
      )
    case "approve_shortlist":
      return (
        <SendShortlistDialog
          engagement={engagement}
          locale={locale}
          onClose={onClose}
          onSent={onDone}
        />
      )
    case "record_decline":
      // Closing the file, not deleting the history: the same action the admin
      // menu's "Hủy buyer" performs, surfaced as the next step once the buyer
      // has said no. `variant` only changes the copy.
      return (
        <DropEngagementDialog
          engagement={engagement}
          locale={locale}
          variant="decline"
          onClose={onClose}
          onDropped={onDone}
        />
      )
    case "convert_to_opportunity":
      return (
        <ConvertDialog
          engagement={engagement}
          locale={locale}
          onClose={onClose}
          onConverted={onDone}
        />
      )
    default:
      // Exhaustive over StageActionKey — a new key fails the build here rather
      // than silently doing nothing.
      return null
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Reply follow-up — not a stage action; triggered from a specific reply
// ══════════════════════════════════════════════════════════════════════════════

export function EngagementReplyFollowUpDialog({
  engagement,
  reply,
  locale,
  onClose,
  onSent,
}: {
  engagement: Engagement
  reply: EngagementReplyRow
  locale: "vi" | "en"
  onClose: () => void
  onSent: () => void
}) {
  return (
    <ReplyFollowUpDialog
      engagement={engagement}
      reply={reply}
      locale={locale}
      onClose={onClose}
      onSent={onSent}
    />
  )
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

export function DropEngagementDialog({
  engagement,
  locale,
  variant = "drop",
  onClose,
  onDropped,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  /**
   * "drop"    — the AE abandons the buyer (admin menu).
   * "decline" — the buyer refused; the AE is recording that and closing. Same
   *             write, different words, so the two paths do not read alike.
   */
  variant?: "drop" | "decline"
  onClose: () => void
  onDropped: () => void
}) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const declining = variant === "decline"

  const handleDrop = async () => {
    setSaving(true)
    const result = await dropEngagement(engagement.id, reason)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      declining
        ? t("Đã ghi nhận từ chối và đóng hồ sơ", "Decline recorded, file closed")
        : t("Đã hủy buyer này", "Buyer dropped"),
    )
    onDropped()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Hủy buyer này?", "Drop this buyer?")}
          </DialogTitle>
          <DialogDescription>
            {declining ? (
              <>
                {t(
                  `Ghi nhận buyer ${engagement.leads?.company_name} đã từ chối và đóng hồ sơ này. Buyer sẽ ra khỏi danh sách đang xử lý — bạn có thể xem lại ở tab "Buyer". Lý do bạn ghi bên dưới được lưu lại cùng hồ sơ.`,
                  `Record that ${engagement.leads?.company_name} declined and close this file. The buyer leaves your in-progress list (still visible under "Buyers"), and the reason below is kept with the record.`,
                )}
              </>
            ) : (
              t(
                `Buyer ${engagement.leads?.company_name} sẽ được đưa ra khỏi danh sách đang xử lý.`,
                `${engagement.leads?.company_name} will be removed from your in-progress list.`,
              )
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            declining
              ? t("Buyer từ chối vì... (nên ghi lại)", "Why they declined... (worth recording)")
              : t("Lý do (tùy chọn)...", "Reason (optional)...")
          }
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Không hủy", "Keep it")}
          </Button>
          <Button variant="destructive" onClick={handleDrop} disabled={saving}>
            {declining
              ? t("Ghi nhận từ chối & đóng", "Record decline & close")
              : t("Xác nhận hủy", "Confirm drop")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Transfer the engagement to another AE — covers the case where LR routed the
 * buyer by industry match, but the buyer's actual product ask doesn't fit any
 * client this AE manages.
 */
export function TransferEngagementDialog({
  engagement,
  locale,
  onClose,
  onTransferred,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onClose: () => void
  onTransferred: () => void
}) {
  const [candidates, setCandidates] = useState<TransferCandidateAE[] | null>(null)
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [targetId, setTargetId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  useEffect(() => {
    let active = true
    setLoadingCandidates(true)
    listTransferCandidateAEs(engagement.account_manager_id).then((result) => {
      if (!active) return
      setCandidates(result.ok ? result.data : [])
      setLoadingCandidates(false)
    })
    return () => {
      active = false
    }
  }, [engagement.account_manager_id])

  const handleTransfer = async () => {
    if (!targetId) {
      toast.error(t("Vui lòng chọn AE nhận buyer", "Please choose a receiving AE"))
      return
    }
    if (!reason.trim()) {
      toast.error(t("Vui lòng nhập lý do chuyển", "Please enter a transfer reason"))
      return
    }
    setSaving(true)
    const result = await transferEngagement(engagement.id, targetId, reason)
    setSaving(false)
    if (!result.ok) {
      const transferErrors: Record<string, string> = {
        ae_at_capacity: t(
          "AE nhận đã đạt giới hạn buyer đang xử lý",
          "The receiving AE has reached their active-buyer cap",
        ),
        not_your_engagement: t("Bạn không sở hữu buyer này", "You don't own this buyer"),
        already_owned_by_target: t("Buyer này đã thuộc về AE được chọn", "This buyer already belongs to the selected AE"),
        target_not_ae: t("Người được chọn không phải AE", "The selected person is not an AE"),
        engagement_already_closed: t("Buyer đã đóng", "This buyer is already closed"),
      }
      toast.error(transferErrors[result.error] ?? result.error)
      return
    }
    toast.success(t("Đã chuyển buyer cho AE khác", "Buyer transferred"))
    onTransferred()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Chuyển buyer cho AE khác", "Transfer buyer to another AE")}</DialogTitle>
          <DialogDescription>
            {t(
              `Dùng khi buyer ${engagement.leads?.company_name ?? ""} hỏi sản phẩm không khớp với client bạn đang quản lý. Buyer sẽ được gán cho AE khác, kèm lý do để AE đó nắm bối cảnh.`,
              `Use this when ${engagement.leads?.company_name ?? "this buyer"} is asking for a product none of your clients cover. The buyer moves to another AE, along with the reason for context.`,
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("Chuyển cho", "Transfer to")}</Label>
            <Select value={targetId} onValueChange={setTargetId} disabled={loadingCandidates}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingCandidates
                      ? t("Đang tải danh sách AE...", "Loading AEs...")
                      : t("Chọn AE nhận buyer", "Choose a receiving AE")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(candidates ?? []).map((ae) => (
                  <SelectItem key={ae.id} value={ae.id}>
                    {ae.fullName || ae.companyName || ae.id}
                    {" — "}
                    {t(
                      `${ae.activeEngagementCount} buyer đang xử lý`,
                      `${ae.activeEngagementCount} in progress`,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("Lý do chuyển", "Transfer reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                "Ví dụ: Buyer hỏi sản phẩm khác ngành với client tôi đang quản lý...",
                "E.g. Buyer is asking for a product outside my clients' category...",
              )}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleTransfer} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            {t("Chuyển buyer", "Transfer buyer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Return a claimed buyer to the shared inbox — the AE cannot work this buyer
 * (wrong industry / overload) and releases it so any AE can claim it again,
 * instead of just dropping it into a dead end.
 */
export function ReturnToInboxDialog({
  engagement,
  locale,
  onClose,
  onReturned,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onClose: () => void
  onReturned: () => void
}) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleReturn = async () => {
    if (!reason.trim()) {
      toast.error(t("Vui lòng nhập lý do trả buyer", "Please enter a reason"))
      return
    }
    setSaving(true)
    const result = await returnBuyerToInbox({
      engagementId: engagement.id,
      reason,
    })
    setSaving(false)
    if (!result.ok) {
      const copy: Record<string, string> = {
        not_your_engagement: t("Bạn không sở hữu buyer này", "You don't own this buyer"),
        engagement_already_closed: t("Buyer đã đóng", "This buyer is already closed"),
        reason_required: t("Vui lòng nhập lý do", "Reason is required"),
      }
      toast.error(copy[result.error] ?? result.error)
      return
    }
    toast.success(t("Đã trả buyer về hộp thư chung", "Buyer returned to the shared inbox"))
    onReturned()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Trả buyer về hộp thư chung?", "Return buyer to shared inbox?")}</DialogTitle>
          <DialogDescription>
            {t(
              `Buyer ${engagement.leads?.company_name ?? ""} sẽ được gỡ khỏi danh sách của bạn và xuất hiện lại trong hộp thư chung để AE khác nhận. Hãy ghi rõ lý do để AE tiếp theo nắm bối cảnh.`,
              `${engagement.leads?.company_name ?? "This buyer"} will leave your queue and reappear in the shared inbox for another AE to claim. Explain why so the next AE has context.`,
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t(
            "Ví dụ: Tôi đang quá tải, buyer cần AE am hiểu ngành gỗ...",
            "E.g. I am at capacity; this buyer needs an AE covering timber...",
          )}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleReturn} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
            {t("Trả về hộp thư", "Return to inbox")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
