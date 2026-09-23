"use client"

import { FormEvent, useState } from "react"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  locale: "vi" | "en"
}

export function BuyerRfqForm({ locale }: Props) {
  const vi = locale === "vi"
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      ...Object.fromEntries(formData.entries()),
      ...collectAttribution(locale),
    }

    try {
      const response = await fetch("/api/sourcing-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string; reference?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || (vi ? "Vui lòng kiểm tra lại thông tin." : "Please check your information and try again."))
      }
      setReference(result.reference ?? "")
      setSubmitted(true)
      form.reset()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : (vi ? "Không thể gửi yêu cầu." : "Could not send your request."))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="mt-5 text-xl font-semibold text-primary">
          {vi ? "Đã nhận yêu cầu sourcing" : "Sourcing request received"}
        </h3>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          {vi
            ? "Cảm ơn bạn. Đội ngũ Vexim sẽ xem xét yêu cầu và gửi các lựa chọn nhà cung cấp đã sàng lọc trong thời gian sớm nhất, thường trong vòng 48 giờ làm việc tùy danh mục."
            : "Thank you. Our team will review your request and share initial screened supplier options as soon as possible, typically within 48 business hours depending on category and specs."}
        </p>
        {reference && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-accent/30 bg-card px-3 py-1.5 font-mono text-xs text-foreground">
            <span className="text-muted-foreground">{vi ? "Mã yêu cầu" : "Request ID"}</span>
            {reference}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={vi ? "Sản phẩm bạn cần" : "Product needed"} name="product" required placeholder={vi ? "VD: Dầu gội 300ml, chai PET" : "e.g. Shampoo 300ml, PET bottle"} />
        <Field label={vi ? "Số lượng / Quy mô" : "Quantity / Volume"} name="quantity" required placeholder={vi ? "VD: 20,000 chai / tháng" : "e.g. 20,000 units / month"} />
        <Field label="Email" name="email" type="email" required />
        <Field label={vi ? "Công ty" : "Company"} name="company" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={vi ? "Mức giá mục tiêu (không bắt buộc)" : "Target price range (optional)"}
          name="targetPrice"
          placeholder={vi ? "VD: $0.80 - $1.20 / unit - để trống nếu chưa rõ" : "e.g. $0.80 - $1.20 / unit - leave blank if unsure"}
        />
        <Field label={vi ? "Thời gian dự kiến" : "Timeline"} name="timeline" placeholder={vi ? "VD: Cần mẫu trong 2 tuần" : "e.g. Need samples in 2 weeks"} />
      </div>

      <label className="block space-y-1.5 text-sm font-medium text-primary">
        <span>{vi ? "Yêu cầu kỹ thuật / Link sản phẩm" : "Specs, packaging, or product link"}</span>
        <textarea
          name="specs"
          rows={4}
          placeholder={
            vi
              ? "Mô tả quy cách, dung tích, chứng chỉ cần thiết (FDA, MoCRA, ISO...), link tham khảo..."
              : "Describe specs, volume, required certifications (FDA, MoCRA, ISO...), reference links..."
          }
          className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary">U.S. REGULATORY NEEDS</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-primary">
            <input type="checkbox" name="needFda" value="yes" className="h-4 w-4 rounded border-input" />
            {vi ? "Cần kiểm tra FDA Food Facility" : "FDA Food Facility check needed"}
          </label>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input type="checkbox" name="needMocra" value="yes" className="h-4 w-4 rounded border-input" />
            {vi ? "Cần hỗ trợ MoCRA (mỹ phẩm)" : "MoCRA registration/listing review"}
          </label>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input type="checkbox" name="needCgmps" value="yes" className="h-4 w-4 rounded border-input" />
            {vi ? "Cần cGMP / ISO" : "cGMP / ISO documentation"}
          </label>
          <label className="flex items-center gap-2 text-sm text-primary">
            <input type="checkbox" name="needQc" value="yes" className="h-4 w-4 rounded border-input" />
            {vi ? "Cần hỗ trợ QC" : "QC / pre-shipment inspection"}
          </label>
        </div>
      </div>

      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full bg-cta text-cta-foreground hover:bg-cta/90 text-[15px]">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting
          ? vi
            ? "Đang gửi..."
            : "Sending..."
          : vi
            ? "Nhận danh sách NCC đã sàng lọc"
            : "Get My Factory Matches in 48 Hours*"}
      </Button>
      <p className="text-center text-[11px] leading-5 text-muted-foreground">
        {vi
          ? "*Thời gian phụ thuộc danh mục, thông số và tình trạng NCC. Không có phí sourcing upfront cho buyer. Thông tin được bảo mật."
          : "*Timing depends on category, specs and supplier availability. No upfront sourcing fee for buyers. Your information stays confidential."}
      </p>
    </form>
  )
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-primary">
      <span>
        {label}
        {required && <span className="ml-1 text-cta">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </label>
  )
}

function collectAttribution(locale: "vi" | "en"): Record<string, string> {
  const out: Record<string, string> = { locale }
  if (typeof window === "undefined") return out

  out.pagePath = `${window.location.pathname}${window.location.hash}`.slice(0, 200)
  if (document.referrer) out.referrer = document.referrer.slice(0, 300)

  const params = new URLSearchParams(window.location.search)
  const campaignFields: Array<[string, string]> = [
    ["utm_source", "utmSource"],
    ["utm_medium", "utmMedium"],
    ["utm_campaign", "utmCampaign"],
    ["utm_content", "utmContent"],
    ["utm_term", "utmTerm"],
    ["gclid", "gclid"],
  ]
  for (const [param, field] of campaignFields) {
    const value = params.get(param)?.trim()
    if (value) out[field] = value.slice(0, 200)
  }
  return out
}
