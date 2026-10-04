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
import { splitMainProducts } from "@/lib/client-intake/split-main-products"
import { FactoryCapabilityStep } from "@/components/client-intake/factory-capability-step"
import {
  EMPTY_FACTORY_CAPABILITY_ANSWERS,
  type FactoryCapabilityAnswers,
} from "@/lib/assessment/constants"
import {
  MAX_MANUFACTURING_SOURCES,
  PROFILE_SOURCE_STATUSES,
  SOURCE_RELATIONSHIP_TYPES,
  SOURCE_VERIFICATION_STATUSES,
  SUPPLIER_ENTITY_TYPES,
  US_SALES_CHANNEL_STATUSES,
  VEXIM_SUPPORT_OPTIONS,
  deriveProfileSourceStatus,
  emptyManufacturingSource,
  isProfileSourceStatus,
  isSupplierEntityType,
  isUsSalesChannelStatus,
  normalizeManufacturingSources,
  normalizeSupportNeeds,
  type ManufacturingSourceEntry,
  type ProfileSourceStatus,
  type SupplierEntityType,
  type UsSalesChannelStatus,
  type VeximSupportNeed,
} from "@/lib/client-intake/sourcing"
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
  certification_image_urls?: string[] | null
  submitted_at: string | null
  created_client_id: string | null
  client_id?: string | null
  linked_client_profile?: boolean
  review_notes: string | null
  rejection_reason: string | null
  quality_systems?: string[] | null
  quality_systems_other?: string | null
  oem_odm?: string[] | null
  company_scale?: string | null
  export_since_year?: number | null
  export_markets?: string[] | null
  export_markets_other?: string | null
  traceability?: string[] | null
  supplier_entity_type?: string | null
  manufacturing_sources?: Record<string, unknown>[] | null
  source_verification_status?: string | null
  source_verification_consent?: boolean | null
  source_change_acknowledged?: boolean | null
  us_sales_channel_status?: string | null
  us_sales_channel_notes?: string | null
  vexim_support_needs?: string[] | null
  vexim_support_other?: string | null
  audit_readiness?: string[] | null
  audit_owner?: string | null
  incoterms?: string[] | null
  payment_policy?: string | null
  oem_policy?: string | null
  odm_policy?: string | null
  has_export_dept?: boolean | null
  has_english_staff?: boolean | null
  pricing_decision_maker?: string | null
  commitments?: string[] | null
  project_priority?: string | null
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
  // Seeding is on by default and reversible (the rows are inactive drafts), but
  // it stays a choice: an SR cleaning up a messy intake text may prefer to skip it.
  const [seedDrafts, setSeedDrafts] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
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
    certifications: (submission.certifications ?? []).filter(
      (certification) => certification.trim().toLowerCase() !== "fda registration",
    ),
    certificationsOther: submission.certifications_other ?? "",
    certificationImageUrls: (submission.certification_image_urls ?? []).join(", "),
  })

  const [manufacturingSources, setManufacturingSources] = useState<ManufacturingSourceEntry[]>(() =>
    normalizeManufacturingSources(submission.manufacturing_sources, { preserveReviewFields: true }),
  )
  const [sourcing, setSourcing] = useState({
    supplierEntityType: isSupplierEntityType(submission.supplier_entity_type)
      ? submission.supplier_entity_type
      : "unknown" as SupplierEntityType,
    sourceVerificationConsent: submission.source_verification_consent ?? false,
    sourceChangeAcknowledged: submission.source_change_acknowledged ?? false,
    usSalesChannelStatus: isUsSalesChannelStatus(submission.us_sales_channel_status)
      ? submission.us_sales_channel_status
      : "unknown" as UsSalesChannelStatus,
    usSalesChannelNotes: submission.us_sales_channel_notes ?? "",
    veximSupportNeeds: normalizeSupportNeeds(submission.vexim_support_needs),
    veximSupportOther: submission.vexim_support_other ?? "",
  })
  const [sourceVerificationStatus, setSourceVerificationStatus] =
    useState<ProfileSourceStatus>(() =>
      isProfileSourceStatus(submission.source_verification_status)
        ? submission.source_verification_status
        : submission.manufacturing_sources?.length
          ? "pending_verification"
          : "awaiting_details",
    )

  const [assessment, setAssessment] = useState<FactoryCapabilityAnswers>(() => ({
    ...EMPTY_FACTORY_CAPABILITY_ANSWERS,
    quality_systems: submission.quality_systems ?? [],
    quality_systems_other: submission.quality_systems_other ?? "",
    oem_odm: submission.oem_odm ?? [],
    company_scale: submission.company_scale ?? "",
    export_since_year: submission.export_since_year?.toString() ?? "",
    export_markets: submission.export_markets ?? [],
    export_markets_other: submission.export_markets_other ?? "",
    traceability: submission.traceability ?? [],
    fda_status: "",
    fda_number: "",
    fda_expires_at: "",
    fda_certificate_url: "",
    audit_readiness: submission.audit_readiness ?? [],
    audit_owner: submission.audit_owner ?? "",
    incoterms: submission.incoterms ?? [],
    payment_policy: submission.payment_policy ?? "",
    oem_policy: submission.oem_policy ?? "",
    odm_policy: submission.odm_policy ?? "",
    has_export_dept: submission.has_export_dept ? "yes" : "",
    has_english_staff: submission.has_english_staff ? "yes" : "",
    pricing_decision_maker: submission.pricing_decision_maker ?? "",
    commitments: submission.commitments ?? [],
    project_priority: submission.project_priority ?? "",
  }))

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateSourcing<K extends keyof typeof sourcing>(key: K, value: (typeof sourcing)[K]) {
    setSourcing((previous) => ({ ...previous, [key]: value }))
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

  function updateManufacturingSource(index: number, patch: Partial<ManufacturingSourceEntry>) {
    setManufacturingSources((previous) =>
      previous.map((source, currentIndex) =>
        currentIndex === index ? { ...source, ...patch } : source,
      ),
    )
  }

  function addManufacturingSource() {
    if (manufacturingSources.length >= MAX_MANUFACTURING_SOURCES) return
    setManufacturingSources((previous) => [...previous, emptyManufacturingSource()])
  }

  function removeManufacturingSource(index: number) {
    setManufacturingSources((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  function toggleSupportNeed(value: VeximSupportNeed) {
    setSourcing((previous) => ({
      ...previous,
      veximSupportNeeds: previous.veximSupportNeeds.includes(value)
        ? previous.veximSupportNeeds.filter((item) => item !== value)
        : [...previous.veximSupportNeeds, value],
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
    const sources = normalizeManufacturingSources(manufacturingSources, { preserveReviewFields: true })
    const effectiveSourceStatus = sources.length > 0
      ? deriveProfileSourceStatus(sources)
      : sourceVerificationStatus
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
      certification_image_urls: form.certificationImageUrls
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      quality_systems: assessment.quality_systems,
      quality_systems_other: assessment.quality_systems_other || null,
      oem_odm: assessment.oem_odm,
      company_scale: assessment.company_scale || null,
      export_since_year: Number(assessment.export_since_year) || null,
      export_markets: assessment.export_markets,
      export_markets_other: assessment.export_markets_other || null,
      traceability: assessment.traceability,
      supplier_entity_type: sourcing.supplierEntityType,
      manufacturing_sources: sources,
      source_verification_status: effectiveSourceStatus,
      source_verification_consent: sourcing.sourceVerificationConsent,
      source_change_acknowledged: sourcing.sourceChangeAcknowledged,
      us_sales_channel_status: sourcing.usSalesChannelStatus,
      us_sales_channel_notes: sourcing.usSalesChannelNotes || null,
      vexim_support_needs: sourcing.veximSupportNeeds,
      vexim_support_other: sourcing.veximSupportOther || null,
      audit_readiness: assessment.audit_readiness,
      audit_owner: assessment.audit_owner || null,
      incoterms: assessment.incoterms,
      payment_policy: assessment.payment_policy || null,
      oem_policy: assessment.oem_policy || null,
      odm_policy: assessment.odm_policy || null,
      has_export_dept: assessment.has_export_dept === "yes" ? true : assessment.has_export_dept === "no" ? false : null,
      has_english_staff: assessment.has_english_staff === "yes" ? true : assessment.has_english_staff === "no" ? false : null,
      pricing_decision_maker: assessment.pricing_decision_maker || null,
      commitments: assessment.commitments,
      project_priority: assessment.project_priority || null,
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
      case "verification_notes_required":
        return tr(
          "Hãy ghi chú cách Vexim xác minh trước khi đánh dấu cơ sở là đã xác minh.",
          "Add internal verification notes before marking a facility verified.",
        )
      case "verified_source_required":
        return tr(
          "Cần ít nhất một cơ sở nguồn được ghi nhận và có ghi chú xác minh trước khi đặt trạng thái đã xác minh.",
          "Record at least one manufacturing source and its verification notes before setting the status to verified.",
        )
      case "profile_lookup_failed":
      case "profile_update_failed":
      case "source_save_failed":
        return tr(
          "Không thể lưu thông tin nguồn vào tài khoản. Vui lòng thử lại hoặc báo quản trị viên.",
          "Could not save source information to the account. Please retry or contact an administrator.",
        )
      case "industry_invalid":
        return tr("Vui lòng chọn ngành nghề hợp lệ.", "Please select a valid industry.")
      default:
        return tr("Có lỗi xảy ra, vui lòng thử lại.", "Something went wrong.")
    }
  }

  /**
   * Live preview of exactly what approving will create. The textarea is the
   * editor: fixing the text fixes the chips, so no separate product editor is
   * needed before a row exists anywhere.
   */
  const productPreview = useMemo(
    () => splitMainProducts(form.mainProducts, { companyName: form.companyName }),
    [form.mainProducts, form.companyName],
  )
  const effectiveSourceStatus = manufacturingSources.length > 0
    ? deriveProfileSourceStatus(manufacturingSources)
    : sourceVerificationStatus

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
    setNotice(null)
    startTransition(async () => {
      const result = await approveIntakeSubmission(submission.id, buildFields(), undefined, {
        seedProductsFromIntake: seedDrafts,
      })
      if (!result.ok) {
        setError(translateError(result.error ?? "unknown"))
        return
      }
      setApproved(true)
      if (result.seededProducts) {
        setNotice(
          tr(
            `Đã tạo ${result.seededProducts} sản phẩm nháp (ẩn với buyer tới khi bạn bật lên ở Quản lý hồ sơ).`,
            `Created ${result.seededProducts} draft product(s) (hidden from buyers until you publish them in the profile manager).`,
          ),
        )
      }
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
                <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
                  {productPreview.candidates.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {productPreview.candidates.map((candidate) => (
                        <Badge
                          key={candidate.nameKey}
                          variant={candidate.confidence === "low" ? "outline" : "secondary"}
                          className="font-normal"
                          title={candidate.hsCode ? `HS ${candidate.hsCode}` : undefined}
                        >
                          {candidate.productName}
                          {candidate.hsCode ? ` · ${candidate.hsCode}` : ""}
                          {candidate.category ? ` · ${candidate.category}` : ""}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {tr(
                        "Chưa tách được sản phẩm nào từ phần này — viết mỗi sản phẩm một dòng (hoặc cách nhau bởi dấu phẩy) để hệ thống tự lập danh mục.",
                        "Nothing separable here yet — put one product per line (or comma-separate them) so the catalog can be built automatically.",
                      )}
                    </p>
                  )}
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={seedDrafts}
                      onCheckedChange={(checked) => setSeedDrafts(checked === true)}
                      className="mt-0.5"
                    />
                    <span>
                      {tr(
                        `Duyệt xong tạo ${productPreview.candidates.length} sản phẩm nháp từ danh sách trên (ẩn với buyer). Bỏ chọn nếu bạn sẽ tự nhập.`,
                        `On approval, create ${productPreview.candidates.length} draft product(s) from the list above (hidden from buyers). Uncheck if you will type them yourself.`,
                      )}
                    </span>
                  </label>
                  {productPreview.dropped.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {tr(
                        `Bỏ qua ${productPreview.dropped.length} cụm từ không phải tên sản phẩm (${[...new Set(productPreview.dropped.map((d) => d.reason))].join(", ")}).`,
                        `Skipped ${productPreview.dropped.length} non-product phrase(s) (${[...new Set(productPreview.dropped.map((d) => d.reason))].join(", ")}).`,
                      )}
                    </p>
                  )}
                </div>
                {notice && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{notice}</p>
                )}
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
              <CardTitle>{tr("Nguồn nhà máy & xác minh (nội bộ)", "Manufacturing sources & verification (internal)")}</CardTitle>
              <CardDescription>
                {tr(
                  "Địa điểm và thông tin xác minh chỉ dùng nội bộ, không đưa vào địa chỉ hoặc hồ sơ công khai. Thiếu bằng chứng không cản trở việc tiếp nhận; hồ sơ phải tiếp tục ở trạng thái chờ xác minh.",
                  "Facility locations and verification details are internal only and never copied to public addresses or profiles. Missing evidence does not block intake; unverified sources stay pending.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="review-supplier-entity-type">{tr("Loại đối tác", "Supplier relationship type")}</Label>
                  <select
                    id="review-supplier-entity-type"
                    value={sourcing.supplierEntityType}
                    onChange={(event) => updateSourcing("supplierEntityType", event.target.value as SupplierEntityType)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {SUPPLIER_ENTITY_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{locale === "vi" ? option.labelVi : option.labelEn}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="review-source-status">{tr("Tình trạng nguồn sản xuất", "Manufacturing source status")}</Label>
                  <select
                    id="review-source-status"
                    value={effectiveSourceStatus}
                    disabled={Boolean(
                      manufacturingSources.length > 0 ||
                      ((submission.client_id || submission.linked_client_profile) && manufacturingSources.length === 0)
                    )}
                    onChange={(event) => setSourceVerificationStatus(event.target.value as ProfileSourceStatus)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                  >
                    {PROFILE_SOURCE_STATUSES
                      .filter((option) =>
                        option.value !== "verified" ||
                        manufacturingSources.length > 0 ||
                        effectiveSourceStatus === "verified",
                      )
                      .map((option) => (
                        <option key={option.value} value={option.value}>{locale === "vi" ? option.labelVi : option.labelEn}</option>
                      ))}
                  </select>
                  {manufacturingSources.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {tr("Tình trạng tài khoản được suy ra từ trạng thái xác minh của từng cơ sở bên dưới.", "Account status is derived from the facility verification decisions below.")}
                    </p>
                  )}
                </div>
              </div>

              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{tr("Các cơ sở và sản phẩm nguồn", "Source facilities and products")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {tr(`Tối đa ${MAX_MANUFACTURING_SOURCES} cơ sở. Không có cơ sở khai báo vẫn có thể duyệt, nhưng cần giữ trạng thái chờ thông tin.`, `Up to ${MAX_MANUFACTURING_SOURCES} facilities. Intake may be approved with no facility yet, but keep the status awaiting details.`)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addManufacturingSource}
                    disabled={manufacturingSources.length >= MAX_MANUFACTURING_SOURCES}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> {tr("Thêm cơ sở", "Add facility")}
                  </Button>
                </div>

                {manufacturingSources.length === 0 && (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {tr("Chưa có thông tin cơ sở sản xuất. Có thể duyệt hồ sơ và đặt tình trạng nguồn là chờ bổ sung.", "No manufacturing-source details yet. You may approve the intake and leave source status as awaiting details.")}
                  </p>
                )}
                {manufacturingSources.length === 0 && (submission.client_id || submission.linked_client_profile) && (
                  <p className="text-xs text-muted-foreground">
                    {tr("Đây là hồ sơ bổ sung chưa có cơ sở mới; trạng thái nguồn hiện tại của tài khoản sẽ được giữ nguyên.", "This supplement has no new facility records; the account's existing source status will be preserved.")}
                  </p>
                )}

                {manufacturingSources.map((source, index) => (
                  <div key={index} className="flex flex-col gap-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">{tr(`Cơ sở #${index + 1}`, `Facility #${index + 1}`)}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeManufacturingSource(index)}
                        className="gap-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> {tr("Xóa", "Remove")}
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-facility-name-${index}`}>{tr("Tên pháp lý đơn vị vận hành", "Facility operator's legal name")}</Label>
                        <Input
                          id={`review-facility-name-${index}`}
                          value={source.facility_name}
                          onChange={(event) => updateManufacturingSource(index, { facility_name: event.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-facility-address-${index}`}>{tr("Địa chỉ cơ sở (nội bộ)", "Facility location (internal)")}</Label>
                        <Textarea
                          id={`review-facility-address-${index}`}
                          value={source.facility_address}
                          onChange={(event) => updateManufacturingSource(index, { facility_address: event.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-relationship-${index}`}>{tr("Mối quan hệ với cơ sở", "Relationship to facility")}</Label>
                        <select
                          id={`review-source-relationship-${index}`}
                          value={source.relationship_type}
                          onChange={(event) => updateManufacturingSource(index, { relationship_type: event.target.value as ManufacturingSourceEntry["relationship_type"] })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">{tr("Chưa xác định", "Not specified")}</option>
                          {SOURCE_RELATIONSHIP_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>{locale === "vi" ? option.labelVi : option.labelEn}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-verification-${index}`}>{tr("Trạng thái xác minh cơ sở", "Facility verification status")}</Label>
                        <select
                          id={`review-source-verification-${index}`}
                          value={source.verification_status}
                          onChange={(event) => updateManufacturingSource(index, { verification_status: event.target.value as ManufacturingSourceEntry["verification_status"] })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {SOURCE_VERIFICATION_STATUSES.map((option) => (
                            <option key={option.value} value={option.value}>{locale === "vi" ? option.labelVi : option.labelEn}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-products-${index}`}>{tr("Sản phẩm tại cơ sở này", "Products made at this facility")}</Label>
                        <Textarea
                          id={`review-source-products-${index}`}
                          value={source.product_names.join("\n")}
                          onChange={(event) => updateManufacturingSource(index, {
                            product_names: event.target.value.split(/\r?\n|;/).map((value) => value.trim()).filter(Boolean).slice(0, 20),
                          })}
                          rows={3}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-relationship-notes-${index}`}>{tr("Ghi chú về mối quan hệ", "Relationship notes")}</Label>
                        <Textarea
                          id={`review-source-relationship-notes-${index}`}
                          value={source.relationship_notes}
                          onChange={(event) => updateManufacturingSource(index, { relationship_notes: event.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-contact-name-${index}`}>{tr("Đầu mối xác minh", "Verification contact")}</Label>
                        <Input id={`review-source-contact-name-${index}`} value={source.verification_contact_name} onChange={(event) => updateManufacturingSource(index, { verification_contact_name: event.target.value })} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-contact-email-${index}`}>Email</Label>
                        <Input id={`review-source-contact-email-${index}`} type="email" value={source.verification_contact_email} onChange={(event) => updateManufacturingSource(index, { verification_contact_email: event.target.value })} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-contact-phone-${index}`}>{tr("Điện thoại", "Phone")}</Label>
                        <Input id={`review-source-contact-phone-${index}`} value={source.verification_contact_phone} onChange={(event) => updateManufacturingSource(index, { verification_contact_phone: event.target.value })} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-evidence-${index}`}>{tr("Bằng chứng / cách xác minh do nhà cung cấp nêu", "Supplier-reported evidence / verification method")}</Label>
                        <Textarea id={`review-source-evidence-${index}`} value={source.evidence_note} onChange={(event) => updateManufacturingSource(index, { evidence_note: event.target.value })} rows={2} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`review-source-verification-notes-${index}`}>{tr("Ghi chú xác minh nội bộ (bắt buộc nếu đánh dấu đã xác minh)", "Internal verification notes (required when marked verified)")}</Label>
                        <Textarea id={`review-source-verification-notes-${index}`} value={source.verification_notes} onChange={(event) => updateManufacturingSource(index, { verification_notes: event.target.value })} rows={2} />
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={sourcing.sourceVerificationConsent} onCheckedChange={(checked) => updateSourcing("sourceVerificationConsent", checked === true)} className="mt-0.5" />
                  <span>{tr("Nhà cung cấp đồng ý cho Vexim xác minh nguồn", "Supplier consented to source verification")}</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={sourcing.sourceChangeAcknowledged} onCheckedChange={(checked) => updateSourcing("sourceChangeAcknowledged", checked === true)} className="mt-0.5" />
                  <span>{tr("Đã xác nhận phải báo Vexim trước khi đổi nguồn đã giới thiệu", "Supplier acknowledged the source-change notice commitment")}</span>
                </label>
              </div>

              <section className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">{tr("Kênh bán tại Mỹ & hỗ trợ mong muốn", "U.S. sales channels & requested support")}</h3>
                  <p className="text-xs text-muted-foreground">{tr("Chỉ dùng để hiểu nhu cầu; không tự động loại supplier.", "For planning only; never auto-reject a supplier.")}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="review-us-channel-status">{tr("Buyer/kênh bán hiện có", "Current U.S. buyer/channel status")}</Label>
                  <select id="review-us-channel-status" value={sourcing.usSalesChannelStatus} onChange={(event) => updateSourcing("usSalesChannelStatus", event.target.value as UsSalesChannelStatus)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {US_SALES_CHANNEL_STATUSES.map((option) => <option key={option.value} value={option.value}>{locale === "vi" ? option.labelVi : option.labelEn}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="review-us-channel-notes">{tr("Ghi chú kênh/buyer", "Buyer/channel notes")}</Label>
                  <Textarea id="review-us-channel-notes" value={sourcing.usSalesChannelNotes} onChange={(event) => updateSourcing("usSalesChannelNotes", event.target.value)} rows={2} />
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">{tr("Nhu cầu hỗ trợ", "Requested support")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {VEXIM_SUPPORT_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox checked={sourcing.veximSupportNeeds.includes(option.value)} onCheckedChange={() => toggleSupportNeed(option.value)} className="mt-0.5" />
                        <span>{locale === "vi" ? option.labelVi : option.labelEn}</span>
                      </label>
                    ))}
                  </div>
                  {sourcing.veximSupportNeeds.includes("other") && (
                    <Textarea aria-label={tr("Nhu cầu hỗ trợ khác", "Other support needs")} value={sourcing.veximSupportOther} onChange={(event) => updateSourcing("veximSupportOther", event.target.value)} rows={2} />
                  )}
                </fieldset>
              </section>
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
                <Label>{tr("Ảnh chứng nhận (HACCP, ISO...)", "Certification images (HACCP, ISO...)")}</Label>
                <Input
                  value={form.certificationImageUrls}
                  onChange={(e) => update("certificationImageUrls", e.target.value)}
                  placeholder={tr("Nhiều URL, ngăn cách bởi dấu phẩy", "Comma-separated URLs")}
                />
                <p className="text-xs text-muted-foreground">
                  {tr("Ảnh sẽ hiển thị trên trang hồ sơ công khai ở mục Chứng nhận & Tuân thủ.", "Images will show on the public profile in Certifications & Compliance.")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{tr("URL video nhà máy", "Factory video URL")}</Label>
                <Input value={form.videoUrl} onChange={(e) => update("videoUrl", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr("Đánh giá năng lực nhà máy", "Factory capability assessment")}</CardTitle>
              <CardDescription>
                {tr("8 mục thông tin được đánh số từ 1 đến 8; rà soát FDA diễn ra riêng khi cần theo buyer, sản phẩm và cơ sở.", "Eight assessment sections, numbered 1 through 8; FDA review is handled separately when relevant to a buyer, product, and facility.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FactoryCapabilityStep
                values={assessment}
                onChange={(patch) => setAssessment((previous) => ({ ...previous, ...patch }))}
                showFda={false}
              />
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
