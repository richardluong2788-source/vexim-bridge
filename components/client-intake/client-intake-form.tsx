"use client"

import { useMemo, useState, useTransition } from "react"
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Factory,
  Loader2,
  Languages,
  Plus,
  Star,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  INDUSTRIES,
  INDUSTRY_LABELS_VI,
  type Industry,
} from "@/lib/constants/industries"
import { COUNTRY_SUGGESTIONS } from "@/lib/constants/countries"
import {
  MAX_MANUFACTURING_SOURCES,
  SOURCE_RELATIONSHIP_TYPES,
  SUPPLIER_ENTITY_TYPES,
  US_SALES_CHANNEL_STATUSES,
  VEXIM_SUPPORT_OPTIONS,
  emptyManufacturingSource,
  isSupplierEntityType,
  normalizeManufacturingSources,
  normalizeSupportNeeds,
  type ManufacturingSourceEntry,
  type SupplierEntityType,
  type UsSalesChannelStatus,
  type VeximSupportNeed,
} from "@/lib/client-intake/sourcing"
import { submitClientIntake } from "@/app/client-intake/[token]/actions"
import { FactoryCapabilityStep } from "@/components/client-intake/factory-capability-step"
import { ImageLinkField } from "@/components/client-intake/image-link-field"
import {
  ASSESSMENT_LABELS,
  EMPTY_FACTORY_CAPABILITY_ANSWERS,
  type FactoryCapabilityAnswers,
} from "@/lib/assessment/constants"

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

interface IntakeInitialData {
  ae_full_name: string | null
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
  quality_systems: string[] | null
  quality_systems_other: string | null
  oem_odm: string[] | null
  company_scale: string | null
  export_since_year: number | null
  export_markets: string[] | null
  export_markets_other: string | null
  traceability: string[] | null
  supplier_entity_type: string | null
  manufacturing_sources: Record<string, unknown>[] | null
  source_verification_consent: boolean | null
  source_change_acknowledged: boolean | null
  us_sales_channel_status: string | null
  us_sales_channel_notes: string | null
  vexim_support_needs: string[] | null
  vexim_support_other: string | null
  certification_image_urls: string[] | null
  audit_readiness: string[] | null
  audit_owner: string | null
  incoterms: string[] | null
  payment_policy: string | null
  oem_policy: string | null
  odm_policy: string | null
  has_export_dept: boolean | null
  has_english_staff: boolean | null
  pricing_decision_maker: string | null
  commitments: string[] | null
  project_priority: string | null
}

interface ClientIntakeFormProps {
  token: string
  initial: IntakeInitialData
}

interface FormState {
  companyName: string
  contactName: string
  email: string
  phone: string
  industries: Industry[]
  country: string
  address: string
  website: string
  taxCode: string
  tagline: string
  description: string
  mainProducts: string
  productionCapacity: string
  moq: string
  leadTimeDays: string
  uspPoints: { icon: string; title: string }[]
  logoUrl: string
  coverImageUrl: string
  factoryImageUrls: string
  videoUrl: string
  certifications: string[]
  certificationsOther: string
  certificationImageUrls: string
  supplierEntityType: SupplierEntityType
  manufacturingSources: ManufacturingSourceEntry[]
  sourceVerificationConsent: boolean
  sourceChangeAcknowledged: boolean
  usSalesChannelStatus: UsSalesChannelStatus
  usSalesChannelNotes: string
  veximSupportNeeds: VeximSupportNeed[]
  veximSupportOther: string
  assessment: FactoryCapabilityAnswers
}

const STEPS = [
  { key: "company", label: "Giới thiệu doanh nghiệp", icon: Building2 },
  { key: "sourcing", label: "Nguồn nhà máy & thị trường Mỹ", icon: Factory },
  { key: "capability", label: "Năng lực & chứng nhận", icon: FileCheck2 },
  { key: "assessment", label: "Đánh giá năng lực nhà máy", icon: ClipboardCheck },
  { key: "review", label: "Xem lại & gửi", icon: CheckCircle2 },
] as const

export function ClientIntakeForm({ token, initial }: ClientIntakeFormProps) {
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState<FormState>({
    companyName: initial.company_name ?? "",
    contactName: initial.contact_name ?? "",
    email: initial.email ?? "",
    phone: initial.phone ?? "",
    industries: initial.industries ?? [],
    country: initial.country ?? "",
    address: initial.address ?? "",
    website: initial.website ?? "",
    taxCode: initial.tax_code ?? "",
    tagline: initial.tagline ?? "",
    description: initial.company_description ?? "",
    mainProducts: initial.main_products ?? "",
    productionCapacity: initial.production_capacity ?? "",
    moq: initial.moq ?? "",
    leadTimeDays: initial.lead_time_days ?? "",
    uspPoints:
      initial.usp_points && initial.usp_points.length > 0
        ? initial.usp_points
        : [{ icon: "", title: "" }],
    logoUrl: initial.logo_url ?? "",
    coverImageUrl: initial.cover_image_url ?? "",
    factoryImageUrls: (initial.factory_image_urls ?? []).join(", "),
    videoUrl: initial.video_url ?? "",
    certifications: (initial.certifications ?? []).filter(
      (certification) => certification.trim().toLowerCase() !== "fda registration",
    ),
    certificationsOther: initial.certifications_other ?? "",
    certificationImageUrls: (initial.certification_image_urls ?? []).join(", "),
    supplierEntityType: isSupplierEntityType(initial.supplier_entity_type)
      ? initial.supplier_entity_type
      : "unknown",
    manufacturingSources: normalizeManufacturingSources(initial.manufacturing_sources),
    sourceVerificationConsent: initial.source_verification_consent ?? false,
    sourceChangeAcknowledged: initial.source_change_acknowledged ?? false,
    usSalesChannelStatus:
      initial.us_sales_channel_status === "yes" ||
      initial.us_sales_channel_status === "no" ||
      initial.us_sales_channel_status === "in_progress"
        ? initial.us_sales_channel_status
        : "unknown",
    usSalesChannelNotes: initial.us_sales_channel_notes ?? "",
    veximSupportNeeds: normalizeSupportNeeds(initial.vexim_support_needs),
    veximSupportOther: initial.vexim_support_other ?? "",
    assessment: {
      quality_systems: initial.quality_systems ?? [],
      quality_systems_other: initial.quality_systems_other ?? "",
      oem_odm: initial.oem_odm ?? [],
      company_scale: initial.company_scale ?? "",
      export_since_year: initial.export_since_year?.toString() ?? "",
      export_markets: initial.export_markets ?? [],
      export_markets_other: initial.export_markets_other ?? "",
      traceability: initial.traceability ?? [],
      fda_status: "",
      fda_number: "",
      fda_expires_at: "",
      fda_certificate_url: "",
      audit_readiness: initial.audit_readiness ?? [],
      audit_owner: initial.audit_owner ?? "",
      incoterms: initial.incoterms ?? [],
      payment_policy: initial.payment_policy ?? "",
      oem_policy: initial.oem_policy ?? "",
      odm_policy: initial.odm_policy ?? "",
      has_export_dept:
        initial.has_export_dept == null ? "" : initial.has_export_dept ? "yes" : "no",
      has_english_staff:
        initial.has_english_staff == null ? "" : initial.has_english_staff ? "yes" : "no",
      pricing_decision_maker: initial.pricing_decision_maker ?? "",
      commitments: initial.commitments ?? [],
      project_priority: initial.project_priority ?? "",
    },
  })

  function updateAssessment(patch: Partial<FactoryCapabilityAnswers>) {
    setForm((prev) => ({ ...prev, assessment: { ...prev.assessment, ...patch } }))
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
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

  function promoteToPrimary(ind: Industry) {
    setForm((prev) => ({
      ...prev,
      industries: [ind, ...prev.industries.filter((i) => i !== ind)],
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

  function updateManufacturingSource(
    index: number,
    patch: Partial<ManufacturingSourceEntry>,
  ) {
    setForm((prev) => ({
      ...prev,
      manufacturingSources: prev.manufacturingSources.map((source, currentIndex) =>
        currentIndex === index ? { ...source, ...patch } : source,
      ),
    }))
  }

  function addManufacturingSource() {
    if (form.manufacturingSources.length >= MAX_MANUFACTURING_SOURCES) return
    setForm((prev) => ({
      ...prev,
      manufacturingSources: [...prev.manufacturingSources, emptyManufacturingSource()],
    }))
  }

  function removeManufacturingSource(index: number) {
    setForm((prev) => ({
      ...prev,
      manufacturingSources: prev.manufacturingSources.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  function toggleSupportNeed(value: VeximSupportNeed) {
    setForm((prev) => ({
      ...prev,
      veximSupportNeeds: prev.veximSupportNeeds.includes(value)
        ? prev.veximSupportNeeds.filter((item) => item !== value)
        : [...prev.veximSupportNeeds, value],
    }))
  }

  function updateUsp(idx: number, field: "icon" | "title", value: string) {
    setForm((prev) => ({
      ...prev,
      uspPoints: prev.uspPoints.map((p, i) =>
        i === idx ? { ...p, [field]: value } : p,
      ),
    }))
  }

  function addUsp() {
    if (form.uspPoints.length >= 4) return
    setForm((prev) => ({
      ...prev,
      uspPoints: [...prev.uspPoints, { icon: "", title: "" }],
    }))
  }

  function removeUsp(idx: number) {
    setForm((prev) => ({
      ...prev,
      uspPoints: prev.uspPoints.filter((_, i) => i !== idx),
    }))
  }

  const step1Valid = useMemo(
    () =>
      form.companyName.trim() !== "" &&
      form.contactName.trim() !== "" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
      form.phone.trim() !== "" &&
      form.industries.length > 0,
    [form],
  )

  function translateError(code: string): string {
    switch (code) {
      case "invalid_email":
        return "Email không hợp lệ."
      case "contact_name_required":
        return "Vui lòng nhập tên người liên hệ."
      case "company_required":
        return "Vui lòng nhập tên doanh nghiệp."
      case "phone_required":
        return "Vui lòng nhập số điện thoại."
      case "industry_invalid":
        return "Vui lòng chọn ít nhất một ngành nghề."
      case "source_confirmation_required":
        return "Vui lòng xác nhận đồng ý để Vexim xác minh nguồn và thông báo trước khi thay đổi nhà máy."
      case "translation_failed":
        return "Chưa thể dịch nội dung sang tiếng Anh nên hồ sơ chưa được gửi. Thông tin vẫn còn nguyên; vui lòng thử lại sau ít phút hoặc rút gọn nội dung mô tả."
      case "link_expired":
        return "Liên kết đã hết hạn hoặc đã được gửi trước đó."
      default:
        return "Có lỗi xảy ra, vui lòng thử lại."
    }
  }

  function goNext() {
    setError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleSubmit() {
    setError(null)
    if (!form.sourceVerificationConsent || !form.sourceChangeAcknowledged) {
      setError(translateError("source_confirmation_required"))
      setStep(1)
      return
    }
    startTransition(async () => {
      const result = await submitClientIntake(token, {
        contact_name: form.contactName,
        email: form.email,
        phone: form.phone,
        company_name: form.companyName,
        industries: form.industries,
        country: form.country || undefined,
        address: form.address || undefined,
        website: form.website || undefined,
        tax_code: form.taxCode || undefined,
        tagline: form.tagline || undefined,
        company_description: form.description || undefined,
        main_products: form.mainProducts || undefined,
        production_capacity: form.productionCapacity || undefined,
        moq: form.moq || undefined,
        lead_time_days: form.leadTimeDays || undefined,
        usp_points: form.uspPoints.filter((p) => p.title.trim() !== ""),
        logo_url: form.logoUrl || undefined,
        cover_image_url: form.coverImageUrl || undefined,
        factory_image_urls: form.factoryImageUrls
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        video_url: form.videoUrl || undefined,
        certifications: form.certifications,
        certifications_other: form.certificationsOther || undefined,
        certification_image_urls: form.certificationImageUrls
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        quality_systems: form.assessment.quality_systems,
        quality_systems_other: form.assessment.quality_systems_other || undefined,
        oem_odm: form.assessment.oem_odm,
        company_scale: form.assessment.company_scale || undefined,
        export_since_year: form.assessment.export_since_year || undefined,
        export_markets: form.assessment.export_markets,
        export_markets_other: form.assessment.export_markets_other || undefined,
        traceability: form.assessment.traceability,
        supplier_entity_type: form.supplierEntityType,
        manufacturing_sources: form.manufacturingSources,
        source_verification_consent: form.sourceVerificationConsent,
        source_change_acknowledged: form.sourceChangeAcknowledged,
        us_sales_channel_status: form.usSalesChannelStatus,
        us_sales_channel_notes: form.usSalesChannelNotes || undefined,
        vexim_support_needs: form.veximSupportNeeds,
        vexim_support_other: form.veximSupportOther || undefined,
        audit_readiness: form.assessment.audit_readiness,
        audit_owner: form.assessment.audit_owner || undefined,
        incoterms: form.assessment.incoterms,
        payment_policy: form.assessment.payment_policy || undefined,
        oem_policy: form.assessment.oem_policy || undefined,
        odm_policy: form.assessment.odm_policy || undefined,
        has_export_dept:
          form.assessment.has_export_dept === "" ? undefined : form.assessment.has_export_dept === "yes",
        has_english_staff:
          form.assessment.has_english_staff === ""
            ? undefined
            : form.assessment.has_english_staff === "yes",
        pricing_decision_maker: form.assessment.pricing_decision_maker || undefined,
        commitments: form.assessment.commitments,
        project_priority: form.assessment.project_priority || undefined,
      })

      if (!result.ok) {
        setError(translateError(result.error ?? "unknown"))
        return
      }
      setSubmitted(true)
    })
  }

  if (submitted) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Cảm ơn bạn đã gửi hồ sơ!
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Hồ sơ đã được gửi và đang chờ xét duyệt.
            {initial.ae_full_name
              ? ` ${initial.ae_full_name} sẽ liên hệ lại với bạn trong thời gian sớm nhất.`
              : " Nhân viên phụ trách sẽ liên hệ lại với bạn trong thời gian sớm nhất."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const primary = form.industries[0]
  const current = STEPS[step]
  const supplierEntityLabel =
    SUPPLIER_ENTITY_TYPES.find((option) => option.value === form.supplierEntityType)?.labelVi ?? "Chưa rõ"
  const sourceSummary = form.manufacturingSources
    .map((source, index) => {
      const relationshipLabel =
        SOURCE_RELATIONSHIP_TYPES.find((option) => option.value === source.relationship_type)?.labelVi ??
        "Chưa xác định"
      return [
        `Cơ sở #${index + 1}: ${source.facility_name || "Chưa cung cấp tên pháp lý"}`,
        `Địa điểm nội bộ: ${source.facility_address || "Chưa cung cấp"}`,
        `Quan hệ: ${relationshipLabel}`,
        `Sản phẩm: ${source.product_names.join(", ") || "Chưa cung cấp"}`,
        `Đầu mối xác minh: ${[source.verification_contact_name, source.verification_contact_email, source.verification_contact_phone].filter(Boolean).join(" · ") || "Chưa cung cấp"}`,
        `Bằng chứng/cách xác minh: ${source.evidence_note || "Chưa cung cấp"}`,
      ].join("\n")
    })
    .join("\n\n") || "Chưa khai báo cơ sở — chờ bổ sung"
  const usSalesChannelLabel =
    US_SALES_CHANNEL_STATUSES.find((option) => option.value === form.usSalesChannelStatus)?.labelVi ?? "Chưa rõ"
  const supportNeedsSummary = form.veximSupportNeeds
    .map((value) => VEXIM_SUPPORT_OPTIONS.find((option) => option.value === value)?.labelVi ?? value)
    .join(", ") || "Chưa chọn"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-balance text-foreground">
          Bổ sung hồ sơ nhà cung cấp
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Tài khoản xuất khẩu của bạn đã được tạo bởi Vexim. Vui lòng bổ sung
          thông tin doanh nghiệp, năng lực và chứng nhận để{" "}
          {initial.ae_full_name ?? "nhân viên phụ trách"} hoàn thiện hồ sơ và đưa
          sản phẩm của bạn đến buyer Mỹ.{" "}
          {initial.email && (
            <span>
              Bạn sẽ đăng nhập bằng email <strong>{initial.email}</strong> sau
              khi hồ sơ được duyệt.
            </span>
          )}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100">
        <Languages className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          <strong>Bạn có thể điền bằng tiếng Việt hoặc ngôn ngữ thuận tiện nhất.</strong> Ngay sau khi gửi, AI sẽ tự động dịch các phần mô tả doanh nghiệp, sản phẩm và ghi chú mô tả sang tiếng Anh. Hồ sơ vẫn được xét duyệt theo quy trình thông thường; tên pháp lý, thông tin liên hệ, quốc gia, địa chỉ, mã định danh và các lựa chọn dạng danh mục được giữ nguyên. Địa chỉ cơ sở sản xuất chỉ dùng nội bộ, không hiển thị trên hồ sơ công khai.
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-1">
        {STEPS.map((s, idx) => {
          const Icon = s.icon
          const isActive = idx === step
          const isDone = idx < step
          return (
            <li key={s.key} className="flex flex-1 items-center gap-1">
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isDone
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    "hidden text-center text-[11px] leading-tight sm:block",
                    isActive ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1",
                    idx < step ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{current.label}</CardTitle>
          <CardDescription>
            {step === 0 && "Giới thiệu doanh nghiệp, sản phẩm chính, công suất, MOQ – giúp buyer hiểu rõ hơn về bạn."}
            {step === 1 &&
              "Khai báo các cơ sở thực sự sản xuất sản phẩm, mối quan hệ và nhu cầu hỗ trợ tại Mỹ. Thông tin nhà máy chỉ dùng nội bộ; chưa rõ vẫn có thể gửi hồ sơ."}
            {step === 2 &&
              "Điểm mạnh, chứng nhận và hình ảnh nhà máy – tải ảnh chứng nhận để hiển thị trên trang hồ sơ công khai."}
            {step === 3 &&
              "8 mục đánh giá giúp Vexim hiểu rõ năng lực sản xuất, xuất khẩu và mức độ sẵn sàng hợp tác. Rà soát FDA được thực hiện riêng khi cần theo buyer, sản phẩm và cơ sở."}
            {step === 4 && "Kiểm tra lại thông tin trước khi gửi cho Vexim."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {step === 0 && (
            <>
              {(initial.company_name === null || initial.company_name === "" || initial.contact_name === null || initial.contact_name === "") && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  Tài khoản của bạn đã được tạo, nhưng chúng tôi chưa có thông tin liên hệ đầy đủ. Vui lòng bổ sung nếu thiếu.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="companyName">Tên doanh nghiệp</Label>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="Công ty TNHH Xuất khẩu ABC"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contactName">Người liên hệ</Label>
                  <Input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="lienhe@congty.com"
                    disabled={!!initial.email}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+84 90 123 4567"
                  />
                </div>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Ngành nghề (chọn một hoặc nhiều)</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {INDUSTRIES.map((ind) => {
                    const checked = form.industries.includes(ind)
                    return (
                      <label key={ind} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={() => toggleIndustry(ind)} />
                        <span className="flex flex-col">
                          <span className="font-medium">{ind}</span>
                          <span className="text-xs text-muted-foreground">{INDUSTRY_LABELS_VI[ind]}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <Label htmlFor="tagline">Slogan</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                  placeholder="Vì một Việt Nam thịnh vượng"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Mô tả doanh nghiệp</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Giới thiệu ngắn về lịch sử, quy mô, thế mạnh của doanh nghiệp..."
                  rows={4}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mainProducts">Sản phẩm / mã HS chính</Label>
                <Textarea
                  id="mainProducts"
                  value={form.mainProducts}
                  onChange={(e) => update("mainProducts", e.target.value)}
                  placeholder="Ví dụ: Hạt điều rang muối (HS 2008.19), Cà phê rang xay (HS 0901.21)..."
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="productionCapacity">Công suất sản xuất</Label>
                  <Input
                    id="productionCapacity"
                    value={form.productionCapacity}
                    onChange={(e) => update("productionCapacity", e.target.value)}
                    placeholder="500 tấn/năm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="moq">MOQ (số lượng tối thiểu)</Label>
                  <Input
                    id="moq"
                    value={form.moq}
                    onChange={(e) => update("moq", e.target.value)}
                    placeholder="1 container (20ft)"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="leadTimeDays">Thời gian giao hàng</Label>
                  <Input
                    id="leadTimeDays"
                    value={form.leadTimeDays}
                    onChange={(e) => update("leadTimeDays", e.target.value)}
                    placeholder="20-30 ngày"
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100">
                <strong>Thông tin nguồn chỉ dùng nội bộ để Vexim xác minh.</strong> Địa chỉ từng cơ sở không phải địa chỉ công ty và sẽ không hiển thị trên hồ sơ công khai. Nếu chưa biết nhà máy hoặc chưa có đủ bằng chứng, bạn vẫn có thể tiếp tục gửi hồ sơ.
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="supplierEntityType">Doanh nghiệp của bạn làm việc với nhà máy với vai trò nào?</Label>
                <select
                  id="supplierEntityType"
                  value={form.supplierEntityType}
                  onChange={(event) =>
                    update("supplierEntityType", event.target.value as SupplierEntityType)
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {SUPPLIER_ENTITY_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.labelVi}
                    </option>
                  ))}
                </select>
              </div>

              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Các cơ sở sản xuất nguồn</h3>
                    <p className="text-xs text-muted-foreground">
                      Có thể thêm tối đa {MAX_MANUFACTURING_SOURCES} cơ sở. Hãy gắn sản phẩm với đúng cơ sở nếu biết.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addManufacturingSource}
                    disabled={form.manufacturingSources.length >= MAX_MANUFACTURING_SOURCES}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm cơ sở
                  </Button>
                </div>

                {form.manufacturingSources.length === 0 && (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Chưa có thông tin nhà máy? Bạn có thể để trống phần này và gửi hồ sơ; Vexim sẽ ghi nhận nguồn ở trạng thái chờ bổ sung/xác minh.
                  </p>
                )}

                {form.manufacturingSources.map((source, index) => (
                  <div key={index} className="flex flex-col gap-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">Cơ sở #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeManufacturingSource(index)}
                        className="gap-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Xóa cơ sở
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`facility-name-${index}`}>Tên pháp lý của đơn vị vận hành nhà máy</Label>
                        <Input
                          id={`facility-name-${index}`}
                          value={source.facility_name}
                          onChange={(event) =>
                            updateManufacturingSource(index, { facility_name: event.target.value })
                          }
                          placeholder="Giữ nguyên tên pháp lý bằng ngôn ngữ gốc"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`facility-address-${index}`}>Địa điểm cơ sở (chỉ dùng nội bộ)</Label>
                        <Textarea
                          id={`facility-address-${index}`}
                          value={source.facility_address}
                          onChange={(event) =>
                            updateManufacturingSource(index, { facility_address: event.target.value })
                          }
                          placeholder="Địa chỉ/địa điểm nhà máy để Vexim xác minh; không nhập địa chỉ văn phòng nếu khác"
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`facility-relationship-${index}`}>Mối quan hệ của bạn với cơ sở này</Label>
                      <select
                        id={`facility-relationship-${index}`}
                        value={source.relationship_type}
                        onChange={(event) =>
                          updateManufacturingSource(index, {
                            relationship_type: event.target.value as ManufacturingSourceEntry["relationship_type"],
                          })
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Chọn nếu đã biết</option>
                        {SOURCE_RELATIONSHIP_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.labelVi}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`facility-products-${index}`}>Sản phẩm được sản xuất tại cơ sở này</Label>
                        <Textarea
                          id={`facility-products-${index}`}
                          value={source.product_names.join("\n")}
                          onChange={(event) =>
                            updateManufacturingSource(index, {
                              product_names: event.target.value
                                .split(/\r?\n|;/)
                                .map((product) => product.trim())
                                .filter(Boolean)
                                .slice(0, 20),
                            })
                          }
                          placeholder="Mỗi sản phẩm một dòng"
                          rows={3}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`facility-relationship-notes-${index}`}>Mô tả thêm về mối quan hệ (nếu cần)</Label>
                        <Textarea
                          id={`facility-relationship-notes-${index}`}
                          value={source.relationship_notes}
                          onChange={(event) =>
                            updateManufacturingSource(index, { relationship_notes: event.target.value })
                          }
                          placeholder="Ví dụ: thời gian hợp tác, phạm vi ủy quyền, sản phẩm phụ trách..."
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`verification-contact-name-${index}`}>Đầu mối xác minh (tên)</Label>
                        <Input
                          id={`verification-contact-name-${index}`}
                          value={source.verification_contact_name}
                          onChange={(event) =>
                            updateManufacturingSource(index, { verification_contact_name: event.target.value })
                          }
                          placeholder="Người có thể xác nhận"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`verification-contact-email-${index}`}>Email đầu mối</Label>
                        <Input
                          id={`verification-contact-email-${index}`}
                          type="email"
                          value={source.verification_contact_email}
                          onChange={(event) =>
                            updateManufacturingSource(index, { verification_contact_email: event.target.value })
                          }
                          placeholder="name@factory.com"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`verification-contact-phone-${index}`}>Điện thoại đầu mối</Label>
                        <Input
                          id={`verification-contact-phone-${index}`}
                          value={source.verification_contact_phone}
                          onChange={(event) =>
                            updateManufacturingSource(index, { verification_contact_phone: event.target.value })
                          }
                          placeholder="+84 ..."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`facility-evidence-${index}`}>Bằng chứng hiện có / cách Vexim có thể xác minh</Label>
                      <Textarea
                        id={`facility-evidence-${index}`}
                        value={source.evidence_note}
                        onChange={(event) =>
                          updateManufacturingSource(index, { evidence_note: event.target.value })
                        }
                        placeholder="Có thể ghi loại giấy tờ, website đăng ký, khả năng gọi xác nhận hoặc sắp xếp tham quan. Không cần tải tài liệu ngay."
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Buyer / kênh bán hiện có tại Hoa Kỳ</h3>
                  <p className="text-xs text-muted-foreground">Thông tin giúp Vexim hiểu điểm xuất phát; câu trả lời không tự động loại nhà cung cấp.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="usSalesChannelStatus">Hiện doanh nghiệp có buyer hoặc kênh bán tại Mỹ không?</Label>
                  <select
                    id="usSalesChannelStatus"
                    value={form.usSalesChannelStatus}
                    onChange={(event) =>
                      update("usSalesChannelStatus", event.target.value as UsSalesChannelStatus)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {US_SALES_CHANNEL_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>{option.labelVi}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="usSalesChannelNotes">Mô tả buyer/kênh hiện có (không bắt buộc)</Label>
                  <Textarea
                    id="usSalesChannelNotes"
                    value={form.usSalesChannelNotes}
                    onChange={(event) => update("usSalesChannelNotes", event.target.value)}
                    placeholder="Ví dụ: đã xuất qua importer, distributor hoặc bán qua thương hiệu riêng..."
                    rows={2}
                  />
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">Bạn mong muốn Vexim hỗ trợ nội dung nào?</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {VEXIM_SUPPORT_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox
                          checked={form.veximSupportNeeds.includes(option.value)}
                          onCheckedChange={() => toggleSupportNeed(option.value)}
                          className="mt-0.5"
                        />
                        <span>{option.labelVi}</span>
                      </label>
                    ))}
                  </div>
                  {form.veximSupportNeeds.includes("other") && (
                    <Textarea
                      aria-label="Nhu cầu hỗ trợ khác"
                      value={form.veximSupportOther}
                      onChange={(event) => update("veximSupportOther", event.target.value)}
                      placeholder="Mô tả nhu cầu khác"
                      rows={2}
                    />
                  )}
                </fieldset>
              </section>

              <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={form.sourceVerificationConsent}
                    onCheckedChange={(checked) => update("sourceVerificationConsent", checked === true)}
                    className="mt-0.5"
                  />
                  <span>Tôi đồng ý để Vexim liên hệ với cơ sở/đầu mối đã nêu và xác minh mối quan hệ, sản phẩm hoặc thông tin liên quan.</span>
                </label>
                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={form.sourceChangeAcknowledged}
                    onCheckedChange={(checked) => update("sourceChangeAcknowledged", checked === true)}
                    className="mt-0.5"
                  />
                  <span>Tôi xác nhận sẽ thông báo cho Vexim trước khi thay đổi cơ sở sản xuất đã giới thiệu cho buyer thông qua Vexim.</span>
                </label>
              </section>
            </div>
          )}

          {step === 2 && (
            <>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium">
                  Điểm mạnh chính (USP){" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (tối đa 4)
                  </span>
                </legend>
                {form.uspPoints.map((usp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={usp.icon}
                      onChange={(e) => updateUsp(idx, "icon", e.target.value)}
                      placeholder="Từ khoá (VD: Experience)"
                      className="w-40 shrink-0"
                    />
                    <Input
                      value={usp.title}
                      onChange={(e) => updateUsp(idx, "title", e.target.value)}
                      placeholder="20 năm kinh nghiệm xuất khẩu"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUsp(idx)}
                      disabled={form.uspPoints.length === 1}
                      aria-label="Xóa"
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
                    Thêm điểm mạnh
                  </Button>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Chứng nhận</legend>
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
                  placeholder="Chứng nhận khác (nếu có)"
                />
                <div className="flex flex-col gap-2 pt-2">
                  <Label>Ảnh chứng nhận (HACCP, ISO, Halal, v.v.) – tối đa 5 ảnh</Label>
                  <ImageLinkField
                    max={5}
                    token={token}
                    value={form.certificationImageUrls
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)}
                    onChange={(urls) => update("certificationImageUrls", urls.join(", "))}
                    recommendedSize="1200 x 1600px – ảnh rõ nét, có số chứng nhận và ngày hết hạn"
                    uploadLabel="Tải ảnh chứng nhận – dưới 5MB/ảnh"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ảnh chứng nhận sẽ được hiển thị trên trang hồ sơ nhà cung cấp (mục Chứng nhận & Tuân thủ) và giúp buyer xác minh nhanh.
                  </p>
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
              <Label>Logo doanh nghiệp</Label>
              <ImageLinkField
                max={1}
                token={token}
                value={form.logoUrl ? [form.logoUrl] : []}
                onChange={(urls) => update("logoUrl", urls[0] ?? "")}
                recommendedSize="400 x 400px (vuông, nền trong suốt hoặc trắng)"
                uploadLabel="Tải logo – dưới 5MB"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ảnh bìa</Label>
              <ImageLinkField
                max={1}
                token={token}
                value={form.coverImageUrl ? [form.coverImageUrl] : []}
                onChange={(urls) => update("coverImageUrl", urls[0] ?? "")}
                recommendedSize="1600 x 900px (tỉ lệ 16:9)"
                uploadLabel="Tải ảnh bìa – dưới 5MB"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Ảnh nhà máy / sản phẩm</Label>
            <ImageLinkField
              max={5}
              token={token}
              value={form.factoryImageUrls
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)}
              onChange={(urls) => update("factoryImageUrls", urls.join(", "))}
              recommendedSize="1200 x 1200px trở lên, ảnh ngang hoặc vuông rõ nét"
              uploadLabel="Tải ảnh nhà máy / sản phẩm – dưới 5MB"
            />
          </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="videoUrl">URL video nhà máy (YouTube)</Label>
                <Input
                  id="videoUrl"
                  value={form.videoUrl}
                  onChange={(e) => update("videoUrl", e.target.value)}
                  placeholder="https://youtube.com/..."
                />
              </div>
            </>
          )}

          

{step === 3 && (
            <FactoryCapabilityStep
              values={form.assessment}
              onChange={updateAssessment}
              token={token}
              showFda={false}
            />
          )}

          

{step === 4 && (
            <div className="flex flex-col gap-4 text-sm">
              <ReviewSection
                title="Liên hệ & đăng ký"
                rows={[
                  ["Tên doanh nghiệp", form.companyName],
                  ["Người liên hệ", form.contactName],
                  ["Email", form.email],
                  ["Điện thoại", form.phone],
                  ["Ngành nghề", form.industries.join(", ") || "—"],
                  ["Quốc gia", form.country || "—"],
                  ["Địa chỉ", form.address || "—"],
                  ["Website", form.website || "—"],
                  ["Mã số thuế", form.taxCode || "—"],
                ]}
              />
              <ReviewSection
                title="Giới thiệu doanh nghiệp"
                rows={[
                  ["Slogan", form.tagline || "—"],
                  ["Mô tả", form.description || "—"],
                  ["Sản phẩm chính", form.mainProducts || "—"],
                  ["Công suất", form.productionCapacity || "—"],
                  ["MOQ", form.moq || "—"],
                  ["Thời gian giao hàng", form.leadTimeDays || "—"],
                ]}
              />
              <ReviewSection
                title="Nguồn nhà máy — thông tin nội bộ"
                rows={[
                  ["Vai trò doanh nghiệp", supplierEntityLabel],
                  ["Cơ sở và sản phẩm", sourceSummary],
                  ["Đồng ý xác minh", form.sourceVerificationConsent ? "Đã xác nhận" : "Chưa xác nhận"],
                  ["Thông báo khi đổi nguồn", form.sourceChangeAcknowledged ? "Đã xác nhận" : "Chưa xác nhận"],
                ]}
              />
              <ReviewSection
                title="Thị trường Mỹ & hỗ trợ mong muốn"
                rows={[
                  ["Buyer/kênh hiện có tại Mỹ", usSalesChannelLabel],
                  ["Ghi chú kênh bán", form.usSalesChannelNotes || "—"],
                  ["Nhu cầu hỗ trợ", supportNeedsSummary],
                  ["Nhu cầu khác", form.veximSupportOther || "—"],
                ]}
              />
              <ReviewSection
                title="Năng lực & chứng nhận"
                rows={[
                  [
                    "USP",
                    form.uspPoints
                      .filter((p) => p.title)
                      .map((p) => p.title)
                      .join("; ") || "—",
                  ],
                  ["Chứng nhận", form.certifications.join(", ") || "—"],
                  ["Ảnh chứng nhận", form.certificationImageUrls ? `${form.certificationImageUrls.split(",").filter(Boolean).length} ảnh` : "—"],
                ]}
              />
              <ReviewSection
                title="Đánh giá năng lực nhà máy"
                rows={[
                  [
                    "Hệ thống quản lý chất lượng",
                    form.assessment.quality_systems.map((s) => ASSESSMENT_LABELS[s] ?? s).join(", ") ||
                      "—",
                  ],
                  [
                    "OEM/ODM",
                    form.assessment.oem_odm.map((s) => ASSESSMENT_LABELS[s] ?? s).join(", ") || "—",
                  ],
                  [
                    "Thị trường xuất khẩu",
                    form.assessment.export_markets
                      .map((s) => ASSESSMENT_LABELS[s] ?? s)
                      .join(", ") || "—",
                  ],
                  [
                    "Truy xuất nguồn gốc",
                    form.assessment.traceability.map((s) => ASSESSMENT_LABELS[s] ?? s).join(", ") ||
                      "—",
                  ],
                  [
                    "Sẵn sàng Buyer Audit",
                    form.assessment.audit_readiness
                      .map((s) => ASSESSMENT_LABELS[s] ?? s)
                      .join(", ") || "—",
                  ],
                  [
                    "Incoterms",
                    form.assessment.incoterms.map((s) => ASSESSMENT_LABELS[s] ?? s).join(", ") ||
                      "—",
                  ],
                  [
                    "Cam kết",
                    form.assessment.commitments.map((s) => ASSESSMENT_LABELS[s] ?? s).join(", ") ||
                      "—",
                  ],
                ]}
              />
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="text-pretty">{error}</span>
                </div>
              )}
            </div>
          )}

          

{step !== 3 && error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="text-pretty">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={step === 0 || isPending}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Quay lại
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} className="gap-1.5">
                Tiếp tục
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gửi hồ sơ
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewSection({
  title,
  rows,
}: {
  title: string
  rows: [string, string][]
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <dl className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap text-pretty text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
