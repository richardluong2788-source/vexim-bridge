"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Star,
  Trash2,
  Plus,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { INDUSTRIES, INDUSTRY_LABELS_VI, type Industry } from "@/lib/constants/industries"
import {
  approveIntakeSubmission,
  rejectIntakeSubmission,
  type IntakeEditableFields,
} from "@/app/admin/clients/intake/actions"

const CERTIFICATION_OPTIONS = [
  "HACCP",
  "GMP",
  "ISO 22000",
  "ISO 9001",
  "FDA Registration",
  "Organic (USDA/EU)",
  "Halal",
  "Kosher",
  "BRC",
  "FSSC 22000",
] as const

type Locale = "vi" | "en"

export interface IntakeSubmissionDetail {
  id: string
  status: "pending" | "submitted" | "approved" | "rejected"
  contact_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  industries: Industry[] | null
  country: string | null
  address: string | null
  website: string | null
  tax_code: string | null
  tagline: string | null
  company_description: string | null
  main_products: string | null
  production_capacity: string | null
  moq: string | null
  lead_time_days: string | null
  usp_points: { icon: string; title: string }[] | null
  logo_url: string | null
  cover_image_url: string | null
  factory_image_urls: string[] | null
  video_url: string | null
  certifications: string[] | null
  certifications_other: string | null
  submitted_at: string | null
  created_client_id: string | null
  review_notes: string | null
  rejection_reason: string | null
  profiles: { full_name: string | null; email: string | null } | null
}

/** Fields that must be non-empty before this profile can be approved. */
const REQUIRED_FIELD_KEYS = [
  "companyName",
  "contactName",
  "email",
  "phone",
  "industries",
] as const

export function IntakeReviewDetail({
  submission,
  locale,
  canReview,
}: {
  submission: IntakeSubmissionDetail
  locale: Locale
  canReview: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [approved, setApproved] = useState(submission.status === "approved")
  const [rejected, setRejected] = useState(submission.status === "rejected")

  const tr = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const [form, setForm] = useState({
    companyName: submission.company_name ?? "",
    contactName: submission.contact_name ?? "",
    email: submission.email ?? "",
    phone: submission.phone ?? "",
    industries: submission.industries ?? [],
    country: submission.country ?? "",
    address: submission.address ?? "",
    website: submission.website ?? "",
    taxCode: submission.tax_code ?? "",
    tagline: submission.tagline ?? "",
    description: submission.company_description ?? "",
    mainProducts: submission.main_products ?? "",
    productionCapacity: submission.production_capacity ?? "",
    moq: submission.moq ?? "",
    leadTimeDays: submission.lead_time_days ?? "",
    uspPoints:
      submission.usp_points && submission.usp_points.length > 0
        ? submission.usp_points
        : [{ icon: "", title: "" }],
    logoUrl: submission.logo_url ?? "",
    coverImageUrl: submission.cover_image_url ?? "",
    factoryImageUrls: (submission.factory_image_urls ?? []).join(", "),
    videoUrl: submission.video_url ?? "",
    certifications: submission.certifications ?? [],
    certificationsOther: submission.certifications_other ?? "",
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleIndustry(ind: Industry) {
    setForm((prev) => ({
      ...prev,
      industries: prev.industries.includes(ind)
        ? prev.industries.filter((i) => i !== ind)
        : [...prev.industries, ind],
    }))
  }

  function toggleCertification(cert: string) {
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter((c) => c !== cert)
        : [...prev.certifications, cert],
    }))
  }

  function updateUsp(idx: number, field: "icon" | "title", value: string) {
    setForm((prev) => ({
      ...prev,
      uspPoints: prev.uspPoints.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }))
  }

  function addUsp() {
    if (form.uspPoints.length >= 4) return
    setForm((prev) => ({ ...prev, uspPoints: [...prev.uspPoints, { icon: "", title: "" }] }))
  }

  function removeUsp(idx: number) {
    setForm((prev) => ({ ...prev, uspPoints: prev.uspPoints.filter((_, i) => i !== idx) }))
  }

  const missingRequired = useMemo(() => {
    const missing: string[] = []
    if (!form.companyName.trim()) missing.push(tr("Tên doanh nghiệp", "Company name"))
    if (!form.contactName.trim()) missing.push(tr("Người liên hệ", "Contact name"))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      missing.push(tr("Email hợp lệ", "Valid email"))
    if (!form.phone.trim()) missing.push(tr("Số điện thoại", "Phone"))
    if (form.industries.length === 0) missing.push(tr("Ngành nghề", "Industry"))
    return missing
  }, [form, locale])

  function buildFields(): IntakeEditableFields {
    return {
      contact_name: form.contactName,
      email: form.email,
      phone: form.phone,
      company_name: form.companyName,
      industries: form.industries,
      country: form.country || null,
      address: form.address || null,
      website: form.website || null,
      tax_code: form.taxCode || null,
      tagline: form.tagline || null,
      company_description: form.description || null,
      main_products: form.mainProducts || null,
      production_capacity: form.productionCapacity || null,
      moq: form.moq || null,
      lead_time_days: form.leadTimeDays || null,
      usp_points: form.uspPoints.filter((p) => p.title.trim() !== ""),
      logo_url: form.logoUrl || null,
      cover_image_url: form.coverImageUrl || null,
      factory_image_urls: form.factoryImageUrls
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      video_url: form.videoUrl || null,
      certifications: form.certifications,
      certifications_other: form.certificationsOther || null,
    }
  }

  function translateError(code: string): string {
    switch (code) {
      case "forbidden":
        return tr("Bạn không có quyền thực hiện.", "You are not allowed to do this.")
      case "already_approved":
        return tr("Hồ sơ này đã được duyệt.", "This profile was already approved.")
      case "already_rejected":
        return tr("Hồ sơ này đã bị từ chối.", "This profile was already rejected.")
      case "email_exists":
        return tr(
          "Email này đã có tài khoản trong hệ thống.",
          "This email already has an account.",
        )
      case "industry_invalid":
        return tr("Vui lòng chọn ngành nghề hợp lệ.", "Please select a valid industry.")
      default:
        return tr("Có lỗi xảy ra, vui lòng thử lại.", "Something went wrong.")
    }
  }

  function handleApprove() {
    if (missingRequired.length > 0) {
      setError(
        tr(
          `Còn thiếu: ${missingRequired.join(", ")}. Vui lòng bổ sung trước khi xác nhận.`,
          `Missing: ${missingRequired.join(", ")}. Please fill these in before approving.`,
        ),
      )
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await approveIntakeSubmission(submission.id, buildFields())
      if (!result.ok) {
        setError(translateError(result.error ?? "unknown"))
        return
      }
      setApproved(true)
      router.refresh()
    })
  }

  function handleReject() {
    setError(null)
    startTransition(async () => {
      const result = await rejectIntakeSubmission(submission.id, rejectReason)
      if (!result.ok) {
        setError(translateError(result.error ?? "unknown"))
        return
      }
      setRejected(true)
      setShowRejectDialog(false)
      router.refresh()
    })
  }

  const primary = form.industries[0]

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <Link href="/admin/clients/intake">
              <ArrowLeft className="h-4 w-4" />
              {tr("Về danh sách hồ sơ", "Back to profiles")}
            </Link>
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-foreground">
              {submission.company_name || tr("(Chưa có tên)", "(Unnamed)")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr("AE quản lý", "Managed by")}:{" "}
              {submission.profiles?.full_name || submission.profiles?.email || "—"}
            </p>
          </div>
          <StatusPill approved={approved} rejected={rejected} locale={locale} />
        </div>

        {approved && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                {tr(
                  "Đã tạo tài khoản khách hàng và chuyển dữ liệu vào Quản lý hồ sơ. Bạn có thể tiếp tục chỉnh sửa hồ sơ công khai tại trang Khách hàng.",
                  "The client account was created and this data was mirrored into Profile Management. You can keep editing the public profile from the Clients page.",
                )}
              </p>
            </CardContent>
          </Card>
        )}
        {rejected && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <XCircle className="h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm text-foreground">
                {tr("Hồ sơ này đã bị từ chối.", "This profile was rejected.")}
              </p>
            </CardContent>
          </Card>
        )}

        <fieldset disabled={!canReview || approved || rejected || isPending} className="contents">
          <Card>
            <CardHeader>
              <CardTitle>{tr("Liên hệ & đăng ký", "Contact & registration")}</CardTitle>
              <CardDescription>
                {tr(
                  "5 trường bắt buộc để tạo tài khoản khách hàng.",
                  "5 required fields to create the client account.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>
                  {tr("Tên doanh nghiệp", "Company name")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>
                    {tr("Người liên hệ", "Contact name")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>
                    {tr("Số điện thoại", "Phone")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                  {tr("Ngành nghề", "Industry")} <span className="text-destructive">*</span>
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {INDUSTRIES.map((ind) => {
                    const checked = form.industries.includes(ind)
                    const isPrimary = primary === ind
                    return (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => toggleIndustry(ind)}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background",
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="flex flex-1 flex-col leading-tight">
                          <span className="font-medium text-foreground">{ind}</span>
                          <span className="text-xs text-muted-foreground">
                            {INDUSTRY_LABELS_VI[ind]}
                          </span>
                        </span>
                        {isPrimary && (
                          <Star className="ml-auto h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{tr("Quốc gia", "Country")}</Label>
                  <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{tr("Mã số thuế", "Tax code")}</Label>
                  <Input value={form.taxCode} onChange={(e) => update("taxCode", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{tr("Địa chỉ", "Address")}</Label>
                <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => update("website", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr("Giới thiệu doanh nghiệp", "Company overview")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Slogan</Label>
                <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{tr("Mô tả doanh nghiệp", "Company description")}</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{tr("Sản phẩm / mã HS chính", "Main products / HS codes")}</Label>
                <Textarea
                  rows={2}
                  value={form.mainProducts}
                  onChange={(e) => update("mainProducts", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label>{tr("Công suất sản xuất", "Production capacity")}</Label>
                  <Input
                    value={form.productionCapacity}
                    onChange={(e) => update("productionCapacity", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>MOQ</Label>
                  <Input value={form.moq} onChange={(e) => update("moq", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{tr("Thời gian giao hàng", "Lead time")}</Label>
                  <Input
                    value={form.leadTimeDays}
                    onChange={(e) => update("leadTimeDays", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr("Năng lực & chứng nhận", "Capability & certifications")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium">USP</legend>
                {form.uspPoints.map((usp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={usp.icon}
                      onChange={(e) => updateUsp(idx, "icon", e.target.value)}
                      placeholder={tr("Từ khoá", "Keyword")}
                      className="w-40 shrink-0"
                    />
                    <Input
                      value={usp.title}
                      onChange={(e) => updateUsp(idx, "title", e.target.value)}
                      placeholder={tr("Nội dung điểm mạnh", "USP text")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUsp(idx)}
                      disabled={form.uspPoints.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {form.uspPoints.length < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addUsp}
                    className="w-fit gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {tr("Thêm điểm mạnh", "Add USP")}
                  </Button>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">{tr("Chứng nhận", "Certifications")}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CERTIFICATION_OPTIONS.map((cert) => (
                    <label
                      key={cert}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={form.certifications.includes(cert)}
                        onCheckedChange={() => toggleCertification(cert)}
                      />
                      {cert}
                    </label>
                  ))}
                </div>
                <Input
                  value={form.certificationsOther}
                  onChange={(e) => update("certificationsOther", e.target.value)}
                  placeholder={tr("Chứng nhận khác", "Other certifications")}
                />
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{tr("URL logo", "Logo URL")}</Label>
                  <Input value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{tr("URL ảnh bìa", "Cover image URL")}</Label>
                  <Input
                    value={form.coverImageUrl}
                    onChange={(e) => update("coverImageUrl", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{tr("Ảnh nhà máy / sản phẩm", "Factory / product images")}</Label>
                <Input
                  value={form.factoryImageUrls}
                  onChange={(e) => update("factoryImageUrls", e.target.value)}
                  placeholder={tr("Nhiều URL, ngăn cách bởi dấu phẩy", "Comma-separated URLs")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{tr("URL video nhà máy", "Factory video URL")}</Label>
                <Input value={form.videoUrl} onChange={(e) => update("videoUrl", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </fieldset>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="text-pretty">{error}</span>
          </div>
        )}

        {canReview && !approved && !rejected && (
          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="flex flex-col gap-0.5">
              {missingRequired.length > 0 ? (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {tr("Còn thiếu", "Missing")}: {missingRequired.join(", ")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {tr("Đầy đủ thông tin bắt buộc.", "All required fields complete.")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                disabled={isPending}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <XCircle className="h-4 w-4" />
                {tr("Từ chối", "Reject")}
              </Button>
              <Button type="button" onClick={handleApprove} disabled={isPending} className="gap-1.5">
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {tr("Xác nhận & tạo tài khoản", "Approve & create account")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Từ chối hồ sơ này?", "Reject this profile?")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Cho biết lý do để lưu vào lịch sử (ví dụ: ngành hàng không phù hợp, khách không phản hồi bổ sung thông tin).",
                "Add a reason for the record (e.g. industry not a fit, client never followed up with missing info).",
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder={tr("Lý do từ chối...", "Rejection reason...")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isPending}>
              {tr("Huỷ", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Xác nhận từ chối", "Confirm rejection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatusPill({
  approved,
  rejected,
  locale,
}: {
  approved: boolean
  rejected: boolean
  locale: Locale
}) {
  if (approved) {
    return (
      <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/15">
        <CheckCircle2 className="h-3 w-3" />
        {locale === "vi" ? "Đã duyệt" : "Approved"}
      </Badge>
    )
  }
  if (rejected) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {locale === "vi" ? "Đã từ chối" : "Rejected"}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <ChevronLeft className="hidden" />
      {locale === "vi" ? "Chờ duyệt" : "Awaiting review"}
    </Badge>
  )
}
