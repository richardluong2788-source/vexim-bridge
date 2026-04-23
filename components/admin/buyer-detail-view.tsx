"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Building2,
  Globe2,
  Mail,
  Phone,
  Linkedin,
  StickyNote,
  UserRound,
  UserPlus,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  MessageSquare,
  Kanban,
  Info,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assessCountryRisk, type RiskLevel } from "@/lib/risk/country-risk"
import { maskEmail, maskPhone } from "@/lib/buyers/mask"
import type { Stage } from "@/lib/supabase/types"
import { updateBuyer, assignBuyerToClient } from "@/app/admin/buyers/actions"

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface BuyerDetailData {
  id: string
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  country: string | null
  industry: string | null
  website: string | null
  linkedin_url: string | null
  notes: string | null
  created_at: string
}

export interface BuyerOpportunity {
  id: string
  stage: Stage
  potential_value: number | null
  target_close_date: string | null
  last_updated: string | null
  created_at: string
  products_interested: string | null
  next_step: string | null
  client_action_required: string | null
  client: {
    id: string
    name: string
    fdaRegistrationNumber: string | null
    fdaExpiresAt: string | null
  } | null
}

export interface BuyerReply {
  id: string
  opportunityId: string
  clientName: string
  receivedAt: string
  intent: string | null
  summary: string | null
  confidence: number | null
  translatedVi: string | null
  rawContent: string | null
}

export interface AssignableClient {
  id: string
  name: string
  fdaRegistrationNumber: string | null
  fdaExpiresAt: string | null
  alreadyAttached: boolean
}

interface Props {
  buyer: BuyerDetailData
  opportunities: BuyerOpportunity[]
  replies: BuyerReply[]
  clients: AssignableClient[]
  locale: "vi" | "en"
  canWrite: boolean
  canViewPII: boolean
}

// Stage labels — mirror buyers-table so the two screens stay consistent
// without having to thread `t` through.
const STAGE_LABEL_VI: Record<Stage, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  sample_requested: "Yêu cầu mẫu",
  sample_sent: "Đã gửi mẫu",
  negotiation: "Đàm phán",
  price_agreed: "Đã chốt giá",
  production: "Sản xuất",
  shipped: "Đã giao",
  won: "Thành công",
  lost: "Thất bại",
}
const STAGE_LABEL_EN: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  sample_requested: "Sample requested",
  sample_sent: "Sample sent",
  negotiation: "Negotiation",
  price_agreed: "Price agreed",
  production: "Production",
  shipped: "Shipped",
  won: "Won",
  lost: "Lost",
}
const STAGE_TONE: Record<Stage, string> = {
  new: "border-chart-1/40 bg-chart-1/10 text-chart-1",
  contacted: "border-chart-3/40 bg-chart-3/10 text-chart-3",
  sample_requested: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  sample_sent: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  negotiation: "border-chart-5/40 bg-chart-5/10 text-chart-5",
  price_agreed: "border-chart-5/40 bg-chart-5/10 text-chart-5",
  production: "border-chart-1/40 bg-chart-1/10 text-chart-1",
  shipped: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  won: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  lost: "border-destructive/40 bg-destructive/10 text-destructive",
}

const RISK_TONE: Record<RiskLevel, string> = {
  low: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  medium: "border-chart-5/40 bg-chart-5/10 text-chart-5",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
}

const INTENT_LABEL_VI: Record<string, string> = {
  price_request: "Hỏi giá",
  sample_request: "Xin mẫu",
  objection: "Phản đối",
  closing_signal: "Tín hiệu chốt",
  general: "Chung",
}
const INTENT_LABEL_EN: Record<string, string> = {
  price_request: "Price request",
  sample_request: "Sample request",
  objection: "Objection",
  closing_signal: "Closing signal",
  general: "General",
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BuyerDetailView({
  buyer,
  opportunities,
  replies,
  clients,
  locale,
  canWrite,
  canViewPII,
}: Props) {
  const router = useRouter()
  const L = locale === "vi" ? STAGE_LABEL_VI : STAGE_LABEL_EN
  const INTENT = locale === "vi" ? INTENT_LABEL_VI : INTENT_LABEL_EN
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  const [assignOpen, setAssignOpen] = useState(false)

  const risk = useMemo(() => assessCountryRisk(buyer.country), [buyer.country])

  const openCount = opportunities.filter(
    (o) => o.stage !== "won" && o.stage !== "lost",
  ).length
  const wonCount = opportunities.filter((o) => o.stage === "won").length

  return (
    <div className="flex flex-col gap-6">
      {/* --- Header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground text-balance truncate">
              {buyer.company_name ?? "—"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {buyer.country ? (
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="h-3.5 w-3.5" />
                  {buyer.country}
                </span>
              ) : null}
              <Badge
                variant="outline"
                className={`text-[10px] uppercase tracking-wide ${RISK_TONE[risk.level]}`}
              >
                {risk.level === "low"
                  ? locale === "vi"
                    ? "Rủi ro thấp"
                    : "Low risk"
                  : risk.level === "medium"
                    ? locale === "vi"
                      ? "Rủi ro trung bình"
                      : "Medium risk"
                    : locale === "vi"
                      ? "Rủi ro cao"
                      : "High risk"}
              </Badge>
              {buyer.industry ? (
                <Badge variant="secondary" className="font-normal">
                  {buyer.industry}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        {canWrite && (
          <Button onClick={() => setAssignOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {locale === "vi" ? "Gán cho client" : "Assign to client"}
          </Button>
        )}
      </div>

      {/* --- Stat strip -------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={locale === "vi" ? "Tổng cơ hội" : "Total deals"}
          value={opportunities.length}
        />
        <StatCard
          label={locale === "vi" ? "Đang mở" : "Open"}
          value={openCount}
          tone={openCount > 0 ? "chart-1" : "muted"}
        />
        <StatCard
          label={locale === "vi" ? "Đã chốt (won)" : "Won"}
          value={wonCount}
          tone={wonCount > 0 ? "chart-4" : "muted"}
        />
        <StatCard
          label={locale === "vi" ? "Lần liên hệ gần nhất" : "Most recent reply"}
          value={replies[0]?.receivedAt ? formatRelative(replies[0].receivedAt, locale) : "—"}
          small
        />
      </div>

      {/* --- Two-column layout ------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Left: editable buyer info */}
        <BuyerInfoCard
          buyer={buyer}
          locale={locale}
          canWrite={canWrite}
          canViewPII={canViewPII}
          onSaved={() => router.refresh()}
        />

        {/* Right: tabs */}
        <Tabs defaultValue="opportunities" className="flex flex-col gap-4">
          <TabsList className="self-start">
            <TabsTrigger value="opportunities" className="gap-2">
              <Kanban className="h-4 w-4" />
              {locale === "vi" ? "Cơ hội" : "Deals"}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 font-mono text-[11px]">
                {opportunities.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="replies" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              {locale === "vi" ? "Phản hồi" : "Replies"}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 font-mono text-[11px]">
                {replies.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="mt-0">
            {opportunities.length === 0 ? (
              <Card className="border-border">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {locale === "vi"
                        ? "Buyer này chưa được gán cho client nào"
                        : "Buyer has not been assigned yet"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {locale === "vi"
                        ? "Nhấn 'Gán cho client' ở trên để tạo cơ hội đầu tiên."
                        : "Use 'Assign to client' above to create the first deal."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {opportunities.map((o) => (
                  <Card key={o.id} className="border-border">
                    <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`font-normal ${STAGE_TONE[o.stage]}`}
                          >
                            {L[o.stage]}
                          </Badge>
                          {o.client ? (
                            <Link
                              href={`/admin/clients/${o.client.id}`}
                              className="text-sm font-medium text-foreground hover:text-primary inline-flex items-center gap-1 truncate max-w-[280px]"
                            >
                              {o.client.name}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                        {o.products_interested ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {o.products_interested}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {o.potential_value ? (
                            <span>
                              {locale === "vi" ? "Giá trị: " : "Value: "}
                              <span className="text-foreground font-medium">
                                ${o.potential_value.toLocaleString()}
                              </span>
                            </span>
                          ) : null}
                          {o.last_updated ? (
                            <span>
                              {locale === "vi" ? "Cập nhật: " : "Updated: "}
                              {new Date(o.last_updated).toLocaleDateString(
                                dateLocale,
                                { month: "short", day: "numeric", year: "numeric" },
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/pipeline?oppId=${o.id}`}>
                          {locale === "vi" ? "Mở pipeline" : "Open pipeline"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="replies" className="mt-0">
            {replies.length === 0 ? (
              <Card className="border-border">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {locale === "vi" ? "Chưa có phản hồi nào" : "No replies yet"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {locale === "vi"
                        ? "Phản hồi của buyer được dán vào từng cơ hội sẽ hiện ở đây."
                        : "Buyer replies pasted into any deal will surface here."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {replies.map((r) => (
                  <Card key={r.id} className="border-border">
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {r.intent ? (
                            <Badge variant="secondary" className="font-normal">
                              {INTENT[r.intent] ?? r.intent}
                            </Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {locale === "vi" ? "cho" : "for"}{" "}
                            <span className="text-foreground font-medium">{r.clientName}</span>
                          </span>
                          {typeof r.confidence === "number" ? (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(r.confidence * 100)}%
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.receivedAt).toLocaleString(dateLocale, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {r.summary ? (
                        <p className="text-sm text-foreground text-pretty">
                          {r.summary}
                        </p>
                      ) : null}
                      {r.translatedVi && locale === "vi" ? (
                        <p className="text-xs text-muted-foreground italic text-pretty">
                          {r.translatedVi}
                        </p>
                      ) : null}
                      <div className="flex justify-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/pipeline?oppId=${r.opportunityId}`}>
                            {locale === "vi" ? "Mở cơ hội" : "Open deal"}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* --- Assign dialog ---------------------------------------------- */}
      {canWrite && (
        <AssignBuyerDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          buyerId={buyer.id}
          buyerName={buyer.company_name ?? ""}
          clients={clients}
          locale={locale}
          onAssigned={(opportunityId) => {
            setAssignOpen(false)
            router.push(`/admin/pipeline?oppId=${opportunityId}`)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Buyer info (left column) — inline editable form
// ---------------------------------------------------------------------------

function BuyerInfoCard({
  buyer,
  locale,
  canWrite,
  canViewPII,
  onSaved,
}: {
  buyer: BuyerDetailData
  locale: "vi" | "en"
  canWrite: boolean
  canViewPII: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    company_name: buyer.company_name ?? "",
    contact_person: buyer.contact_person ?? "",
    contact_email: buyer.contact_email ?? "",
    contact_phone: buyer.contact_phone ?? "",
    country: buyer.country ?? "",
    industry: buyer.industry ?? "",
    website: buyer.website ?? "",
    linkedin_url: buyer.linkedin_url ?? "",
    notes: buyer.notes ?? "",
  })

  function handleSave() {
    startTransition(async () => {
      const res = await updateBuyer({
        id: buyer.id,
        company_name: form.company_name,
        contact_person: form.contact_person || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        country: form.country || null,
        industry: form.industry || null,
        website: form.website || null,
        linkedin_url: form.linkedin_url || null,
        notes: form.notes || null,
      })
      if (res.ok) {
        toast.success(locale === "vi" ? "Đã lưu buyer" : "Buyer saved")
        setEditing(false)
        onSaved()
      } else {
        toast.error(
          res.error === "company_name_required"
            ? locale === "vi"
              ? "Tên công ty là bắt buộc"
              : "Company name is required"
            : res.error === "forbidden"
              ? locale === "vi"
                ? "Bạn không có quyền chỉnh sửa"
                : "You do not have permission to edit"
              : res.error,
        )
      }
    })
  }

  return (
    <Card className="border-border h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">
          {locale === "vi" ? "Thông tin buyer" : "Buyer info"}
        </CardTitle>
        {canWrite && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {locale === "vi" ? "Sửa" : "Edit"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!editing ? (
          <>
            <InfoRow
              icon={UserRound}
              label={locale === "vi" ? "Người liên hệ" : "Contact"}
              value={buyer.contact_person}
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={
                canViewPII
                  ? buyer.contact_email
                  : buyer.contact_email
                    ? maskEmail(buyer.contact_email)
                    : null
              }
            />
            <InfoRow
              icon={Phone}
              label={locale === "vi" ? "Điện thoại" : "Phone"}
              value={
                canViewPII
                  ? buyer.contact_phone
                  : buyer.contact_phone
                    ? maskPhone(buyer.contact_phone)
                    : null
              }
            />
            <InfoRow
              icon={Globe2}
              label={locale === "vi" ? "Website" : "Website"}
              value={buyer.website}
              isLink
            />
            <InfoRow
              icon={Linkedin}
              label="LinkedIn"
              value={buyer.linkedin_url}
              isLink
            />
            <div className="flex flex-col gap-1 pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StickyNote className="h-3.5 w-3.5" />
                {locale === "vi" ? "Ghi chú nội bộ" : "Internal notes"}
              </div>
              <p className="text-sm text-foreground text-pretty min-h-[1.5rem]">
                {buyer.notes ?? (
                  <span className="text-muted-foreground italic">
                    {locale === "vi" ? "Chưa có ghi chú." : "No notes yet."}
                  </span>
                )}
              </p>
            </div>
            {!canViewPII && (buyer.contact_email || buyer.contact_phone) && (
              <div className="flex items-start gap-2 rounded-md border border-chart-5/30 bg-chart-5/10 p-2.5 text-xs text-chart-5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {locale === "vi"
                    ? "Thông tin liên hệ bị ẩn do vai trò của bạn không có quyền xem PII."
                    : "Contact details are masked because your role lacks PII access."}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <Field label={locale === "vi" ? "Tên công ty" : "Company name"} required>
              <Input
                value={form.company_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_name: e.target.value }))
                }
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={locale === "vi" ? "Người liên hệ" : "Contact"}>
                <Input
                  value={form.contact_person}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact_person: e.target.value }))
                  }
                />
              </Field>
              <Field label={locale === "vi" ? "Quốc gia" : "Country"}>
                <Input
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_email: e.target.value }))
                }
              />
            </Field>
            <Field label={locale === "vi" ? "Điện thoại" : "Phone"}>
              <Input
                value={form.contact_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
              />
            </Field>
            <Field label={locale === "vi" ? "Ngành" : "Industry"}>
              <Input
                value={form.industry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, industry: e.target.value }))
                }
              />
            </Field>
            <Field label="Website">
              <Input
                type="url"
                value={form.website}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website: e.target.value }))
                }
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                type="url"
                value={form.linkedin_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedin_url: e.target.value }))
                }
              />
            </Field>
            <Field label={locale === "vi" ? "Ghi chú nội bộ" : "Internal notes"}>
              <Textarea
                value={form.notes}
                rows={3}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="resize-none"
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={pending || !form.company_name.trim()}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {locale === "vi" ? "Đang lưu..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {locale === "vi" ? "Lưu" : "Save"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm({
                    company_name: buyer.company_name ?? "",
                    contact_person: buyer.contact_person ?? "",
                    contact_email: buyer.contact_email ?? "",
                    contact_phone: buyer.contact_phone ?? "",
                    country: buyer.country ?? "",
                    industry: buyer.industry ?? "",
                    website: buyer.website ?? "",
                    linkedin_url: buyer.linkedin_url ?? "",
                    notes: buyer.notes ?? "",
                  })
                  setEditing(false)
                }}
              >
                {locale === "vi" ? "Huỷ" : "Cancel"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  isLink,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  isLink?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {value ? (
          isLink ? (
            <a
              href={value.startsWith("http") ? value : `https://${value}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-foreground hover:text-primary break-all inline-flex items-center gap-1"
            >
              {value}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <span className="text-sm text-foreground break-words">{value}</span>
          )
        ) : (
          <span className="text-sm text-muted-foreground italic">—</span>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = "muted",
  small = false,
}: {
  label: string
  value: number | string
  tone?: "muted" | "chart-1" | "chart-4"
  small?: boolean
}) {
  const toneMap: Record<string, string> = {
    muted: "text-foreground",
    "chart-1": "text-chart-1",
    "chart-4": "text-chart-4",
  }
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={`font-semibold ${toneMap[tone]} ${small ? "text-base" : "text-2xl"}`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

function formatRelative(iso: string, locale: "vi" | "en"): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMin = Math.round((now - then) / 60_000)
  if (diffMin < 1) return locale === "vi" ? "vừa xong" : "just now"
  if (diffMin < 60) return locale === "vi" ? `${diffMin} phút trước` : `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24)
    return locale === "vi" ? `${diffHr} giờ trước` : `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30)
    return locale === "vi" ? `${diffDay} ngày trước` : `${diffDay} d ago`
  return new Date(iso).toLocaleDateString(
    locale === "vi" ? "vi-VN" : "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  )
}

// ---------------------------------------------------------------------------
// Assign-to-client dialog
// ---------------------------------------------------------------------------

function AssignBuyerDialog({
  open,
  onOpenChange,
  buyerId,
  buyerName,
  clients,
  locale,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  buyerId: string
  buyerName: string
  clients: AssignableClient[]
  locale: "vi" | "en"
  onAssigned: (opportunityId: string) => void
}) {
  const [clientId, setClientId] = useState<string>("")
  const [potentialValue, setPotentialValue] = useState<string>("")
  const [pending, startTransition] = useTransition()

  // Pre-compute each client's eligibility once so we can render a helpful
  // status next to every item instead of silently filtering them out.
  const rows = useMemo(
    () =>
      clients.map((c) => {
        const hasNumber =
          !!c.fdaRegistrationNumber && c.fdaRegistrationNumber.trim().length > 0
        let expired = false
        if (c.fdaExpiresAt) {
          const t = new Date()
          t.setHours(0, 0, 0, 0)
          expired = new Date(c.fdaExpiresAt) < t
        }
        const eligible = hasNumber && !expired && !c.alreadyAttached
        return { ...c, hasNumber, expired, eligible }
      }),
    [clients],
  )

  const selected = rows.find((r) => r.id === clientId) ?? null

  function handleSubmit() {
    if (!selected?.eligible) return
    startTransition(async () => {
      const parsedValue = potentialValue ? Number.parseFloat(potentialValue) : null
      const res = await assignBuyerToClient({
        buyerId,
        clientId: selected.id,
        potentialValue: Number.isFinite(parsedValue as number) ? parsedValue : null,
      })
      if (res.ok) {
        toast.success(
          res.data.alreadyExisted
            ? locale === "vi"
              ? "Cơ hội đã tồn tại — mở sẵn trên pipeline"
              : "Deal already existed — opening pipeline"
            : locale === "vi"
              ? `Đã gán ${buyerName} cho ${selected.name}`
              : `Assigned ${buyerName} to ${selected.name}`,
        )
        onAssigned(res.data.opportunityId)
      } else {
        const msg =
          res.error === "fda_missing"
            ? locale === "vi"
              ? "Client chưa có FDA — không thể gán"
              : "Client has no FDA — cannot assign"
            : res.error === "fda_expired"
              ? locale === "vi"
                ? "FDA của client đã hết hạn"
                : "Client FDA has expired"
              : res.error === "forbidden"
                ? locale === "vi"
                  ? "Bạn không có quyền gán buyer"
                  : "You do not have permission to assign"
                : res.error
        toast.error(msg)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {locale === "vi"
              ? `Gán "${buyerName}" cho client`
              : `Assign "${buyerName}" to a client`}
          </DialogTitle>
          <DialogDescription>
            {locale === "vi"
              ? "Tạo một cơ hội mới nối buyer này với doanh nghiệp xuất khẩu Việt Nam. Chỉ client có FDA hợp lệ mới được gán."
              : "Creates a new deal linking this buyer to a Vietnamese exporter. Only clients with a valid FDA registration can be assigned."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field label={locale === "vi" ? "Chọn client" : "Select client"} required>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    locale === "vi"
                      ? "Chọn doanh nghiệp xuất khẩu Việt Nam..."
                      : "Select a Vietnamese exporter..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {rows.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    {locale === "vi" ? "Chưa có client nào" : "No clients yet"}
                  </div>
                ) : (
                  rows.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={!c.eligible}
                    >
                      <div className="flex items-center gap-2">
                        {c.eligible ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-chart-4 shrink-0" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="truncate">{c.name}</span>
                        {c.alreadyAttached && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            {locale === "vi" ? "(đã gán)" : "(attached)"}
                          </span>
                        )}
                        {!c.hasNumber && !c.alreadyAttached && (
                          <span className="text-[10px] text-destructive ml-1">
                            {locale === "vi" ? "(chưa có FDA)" : "(no FDA)"}
                          </span>
                        )}
                        {c.hasNumber && c.expired && !c.alreadyAttached && (
                          <span className="text-[10px] text-destructive ml-1">
                            {locale === "vi" ? "(FDA hết hạn)" : "(FDA expired)"}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>

          {selected && !selected.eligible && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {selected.alreadyAttached
                  ? locale === "vi"
                    ? "Client này đã được gán với buyer. Mở pipeline để xem cơ hội hiện có."
                    : "This client is already attached to the buyer. Open the pipeline to see the existing deal."
                  : !selected.hasNumber
                    ? locale === "vi"
                      ? "Client chưa có số đăng ký FDA. Yêu cầu họ bổ sung FDA trước khi gán buyer."
                      : "Client has no FDA registration. Ask them to add it before assigning buyers."
                    : locale === "vi"
                      ? "FDA của client đã hết hạn. Cần gia hạn trước khi gán buyer mới."
                      : "Client FDA has expired. They must renew before new buyers can be assigned."}
              </span>
            </div>
          )}

          <Field label={locale === "vi" ? "Giá trị tiềm năng (USD)" : "Potential value (USD)"}>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="50000"
              value={potentialValue}
              onChange={(e) => setPotentialValue(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {locale === "vi" ? "Huỷ" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !selected?.eligible}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {locale === "vi" ? "Đang gán..." : "Assigning..."}
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {locale === "vi" ? "Gán và mở cơ hội" : "Assign and open deal"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
