"use client"

import { useMemo, useState, useTransition } from "react"
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Loader2,
  Plus,
  Star,
  Trash2,
  User,
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
import { submitClientIntake } from "@/app/client-intake/[token]/actions"

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
}

const STEPS = [
  { key: "contact", label: "Liên hệ & đăng ký", icon: User },
  { key: "company", label: "Giới thiệu doanh nghiệp", icon: Building2 },
  { key: "capability", label: "Năng lực & chứng nhận", icon: FileCheck2 },
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
    certifications: initial.certifications ?? [],
    certificationsOther: initial.certifications_other ?? "",
  })

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
      case "link_expired":
        return "Liên kết đã hết hạn hoặc đã được gửi trước đó."
      default:
        return "Có lỗi xảy ra, vui lòng thử lại."
    }
  }

  function goNext() {
    if (step === 0 && !step1Valid) {
      setError(
        "Vui lòng điền đầy đủ các trường bắt buộc (*) trước khi tiếp tục.",
      )
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleSubmit() {
    setError(null)
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
            {initial.ae_full_name ?? "Nhân viên kinh doanh"} sẽ xem xét thông
            tin bạn cung cấp và liên hệ lại trong thời gian sớm nhất.
          </p>
        </CardContent>
      </Card>
    )
  }

  const primary = form.industries[0]
  const current = STEPS[step]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-balance text-foreground">
          Hồ sơ đăng ký nhà cung cấp
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Vui lòng cung cấp thông tin doanh nghiệp để{" "}
          {initial.ae_full_name ?? "nhân viên kinh doanh"} xem xét và tạo tài
          khoản quản lý xuất khẩu cho bạn.
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
            {step === 0 &&
              "5 thông tin bắt buộc để nhân viên kinh doanh tạo tài khoản cho bạn."}
            {step === 1 && "Giúp buyer hiểu rõ hơn về doanh nghiệp của bạn."}
            {step === 2 &&
              "Điểm mạnh, chứng nhận và hình ảnh nhà máy — có thể bổ sung sau."}
            {step === 3 && "Kiểm tra lại thông tin trước khi gửi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {step === 0 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="companyName">
                  Tên doanh nghiệp <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  placeholder="Công ty TNHH Xuất khẩu ABC"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contactName">
                    Người liên hệ <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">
                    Số điện thoại <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+84 90 123 4567"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="lienhe@congty.com"
                />
                <p className="text-xs text-muted-foreground">
                  Email này sẽ dùng để đăng nhập vào hệ thống Vexim Trade sau
                  khi hồ sơ được duyệt.
                </p>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 block text-sm font-medium">
                  Ngành nghề <span className="text-destructive">*</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (chọn một hoặc nhiều)
                  </span>
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {INDUSTRIES.map((ind) => {
                    const checked = form.industries.includes(ind)
                    const isPrimary = primary === ind
                    return (
                      <button
                        key={ind}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleIndustry(ind)}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          checked
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background",
                          )}
                          aria-hidden="true"
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="flex flex-1 flex-col gap-0.5 leading-tight">
                          <span className="font-medium text-foreground">{ind}</span>
                          <span className="text-xs text-muted-foreground">
                            {INDUSTRY_LABELS_VI[ind]}
                          </span>
                        </span>
                        {isPrimary && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Star className="h-2.5 w-2.5 fill-primary" />
                            Chính
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {form.industries.length > 1 && (
                  <div className="mt-1 rounded-md border border-dashed border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Nhấn ngôi sao để đặt ngành chính
                    </p>
                    <ol className="flex flex-wrap gap-2">
                      {form.industries.map((ind, idx) => (
                        <li
                          key={ind}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                            idx === 0
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-foreground",
                          )}
                        >
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => promoteToPrimary(ind)}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Star className="h-3 w-3" />
                            </button>
                          )}
                          {idx === 0 && (
                            <Star className="h-3 w-3 fill-primary text-primary" />
                          )}
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="country">Quốc gia</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                    placeholder="Vietnam"
                    list="intake-country-suggestions"
                  />
                  <datalist id="intake-country-suggestions">
                    {COUNTRY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="taxCode">Mã số thuế</Label>
                  <Input
                    id="taxCode"
                    value={form.taxCode}
                    onChange={(e) => update("taxCode", e.target.value)}
                    placeholder="0312345678"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Số 1, Đường ABC, Quận/Huyện, Tỉnh/Thành phố"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://congty.com"
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
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
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="logoUrl">URL logo</Label>
                  <Input
                    id="logoUrl"
                    value={form.logoUrl}
                    onChange={(e) => update("logoUrl", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="coverImageUrl">URL ảnh bìa</Label>
                  <Input
                    id="coverImageUrl"
                    value={form.coverImageUrl}
                    onChange={(e) => update("coverImageUrl", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="factoryImageUrls">Ảnh nhà máy / sản phẩm</Label>
                <Input
                  id="factoryImageUrls"
                  value={form.factoryImageUrls}
                  onChange={(e) => update("factoryImageUrls", e.target.value)}
                  placeholder="Dán nhiều URL, ngăn cách bởi dấu phẩy"
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
            <dd className="text-pretty text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
