"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Globe,
  User,
  Mail,
  ClipboardList,
  Sparkles,
  Link2,
  Copy,
  Check,
  X,
  Loader2,
  Eye,
  ArrowRight,
  Package,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  saveBuyerRequirements,
  buildShortlist,
  approveAndSendShortlist,
  createNewShortlistVersion,
  convertEngagementToOpportunities,
  dropEngagement,
  type SaveRequirementsInput,
  type ConvertRoleAssignment,
} from "@/app/admin/ae-inbox/engagement-actions"
import {
  generateRequirementInquiryEmailAction,
  markEngagementEmailSentAction,
} from "@/app/admin/ae-inbox/requirement-email-actions"
import { sendEmailDraftAction } from "@/app/admin/opportunities/email-actions"
import { getAIMatchedClients } from "@/app/admin/buyers/actions"
import type { ClientMatchResult } from "@/lib/matching/client-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuyerActionValue =
  | "viewed_only"
  | "interested_no_details"
  | "requested_info"
  | "requested_sample"
  | "requested_meeting"
  | "selected_primary"
  | "sent_price_volume"
  | "sent_po"

interface ShortlistItemRow {
  id: string
  client_id: string
  position: number
  match_score: number | null
  buyer_interested: boolean | null
  buyer_action: BuyerActionValue | null
  buyer_responded_at: string | null
  profiles: { id: string; company_name: string | null; full_name: string | null } | null
}

interface ShortlistVersionRow {
  id: string
  version_number: number
  status: "draft" | "sent" | "superseded"
  scoring_engine_version: string
  created_at: string
  sent_at: string | null
  superseded_at: string | null
  buyer_engagement_shortlist_items: ShortlistItemRow[]
}

interface ShareLinkRow {
  token: string
  version_id: string | null
  view_count: number
  last_viewed_at: string | null
  revoked_at: string | null
}

export interface Engagement {
  id: string
  lead_id: string
  account_manager_id: string
  stage: string
  requested_products: string | null
  target_price_range: string | null
  moq: string | null
  payment_terms: string | null
  packaging_requirements: string | null
  other_requirements: string | null
  created_at: string
  updated_at: string
  leads: {
    id: string
    company_name: string
    contact_person: string | null
    contact_email: string | null
    country: string | null
    industry: string | null
    main_product: string | null
  } | null
  buyer_engagement_shortlist_versions: ShortlistVersionRow[]
  shortlist_share_links: ShareLinkRow[]
}

interface Client {
  id: string
  full_name: string | null
  company_name: string | null
}

interface EngagementListProps {
  engagements: Engagement[]
  clients: Client[]
  locale: "vi" | "en"
}

const STAGE_LABELS: Record<string, { vi: string; en: string; tone: string }> = {
  claimed: { vi: "Đã nhận — chưa hỏi nhu cầu", en: "Claimed — not contacted yet", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  requirement_email_sent: { vi: "Đã gửi email hỏi nhu cầu", en: "Requirement email sent", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  requirements_received: { vi: "Đã có nhu cầu buyer", en: "Requirements received", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  shortlist_ready: { vi: "Shortlist đã sẵn sàng", en: "Shortlist ready", tone: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  shortlist_sent: { vi: "Đã gửi shortlist cho buyer", en: "Shortlist sent to buyer", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  buyer_viewed: { vi: "Buyer đã xem shortlist", en: "Buyer viewed shortlist", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  buyer_responded: { vi: "Buyer đã phản hồi", en: "Buyer responded", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  qualified_interest: { vi: "Buyer quan tâm — cần quyết định", en: "Qualified interest — needs decision", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
}

const BUYER_ACTION_LABELS: Record<BuyerActionValue, { vi: string; en: string }> = {
  viewed_only: { vi: "Chỉ xem", en: "Viewed only" },
  interested_no_details: { vi: "Quan tâm (chưa chi tiết)", en: "Interested (no details)" },
  requested_info: { vi: "Hỏi thêm thông tin", en: "Requested info" },
  requested_sample: { vi: "Yêu cầu mẫu", en: "Requested sample" },
  requested_meeting: { vi: "Yêu cầu họp", en: "Requested meeting" },
  selected_primary: { vi: "Chọn làm supplier chính", en: "Selected as primary" },
  sent_price_volume: { vi: "Gửi giá & số lượng", en: "Sent price & volume" },
  sent_po: { vi: "Đã gửi PO", en: "Sent PO" },
}

export function EngagementList({ engagements, clients, locale }: EngagementListProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [reqEmailDialogFor, setReqEmailDialogFor] = useState<Engagement | null>(null)
  const [reqFormDialogFor, setReqFormDialogFor] = useState<Engagement | null>(null)
  const [shortlistDialogFor, setShortlistDialogFor] = useState<Engagement | null>(null)
  const [sendShortlistDialogFor, setSendShortlistDialogFor] = useState<Engagement | null>(null)
  const [convertDialogFor, setConvertDialogFor] = useState<Engagement | null>(null)
  const [dropDialogFor, setDropDialogFor] = useState<Engagement | null>(null)

  if (engagements.length === 0) return null

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {t("Đang xử lý", "In progress")}
        </h2>
        <Badge variant="outline" className="text-xs">
          {engagements.length}
        </Badge>
      </div>

      <div className="grid gap-4">
        {engagements.map((eng) => {
          const lead = eng.leads
          const stageInfo = STAGE_LABELS[eng.stage] ?? STAGE_LABELS.claimed
          const versions = [...eng.buyer_engagement_shortlist_versions].sort(
            (a, b) => b.version_number - a.version_number,
          )
          const sentVersion = versions.find((v) => v.status === "sent") ?? null
          const draftVersion = versions.find((v) => v.status === "draft") ?? null
          // Prefer showing the sent (live, immutable) version to reflect
          // what the buyer actually saw; fall back to the newest draft
          // while nothing has been sent yet.
          const displayVersion = sentVersion ?? draftVersion ?? versions[0] ?? null
          const shortlist = displayVersion
            ? [...displayVersion.buyer_engagement_shortlist_items].sort((a, b) => a.position - b.position)
            : []
          const shareLink = sentVersion
            ? eng.shortlist_share_links.find((l) => l.version_id === sentVersion.id) ?? null
            : null
          const interestedCount = shortlist.filter((s) => s.buyer_interested === true).length

          return (
            <Card key={eng.id} className={cn(pending && "opacity-50 pointer-events-none")}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{lead?.company_name || "—"}</h3>
                      <Badge variant="outline" className={cn(stageInfo.tone)}>
                        {locale === "vi" ? stageInfo.vi : stageInfo.en}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {lead?.industry && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {lead.industry}
                        </span>
                      )}
                      {lead?.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {lead.country}
                        </span>
                      )}
                      {lead?.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {lead.contact_person}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => setDropDialogFor(eng)}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("Hủy buyer", "Drop")}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Recorded buyer requirements */}
                {(eng.requested_products || eng.moq || eng.target_price_range) && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                    {eng.requested_products && (
                      <div>
                        <span className="text-muted-foreground">{t("Sản phẩm: ", "Product: ")}</span>
                        {eng.requested_products}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-muted-foreground">
                      {eng.target_price_range && (
                        <span>
                          {t("Giá mục tiêu: ", "Target price: ")}
                          <span className="text-foreground">{eng.target_price_range}</span>
                        </span>
                      )}
                      {eng.moq && (
                        <span>
                          MOQ: <span className="text-foreground">{eng.moq}</span>
                        </span>
                      )}
                      {eng.payment_terms && (
                        <span>
                          {t("Thanh toán: ", "Payment: ")}
                          <span className="text-foreground">{eng.payment_terms}</span>
                        </span>
                      )}
                      {eng.packaging_requirements && (
                        <span>
                          {t("Bao bì: ", "Packaging: ")}
                          <span className="text-foreground">{eng.packaging_requirements}</span>
                        </span>
                      )}
                    </div>
                    {eng.other_requirements && (
                      <div className="text-muted-foreground">
                        {t("Khác: ", "Other: ")}
                        {eng.other_requirements}
                      </div>
                    )}
                  </div>
                )}

                {/* Shortlist */}
                {shortlist.length > 0 && displayVersion && (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>
                        {t(
                          `Shortlist v${displayVersion.version_number} (${shortlist.length} supplier)`,
                          `Shortlist v${displayVersion.version_number} (${shortlist.length} suppliers)`,
                        )}
                        {displayVersion.status === "draft" && (
                          <span className="ml-1.5 text-amber-600">{t("— chưa gửi", "— not sent yet")}</span>
                        )}
                      </span>
                      {shareLink && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {t(`${shareLink.view_count} lượt xem`, `${shareLink.view_count} views`)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {shortlist.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm"
                        >
                          <span className="truncate font-medium">
                            {s.profiles?.company_name || s.profiles?.full_name || "—"}
                          </span>
                          {s.buyer_action ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20" variant="outline">
                              {t(BUYER_ACTION_LABELS[s.buyer_action].vi, BUYER_ACTION_LABELS[s.buyer_action].en)}
                            </Badge>
                          ) : s.buyer_interested === false ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t("Không quan tâm", "Passed")}
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {shareLink && (
                      <ShareLinkRow locale={locale} token={shareLink.token} />
                    )}
                  </div>
                )}

                {/* Stage actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {eng.stage === "claimed" && (
                    <Button size="sm" className="gap-2" onClick={() => setReqEmailDialogFor(eng)}>
                      <Mail className="h-4 w-4" />
                      {t("Soạn email hỏi nhu cầu", "Draft requirement email")}
                    </Button>
                  )}
                  {eng.stage === "requirement_email_sent" && (
                    <Button size="sm" className="gap-2" onClick={() => setReqFormDialogFor(eng)}>
                      <ClipboardList className="h-4 w-4" />
                      {t("Ghi nhận nhu cầu buyer", "Record buyer requirements")}
                    </Button>
                  )}
                  {(eng.stage === "requirements_received" ||
                    (eng.stage === "shortlist_ready" && !!draftVersion)) && (
                    <Button size="sm" variant="secondary" className="gap-2" onClick={() => setShortlistDialogFor(eng)}>
                      <Sparkles className="h-4 w-4" />
                      {t(
                        draftVersion ? "Chỉnh sửa shortlist (nháp)" : "Chọn supplier (AI gợi ý)",
                        draftVersion ? "Edit shortlist (draft)" : "Pick suppliers (AI-assisted)",
                      )}
                    </Button>
                  )}
                  {eng.stage === "shortlist_ready" && draftVersion && shortlist.length > 0 && (
                    <Button size="sm" className="gap-2" onClick={() => setSendShortlistDialogFor(eng)}>
                      <Link2 className="h-4 w-4" />
                      {t("Duyệt & gửi shortlist", "Approve & send shortlist")}
                    </Button>
                  )}
                  {["shortlist_sent", "buyer_viewed", "buyer_responded", "qualified_interest"].includes(eng.stage) && (
                    <>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setShortlistDialogFor(eng)}>
                        <Sparkles className="h-4 w-4" />
                        {t("Tạo phiên bản shortlist mới", "Create new shortlist version")}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        variant={eng.stage === "qualified_interest" ? "default" : "outline"}
                        onClick={() => setConvertDialogFor(eng)}
                      >
                        <ArrowRight className="h-4 w-4" />
                        {t(
                          `Gán client & tạo Opportunity${interestedCount ? ` (${interestedCount} quan tâm)` : ""}`,
                          `Assign client & create Opportunity${interestedCount ? ` (${interestedCount} interested)` : ""}`,
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {reqEmailDialogFor && (
        <RequirementEmailDialog
          engagement={reqEmailDialogFor}
          locale={locale}
          onClose={() => setReqEmailDialogFor(null)}
          onSent={() => {
            setReqEmailDialogFor(null)
            router.refresh()
          }}
        />
      )}

      {reqFormDialogFor && (
        <RequirementFormDialog
          engagement={reqFormDialogFor}
          locale={locale}
          onClose={() => setReqFormDialogFor(null)}
          onSaved={() => {
            setReqFormDialogFor(null)
            router.refresh()
          }}
        />
      )}

      {shortlistDialogFor && (
        <ShortlistBuilderDialog
          engagement={shortlistDialogFor}
          clients={clients}
          locale={locale}
          onClose={() => setShortlistDialogFor(null)}
          onBuilt={() => {
            setShortlistDialogFor(null)
            router.refresh()
          }}
        />
      )}

      {sendShortlistDialogFor && (
        <SendShortlistDialog
          engagement={sendShortlistDialogFor}
          locale={locale}
          onClose={() => setSendShortlistDialogFor(null)}
          onSent={() => {
            setSendShortlistDialogFor(null)
            router.refresh()
          }}
        />
      )}

      {convertDialogFor && (
        <ConvertDialog
          engagement={convertDialogFor}
          locale={locale}
          onClose={() => setConvertDialogFor(null)}
          onConverted={() => {
            setConvertDialogFor(null)
            router.refresh()
          }}
        />
      )}

      {dropDialogFor && (
        <DropDialog
          engagement={dropDialogFor}
          locale={locale}
          onClose={() => setDropDialogFor(null)}
          onDropped={() => {
            setDropDialogFor(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Share link row (copy button)
// ---------------------------------------------------------------------------

function ShareLinkRow({ token, locale }: { token: string; locale: "vi" | "en" }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== "undefined" ? `${window.location.origin}/shortlist/${token}` : `/shortlist/${token}`

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-muted-foreground flex-1">{url}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 shrink-0 gap-1 px-2 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          toast.success(locale === "vi" ? "Đã sao chép link" : "Link copied")
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Draft & send the requirement inquiry email (stage: claimed)
// ---------------------------------------------------------------------------

function RequirementEmailDialog({
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
  const [viPrompt, setViPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<{
    draftId: string
    subject_en: string
    content_en: string
    content_vi: string
    recipient_email: string | null
  } | null>(null)

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleGenerate = async () => {
    setGenerating(true)
    const result = await generateRequirementInquiryEmailAction({
      engagementId: engagement.id,
      viPrompt,
    })
    setGenerating(false)
    if (!result.ok) {
      toast.error(result.message || result.error)
      return
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
    await markEngagementEmailSentAction(engagement.id)
    setSending(false)
    toast.success(t("Đã gửi email hỏi nhu cầu", "Requirement email sent"))
    onSent()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Soạn email hỏi nhu cầu buyer", "Draft requirement email")}</DialogTitle>
          <DialogDescription>
            {t(
              "AI sẽ soạn email hỏi buyer về sản phẩm, MOQ, giá mục tiêu, thanh toán và bao bì. Bạn có thể chỉnh trước khi gửi.",
              "AI will draft an email asking the buyer about product, MOQ, target price, payment and packaging. Review before sending.",
            )}
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="space-y-3">
            <Label htmlFor="vi-prompt">{t("Hướng dẫn thêm cho AI (không bắt buộc)", "Extra instructions for AI (optional)")}</Label>
            <Textarea
              id="vi-prompt"
              value={viPrompt}
              onChange={(e) => setViPrompt(e.target.value)}
              placeholder={t("VD: nhấn mạnh thời gian giao hàng gấp...", "E.g. emphasize urgent delivery timeline...")}
              rows={3}
            />
          </div>
        ) : (
          <div className="space-y-3">
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
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("Soạn bằng AI", "Generate with AI")}
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
  })
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleSave = async () => {
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
  clients: Client[]
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
        if (next.size >= 5) {
          toast.error(t("Tối đa 5 supplier", "Maximum 5 suppliers"))
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
          <DialogTitle>{t("Chọn 3-5 supplier phù hợp nhất", "Pick the 3-5 best-fit suppliers")}</DialogTitle>
          <DialogDescription>
            {t(
              "Dựa trên nhu cầu buyer đã ghi nhận, AI xếp hạng supplier phù hợp. Bạn chọn tối đa 5 để đưa vào shortlist.",
              "Based on the buyer's recorded requirements, AI ranks the best-fit suppliers. Pick up to 5 for the shortlist.",
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
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {matches.map((m, idx) => (
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
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {m.finalScore}
                </Badge>
              </label>
            ))}
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
  } | null>(null)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const draftVersion = engagement.buyer_engagement_shortlist_versions.find((v) => v.status === "draft")

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
    setDraft(result.data)
  }

  const handleSend = async () => {
    if (!draft) return
    if (!draft.recipient_email) {
      toast.error(t("Buyer chưa có email liên hệ", "Buyer has no contact email"))
      return
    }
    setSending(true)
    const result = await sendEmailDraftAction({ draftId: draft.draftId })
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

// ---------------------------------------------------------------------------
// Dialog: Drop the engagement
// ---------------------------------------------------------------------------

function DropDialog({
  engagement,
  locale,
  onClose,
  onDropped,
}: {
  engagement: Engagement
  locale: "vi" | "en"
  onClose: () => void
  onDropped: () => void
}) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleDrop = async () => {
    setSaving(true)
    const result = await dropEngagement(engagement.id, reason)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(t("Đã hủy buyer này", "Buyer dropped"))
    onDropped()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Hủy buyer này?", "Drop this buyer?")}</DialogTitle>
          <DialogDescription>
            {t(
              `Buyer ${engagement.leads?.company_name} sẽ được đưa ra khỏi danh sách đang xử lý.`,
              `${engagement.leads?.company_name} will be removed from your in-progress list.`,
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("Lý do (tùy chọn)...", "Reason (optional)...")}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Không hủy", "Keep it")}
          </Button>
          <Button variant="destructive" onClick={handleDrop} disabled={saving}>
            {t("Xác nhận hủy", "Confirm drop")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
