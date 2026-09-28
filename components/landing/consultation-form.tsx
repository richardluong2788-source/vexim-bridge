"use client"

import { FormEvent, useState } from "react"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { INDUSTRIES } from "@/lib/constants/industries"

export function ConsultationForm({ locale }: { locale: "vi" | "en" }) {
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
    // Hidden attribution fields (marketing_leads, migration 082): which page,
    // which campaign, which language. Sent as ordinary fields so the API stays
    // a plain JSON endpoint — no headers, no extra round trip.
    const payload = { ...Object.fromEntries(formData.entries()), ...collectAttribution(locale) }

    try {
      const response = await fetch("/api/consultation", {
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
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary"><CheckCircle2 className="h-7 w-7" /></span>
        <h3 className="mt-5 text-xl font-semibold text-primary">{vi ? "Đã nhận thông tin" : "Request received"}</h3>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          {vi ? "Đội ngũ Vexim sẽ liên hệ lại trong 2–4 giờ làm việc để trao đổi về mức độ phù hợp." : "A Vexim specialist will contact you within 2–4 business hours to discuss fit and next steps."}
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={vi ? "Họ và tên" : "Full name"} name="fullName" required />
        <Field label={vi ? "Công ty / Nhà máy" : "Company / Factory"} name="company" required />
        <Field label="Email" name="email" type="email" required />
        <Field label={vi ? "Số điện thoại / Zalo" : "Phone / WhatsApp"} name="phone" required />
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-primary">
        <span>{vi ? "Ngành hàng sản xuất" : "Manufacturing category"}</span>
        <select name="industry" required defaultValue="" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30">
          <option value="" disabled>{vi ? "Chọn ngành hàng" : "Select a category"}</option>
          {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-primary">
        <span>{vi ? "Bạn muốn Vexim hỗ trợ điều gì?" : "What would you like Vexim to help with?"}</span>
        <textarea name="message" rows={4} placeholder={vi ? "Sản phẩm chủ lực, công suất tháng, thị trường mục tiêu hoặc nhu cầu cụ thể..." : "Key products, monthly capacity, target market or a specific question..."} className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30" />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting} className="h-11 w-full bg-cta text-cta-foreground hover:bg-cta/90">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? (vi ? "Đang gửi..." : "Sending...") : (vi ? "Đăng ký tư vấn 1:1" : "Request a 1:1 consultation")}
      </Button>
      <p className="text-center text-[11px] leading-5 text-muted-foreground">{vi ? "Bảo mật 100% dữ liệu sản phẩm và thông tin nhà máy." : "Your factory and product information stays confidential."}</p>
    </form>
  )
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-primary">
      <span>{label}{required && <span className="ml-1 text-cta">*</span>}</span>
      <input name={name} type={type} required={required} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30" />
    </label>
  )
}

/**
 * UTM + submission context stored on marketing_leads, so "kênh nào ra lead"
 * becomes a SQL query instead of a guess. Read at submit time (not render time)
 * so the values stay correct after in-page navigation, and every field is
 * optional — an older cached bundle simply sends less attribution, never breaks.
 */
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
