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

    // Collect checkboxes as array
    const complianceNeeds: string[] = []
    formData.getAll("compliance").forEach((v) => {
      if (typeof v === "string" && v) complianceNeeds.push(v)
    })

    // Build payload with compliance array + single values
    const payload: Record<string, string> = {
      ...Object.fromEntries(
        Array.from(formData.entries()).filter(([k]) => k !== "compliance"),
      ),
      compliance: complianceNeeds.join(", "),
      ...collectAttribution(locale),
    } as Record<string, string>

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
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-7">
      {/* YOUR SOURCING REQUEST */}
      <div>
        <p className="text-xs font-bold tracking-[0.16em] text-primary">
          {vi ? "YÊU CẦU SOURCING CỦA BẠN" : "YOUR SOURCING REQUEST"}
        </p>

        <div className="mt-4 space-y-4">
          {/* Product - required */}
          <Field
            label={vi ? "Sản phẩm bạn cần" : "Product needed"}
            name="product"
            required
            placeholder={vi ? "VD: Dầu gội 300ml, chai PET" : "e.g. Shampoo 300ml, PET bottle"}
          />

          {/* Specs / Link - optional, right after product per buyer mental model */}
          <label className="block space-y-1.5 text-sm font-medium text-primary">
            <span>{vi ? "Yêu cầu kỹ thuật / Link sản phẩm" : "Technical requirements / Product link"}</span>
            <textarea
              name="specs"
              rows={3}
              placeholder={
                vi
                  ? "Thông số sản phẩm, tiêu chuẩn mục tiêu, yêu cầu bao bì, sản phẩm tham khảo, link website..."
                  : "Product specifications, target standards, packaging requirements, reference product, website link..."
              }
              className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Quantity - required */}
            <Field
              label={vi ? "Số lượng / Quy mô" : "Quantity / Scale"}
              name="quantity"
              required
              placeholder={vi ? "VD: 20,000 chai / tháng" : "e.g. 20,000 units / month"}
            />

            {/* Timeline - select */}
            <label className="block space-y-1.5 text-sm font-medium text-primary">
              <span>{vi ? "Thời gian dự kiến" : "Timeline"}</span>
              <select
                name="timeline"
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="" disabled>
                  {vi ? "Chọn thời gian" : "Select timeline"}
                </option>
                <option value="asap">{vi ? "Càng sớm càng tốt" : "As soon as possible"}</option>
                <option value="1-3 months">{vi ? "1–3 tháng" : "1–3 months"}</option>
                <option value="3-6 months">{vi ? "3–6 tháng" : "3–6 months"}</option>
                <option value="6+ months">{vi ? "6+ tháng" : "6+ months"}</option>
                <option value="not_decided">{vi ? "Chưa quyết định" : "Not decided"}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Target Price - optional */}
            <Field
              label={vi ? "Mức giá mục tiêu (không bắt buộc)" : "Target price (optional)"}
              name="targetPrice"
              placeholder={vi ? "VD: $0.80 - $1.20 / unit - để trống nếu chưa rõ" : "e.g. $0.80 - $1.20 / unit - leave blank if unsure"}
            />
            {/* Company - required */}
            <Field label={vi ? "Công ty" : "Company"} name="company" required placeholder={vi ? "Tên công ty bạn" : "Your company name"} />
          </div>

          {/* Email - required */}
          <Field label="Email" name="email" type="email" required placeholder="you@company.com" />
        </div>
      </div>

      {/* COMPLIANCE & QUALITY REQUIREMENTS - 2 per row, 4 items */}
      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4">
        <p className="text-xs font-bold tracking-[0.14em] text-primary">
          {vi ? "YÊU CẦU TUÂN THỦ & CHẤT LƯỢNG" : "COMPLIANCE & QUALITY REQUIREMENTS"}
        </p>
        <p className="text-sm font-medium text-primary">
          {vi ? "Bạn muốn chúng tôi rà soát hoặc điều phối những gì? Chọn tất cả áp dụng." : "What would you like us to review or coordinate? Select all that apply."}
        </p>
        <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
          <Checkbox value="FDA check" label={vi ? "Kiểm tra FDA" : "FDA check"} />
          <Checkbox value="Pre-shipment inspection" label={vi ? "Kiểm tra trước khi giao hàng" : "Pre-shipment inspection"} />
          <Checkbox value="cGMP documentation review" label={vi ? "Rà soát tài liệu cGMP" : "cGMP documentation review"} />
          <Checkbox value="Product labeling review" label={vi ? "Rà soát nhãn sản phẩm" : "Product labeling review"} />
        </div>
      </div>

      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        <p className="text-[11px] leading-5 text-muted-foreground">
          {vi
            ? "Chúng tôi sử dụng thông tin này để xác định NCC phù hợp và đánh giá các yêu cầu tuân thủ liên quan. Chúng tôi không bán hoặc chia sẻ yêu cầu của bạn với bên thứ ba."
            : "We use this information to identify suitable suppliers and assess relevant compliance requirements. We do not sell or share your request with third parties."}
        </p>

        <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full bg-cta text-cta-foreground hover:bg-cta/90 text-[15px]">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting
            ? vi
              ? "Đang gửi..."
              : "Sending..."
            : vi
              ? "Nhận danh sách NCC ban đầu"
              : "Get My Initial Supplier Matches"}
        </Button>

        <p className="text-center text-[11px] leading-5 text-muted-foreground">
          {vi
            ? "Không có phí sourcing upfront cho buyer. Thông tin được bảo mật. Thời gian phản hồi phụ thuộc danh mục và thông số."
            : "No upfront sourcing fee for buyers. Your information stays confidential. Timing depends on category and specs."}
        </p>
      </div>
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

function Checkbox({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${highlight ? "border-accent/40 bg-accent/10 text-primary" : "border-transparent bg-card hover:bg-muted/50 text-primary"}`}>
      <input type="checkbox" name="compliance" value={value} className="mt-0.5 h-4 w-4 shrink-0 rounded border-input" />
      <span className="leading-5">{label}</span>
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
