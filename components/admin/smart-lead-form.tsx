"use client"

/**
 * Lead Researcher Buyer Entry Form — auto-matching via AI.
 *
 * Flow (simplified):
 *   1. LR fills buyer details (company, contact, website…).
 *   2. LR optionally specifies buyer needs (industry, product, capacity).
 *   3. Submit → creates lead + calls runMatchingPipeline(leadId).
 *   4. AI matches the buyer to best AE, pushes to ae_match_inbox.
 *
 * The old "LR picks client" step is gone — AI handles the assignment now.
 * This ensures consistent, data-driven matching instead of guesswork.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import { assessCountryRisk } from "@/lib/risk/country-risk"
import { INDUSTRIES, INDUSTRY_LABELS_VI } from "@/lib/constants/industries"
import { sendBuyerInquiryReceivedEmailAction } from "@/app/admin/leads/new/buyer-email-actions"
import { createLeadWithAIMatchingAction } from "@/app/admin/leads/new/actions"

export function SmartLeadForm() {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale } = useTranslation()

  // ── Buyer details ─────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [country, setCountry] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")

  // ── Buyer needs (optional) ───────────────────────────────────────────
  const [needsIndustry, setNeedsIndustry] = useState<string>("")
  const [needsProduct, setNeedsProduct] = useState<string>("")
  const [needsCapacity, setNeedsCapacity] = useState<string>("")
  const [potentialValue, setPotentialValue] = useState("")

  // ── Submit state ──────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const riskAssessment = country.trim() ? assessCountryRisk(country) : null
  const isCompanyNameMissing = !companyName.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isCompanyNameMissing) return

    setError(null)
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not authenticated")
      setSubmitting(false)
      return
    }

    // Call server action to create lead + trigger AI matching.
    const result = await createLeadWithAIMatchingAction({
      companyName,
      contactPerson: contactPerson || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      linkedinUrl: linkedinUrl || null,
      country: country.trim() || null,
      website: website || null,
      notes: notes || null,
      industry: needsIndustry || null,
      productKeyword: needsProduct || null,
      capacityNeeded: needsCapacity ? Number.parseFloat(needsCapacity) : null,
      potentialValue: potentialValue ? Number.parseFloat(potentialValue) : null,
    })

    if (!result.success) {
      setError(result.error ?? "Failed to create buyer")
      setSubmitting(false)
      return
    }

    // Send buyer inquiry acknowledgement email (fire-and-forget).
    if (contactEmail.trim()) {
      try {
        await sendBuyerInquiryReceivedEmailAction(result.leadId!)
      } catch (err) {
        console.error("[v0] sendBuyerInquiryReceivedEmailAction failed", err)
      }
    }

    setSuccess(true)
    setTimeout(() => router.push("/admin/buyers"), 1500)
  }

  if (success) {
    return (
      <Card className="border-border">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-chart-4/10">
            <CheckCircle2 className="h-7 w-7 text-chart-4" />
          </div>
          <p className="text-base font-medium text-foreground">
            {locale === "vi"
              ? "Buyer được thêm thành công! Hệ thống AI đang phân tích…"
              : "Buyer added successfully! AI is analyzing…"}
          </p>
          <p className="text-sm text-muted-foreground">
            {locale === "vi"
              ? "Sẽ chuyển hướng về danh sách buyer"
              : "Redirecting to buyer list"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {locale === "vi" ? "Thêm Buyer Mới" : "Add New Buyer"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Error message */}
            {error && (
              <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
                <div className="text-sm text-destructive">{error}</div>
              </div>
            )}

            {/* Section 1: Buyer Details */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">
                  {locale === "vi" ? "Thông tin Buyer" : "Buyer Information"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {locale === "vi"
                    ? "Những thông tin cơ bản về buyer"
                    : "Basic details about the buyer"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Company name (required) */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    {locale === "vi" ? "Tên công ty *" : "Company Name *"}
                  </Label>
                  <Input
                    id="companyName"
                    placeholder={
                      locale === "vi" ? "VD: Pacific Grocers Inc." : "E.g. Pacific Grocers Inc."
                    }
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={cn(
                      "border-border",
                      isCompanyNameMissing &&
                        "border-destructive bg-destructive/5",
                    )}
                  />
                  {isCompanyNameMissing && (
                    <p className="text-xs text-destructive">
                      {locale === "vi"
                        ? "Tên công ty không được để trống"
                        : "Company name is required"}
                    </p>
                  )}
                </div>

                {/* Contact person */}
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">
                    {locale === "vi" ? "Người liên hệ" : "Contact Person"}
                  </Label>
                  <Input
                    id="contactPerson"
                    placeholder={locale === "vi" ? "VD: Sarah Chen" : "E.g. Sarah Chen"}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">
                    {locale === "vi" ? "Email" : "Email"}
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="buyer@company.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">
                    {locale === "vi" ? "Số điện thoại" : "Phone"}
                  </Label>
                  <Input
                    id="contactPhone"
                    placeholder="+1 (555) 000-0000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country">
                    {locale === "vi" ? "Quốc gia" : "Country"}
                  </Label>
                  <Input
                    id="country"
                    placeholder={locale === "vi" ? "VD: United States" : "E.g. United States"}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="border-border"
                  />
                  {riskAssessment && (
                    <div className="flex items-start gap-2 rounded-sm bg-muted p-2 text-xs">
                      <div
                        className={cn(
                          "mt-0.5 h-2 w-2 rounded-full flex-shrink-0",
                          riskAssessment.riskLevel === "high"
                            ? "bg-destructive"
                            : riskAssessment.riskLevel === "medium"
                              ? "bg-warning"
                              : "bg-chart-2",
                        )}
                      />
                      <span className="text-muted-foreground">
                        {riskAssessment.recommendation}
                      </span>
                    </div>
                  )}
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <Label htmlFor="website">
                    {locale === "vi" ? "Website" : "Website"}
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://..."
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* LinkedIn URL */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="linkedinUrl">
                    {locale === "vi" ? "LinkedIn URL" : "LinkedIn URL"}
                  </Label>
                  <Input
                    id="linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">
                    {locale === "vi" ? "Ghi chú" : "Notes"}
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder={
                      locale === "vi"
                        ? "Ghi chú thêm về buyer…"
                        : "Additional notes about the buyer…"
                    }
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="resize-none border-border"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Buyer Needs (Optional) */}
            <div className="space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="font-medium">
                  {locale === "vi"
                    ? "Nhu cầu Buyer (Tùy chọn)"
                    : "Buyer Needs (Optional)"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {locale === "vi"
                    ? "Giúp hệ thống AI phân tích tốt hơn"
                    : "Helps AI matching analyze better"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Industry */}
                <div className="space-y-2">
                  <Label htmlFor="industry">
                    {locale === "vi" ? "Ngành hàng" : "Industry"}
                  </Label>
                  <Select value={needsIndustry} onValueChange={setNeedsIndustry}>
                    <SelectTrigger id="industry" className="border-border">
                      <SelectValue
                        placeholder={
                          locale === "vi" ? "Chọn ngành…" : "Select industry…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {locale === "vi"
                            ? INDUSTRY_LABELS_VI[ind] ?? ind
                            : ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product */}
                <div className="space-y-2">
                  <Label htmlFor="product">
                    {locale === "vi" ? "Sản phẩm cần" : "Product Needed"}
                  </Label>
                  <Input
                    id="product"
                    placeholder={locale === "vi" ? "VD: Arabica coffee" : "E.g. Arabica coffee"}
                    value={needsProduct}
                    onChange={(e) => setNeedsProduct(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* Capacity */}
                <div className="space-y-2">
                  <Label htmlFor="capacity">
                    {locale === "vi" ? "Công suất cần (tấn/tháng)" : "Capacity Needed (MT/month)"}
                  </Label>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="500"
                    value={needsCapacity}
                    onChange={(e) => setNeedsCapacity(e.target.value)}
                    className="border-border"
                  />
                </div>

                {/* Potential value */}
                <div className="space-y-2">
                  <Label htmlFor="potentialValue">
                    {locale === "vi" ? "Giá trị tiềm năng (USD)" : "Potential Value (USD)"}
                  </Label>
                  <Input
                    id="potentialValue"
                    type="number"
                    placeholder="50000"
                    value={potentialValue}
                    onChange={(e) => setPotentialValue(e.target.value)}
                    className="border-border"
                  />
                </div>
              </div>
            </div>

            {/* Submit button */}
            <div className="flex justify-end gap-3 border-t border-border pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
              >
                {locale === "vi" ? "Hủy" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={isCompanyNameMissing || submitting}
                className="gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {locale === "vi" ? "Thêm Buyer" : "Add Buyer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">
                {locale === "vi" ? "Cách hoạt động" : "How it works"}
              </p>
              <p>
                {locale === "vi"
                  ? "Sau khi bạn thêm buyer, hệ thống AI sẽ tự động phân tích thông tin và gán cho Account Executive phù hợp nhất dựa trên chuyên môn, khối lượng công việc, và tỉ lệ thắng của họ. Buyer sẽ xuất hiện trong Inbox của AE được chọn."
                  : "Once you add a buyer, the AI system will automatically analyze the information and assign it to the best Account Executive based on their expertise, workload, and win rate. The buyer will appear in the assigned AE's Inbox."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
