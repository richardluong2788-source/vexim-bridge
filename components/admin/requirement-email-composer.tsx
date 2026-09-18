"use client"

/**
 * "Soạn email mở đầu" composer — one implementation, two surfaces:
 *
 *   variant="dialog" (default) — modal, used by the AE inbox card, exactly the
 *     flow that was already there.
 *   variant="sheet"            — right-hand panel, used by the buyer profile's
 *     "Phân tích" tab. The panel sits next to the analysis instead of replacing
 *     the page, so the AE writes the opening email while reading the buyer's
 *     scores, talking points and timing — instead of being sent back to the
 *     inbox and losing the context they were just looking at.
 *
 * All the logic (AI draft / write manually, generate, review, send, mark the
 * engagement as contacted) lives here once and is identical for both surfaces;
 * only the chrome differs.
 */

import { useState } from "react"
import { AlertTriangle, CornerUpLeft, Loader2, Mail, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  generateRequirementInquiryEmailAction,
  markEngagementEmailSentAction,
} from "@/app/admin/ae-inbox/requirement-email-actions"
import { sendEmailDraftAction } from "@/app/admin/opportunities/email-actions"

/** The draft shape returned by generateRequirementInquiryEmailAction. */
interface ComposerDraft {
  draftId: string
  subject_en: string
  content_en: string
  content_vi: string
  recipient_email: string | null
  usedFallback?: boolean
}

export function RequirementEmailComposer({
  engagementId,
  locale,
  variant = "dialog",
  contextHints = [],
  onClose,
  onSent,
}: {
  engagementId: string
  locale: "vi" | "en"
  variant?: "dialog" | "sheet"
  /**
   * Short bullets to keep in view while writing (the buyer's AI talking points,
   * or the rule-based fallback tips). Only used by the sheet variant — in the
   * dialog the page behind it is the analysis.
   */
  contextHints?: string[]
  onClose: () => void
  onSent: () => void
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai")
  const [viPrompt, setViPrompt] = useState("")
  const [manualSubject, setManualSubject] = useState("")
  const [manualContent, setManualContent] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<ComposerDraft | null>(null)

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleGenerate = async () => {
    if (mode === "manual" && !manualContent.trim()) {
      toast.error(t("Vui lòng nhập nội dung email", "Please enter the email content"))
      return
    }
    setGenerating(true)
    const result = await generateRequirementInquiryEmailAction(
      mode === "manual"
        ? {
            engagementId,
            viPrompt: "",
            isManual: true,
            manualSubject: manualSubject.trim() || t("(không có chủ đề)", "(no subject)"),
            manualContent: manualContent.trim(),
          }
        : {
            engagementId,
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
      toast.error(t("Buyer chưa có email liên hệ", "Buyer has no contact email"))
      return
    }
    setSending(true)
    const sendResult = await sendEmailDraftAction({ draftId: draft.draftId })
    if (!sendResult.ok) {
      setSending(false)
      toast.error(sendResult.message || sendResult.error)
      return
    }
    await markEngagementEmailSentAction(engagementId)
    setSending(false)
    toast.success(t("Đã gửi email mở đầu", "Opening email sent"))
    onSent()
  }

  // --- Body + actions, shared by both wrappers -----------------------------

  const body = !draft ? (
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
          <Label htmlFor="vi-prompt">
            {t("Hướng dẫn thêm cho AI (không bắt buộc)", "Extra instructions for AI (optional)")}
          </Label>
          <Textarea
            id="vi-prompt"
            value={viPrompt}
            onChange={(e) => setViPrompt(e.target.value)}
            placeholder={t(
              "VD: nhấn mạnh Vexim đã làm việc với nhiều nhà máy đạt chuẩn xuất khẩu...",
              "E.g. emphasize Vexim works with export-certified factories...",
            )}
            rows={3}
          />
        </>
      ) : (
        <>
          <div>
            <Label htmlFor="manual-req-subject">{t("Chủ đề", "Subject")}</Label>
            <Input
              id="manual-req-subject"
              value={manualSubject}
              onChange={(e) => setManualSubject(e.target.value)}
              placeholder={t(
                "VD: Sourcing from Vietnam — coconuts & cashew nuts",
                "E.g. Sourcing from Vietnam — coconuts & cashew nuts",
              )}
            />
          </div>
          <div>
            <Label htmlFor="manual-req-content">{t("Nội dung email", "Email content")}</Label>
            <Textarea
              id="manual-req-content"
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              placeholder={t(
                "Viết nội dung email mở đầu gửi buyer tại đây...",
                "Write the opening email content here...",
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
  )

  const actions = (
    <>
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
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {t("Gửi email", "Send email")}
        </Button>
      )}
    </>
  )

  const title = t("Soạn email mở đầu cho buyer", "Draft opening email")
  const description = t(
    "AI sẽ soạn email giới thiệu Vexim và hỏi buyer có muốn đánh giá thêm nguồn cung từ Việt Nam không. Chưa hỏi chi tiết MOQ/giá/thanh toán/bao bì ở bước này.",
    "AI will draft an email introducing Vexim and asking whether the buyer would like to evaluate additional sourcing from Vietnam. No MOQ/price/payment/packaging questions at this step.",
  )

  if (variant === "sheet") {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          // Wide enough to write in; the lighter backdrop keeps the analysis on
          // the left readable while composing.
          // Fix: previously the content (contextHints + body) was direct children
          // of SheetContent which has no horizontal padding, so it stuck to the
          // edges (dính sát mép). Use p-0 + flex-col on shell and give the
          // scrollable body its own px-4 py-4.
          className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden gap-0"
          overlayClassName="bg-black/20"
        >
          <SheetHeader className="shrink-0 border-b">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* The buyer's talking points / tips, so the email can reference the
                same material the AE is reading next to this panel. */}
            {contextHints.length > 0 && (
              <div className="rounded-md border border-chart-1/30 bg-chart-1/5 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-chart-1" />
                  {t("Gợi ý cho email này", "Material for this email")}
                </div>
                <ul className="space-y-1">
                  {contextHints.map((hint, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-chart-1" />
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {body}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t bg-background shrink-0">
            {actions}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {body}

        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
