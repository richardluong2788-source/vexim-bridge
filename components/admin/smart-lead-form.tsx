"use client"

/**
 * Smart Lead Form — buyer-needs-first lead assignment.
 *
 * Flow:
 *   1. Admin describes what the buyer needs (industry, product, capacity).
 *   2. Server returns ranked client suggestions (best / possible / override).
 *   3. Admin picks a client — override requires a written reason.
 *   4. Admin completes the buyer details and submits.
 *
 * Replaces the old "pick client from dropdown" flow. The underlying DB
 * writes (leads, opportunities, activities, notifyLeadAssigned) are
 * unchanged so the rest of the pipeline keeps working without migration.
 */

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CircleDot,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import { notifyLeadAssigned } from "@/app/admin/opportunities/actions"
import { assessCountryRisk } from "@/lib/risk/country-risk"
import {
  INDUSTRIES,
  INDUSTRY_LABELS_VI,
} from "@/lib/constants/industries"
import {
  suggestClientsForLeadAction,
  type ClientSuggestion,
  type MatchLevel,
} from "@/app/admin/leads/new/actions"

export function SmartLeadForm() {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale } = useTranslation()

  // ── Step 1: Buyer needs ────────────────────────────────────────────────
  const [needsIndustry, setNeedsIndustry] = useState<string>("")
  const [needsProduct, setNeedsProduct] = useState<string>("")
  const [needsCapacity, setNeedsCapacity] = useState<string>("")

  // ── Step 2: Suggestions + selection ───────────────────────────────────
  const [suggestions, setSuggestions] = useState<ClientSuggestion[] | null>(null)
  const [isFinding, startFinding] = useTransition()
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [overrideReason, setOverrideReason] = useState<string>("")

  // ── Step 3: Buyer details ─────────────────────────────────────────────
  const [companyName, setCompanyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [country, setCountry] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")
  const [potentialValue, setPotentialValue] = useState("")

  // ── Submit state ──────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedSuggestion = useMemo(
    () => suggestions?.find((s) => s.client_id === selectedClientId) ?? null,
    [suggestions, selectedClientId],
  )

  const isOverride = selectedSuggestion?.level === "override"
  const overrideReasonMissing = isOverride && overrideReason.trim().length < 5

  const riskAssessment = country.trim() ? assessCountryRisk(country) : null

  async function handleFindClients() {
    setError(null)
    setSelectedClientId("")
    setOverrideReason("")
    startFinding(async () => {
      const result = await suggestClientsForLeadAction({
        industry: needsIndustry || null,
        productKeyword: needsProduct || null,
        capacityNeeded: needsCapacity ? Number.parseFloat(needsCapacity) : null,
      })
      if (!result.success) {
        setError(result.error ?? "Failed to load suggestions")
        setSuggestions([])
        return
      }
      setSuggestions(result.data)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSuggestion) return
    if (overrideReasonMissing) return

    setError(null)
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Prepend the override reason (if any) to notes so it survives in the
    // lead record even before the activity log is queried.
    const finalNotes = isOverride
      ? `[${locale === "vi" ? "Override" : "Manual override"}] ${overrideReason.trim()}\n\n${notes}`.trim()
      : notes || null

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        company_name: companyName,
        contact_person: contactPerson || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        linkedin_url: linkedinUrl || null,
        industry: needsIndustry || null,
        country: country.trim() || null,
        website: website || null,
        notes: finalNotes,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (leadError || !lead) {
      setError(leadError?.message ?? "Failed to create lead")
      setSubmitting(false)
      return
    }

    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .insert({
        client_id: selectedSuggestion.client_id,
        lead_id: lead.id,
        stage: "new",
        potential_value: potentialValue ? Number.parseFloat(potentialValue) : null,
      })
      .select()
      .single()

    if (oppError || !opp) {
      setError(oppError?.message ?? "Failed to create opportunity")
      setSubmitting(false)
      return
    }

    // Build a rich audit description capturing the match decision.
    const clientLabel =
      selectedSuggestion.company_name ??
      selectedSuggestion.full_name ??
      "client"
    const levelLabel =
      selectedSuggestion.level === "best"
        ? "Best Match"
        : selectedSuggestion.level === "possible"
          ? "Possible"
          : "Override"
    const matchDescription = `${lead.company_name} → ${clientLabel} [${levelLabel}]${
      needsProduct ? ` · asked for "${needsProduct}"` : ""
    }${
      needsCapacity ? ` · ${needsCapacity} units/month` : ""
    }`

    await supabase.from("activities").insert([
      {
        opportunity_id: opp.id,
        action_type: "lead_created",
        description: lead.company_name,
        performed_by: user?.id ?? null,
      },
      {
        opportunity_id: opp.id,
        action_type: "opportunity_created",
        description: matchDescription,
        performed_by: user?.id ?? null,
      },
      ...(isOverride
        ? [
            {
              opportunity_id: opp.id,
              action_type: "lead_assignment_overridden",
              description: `Override reason: ${overrideReason.trim()}`,
              performed_by: user?.id ?? null,
            },
          ]
        : []),
    ])

    try {
      await notifyLeadAssigned(opp.id)
    } catch (err) {
      console.error("[v0] notifyLeadAssigned failed", err)
    }

    setSuccess(true)
    setTimeout(() => router.push("/admin/pipeline"), 1500)
  }

  if (success) {
    return (
      <Card className="border-border">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-chart-4/10">
            <CheckCircle2 className="h-7 w-7 text-chart-4" />
          </div>
          <p className="text-base font-medium text-foreground">
            {t.admin.addLead.success}
          </p>
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        </CardContent>
      </Card>
    )
  }

  const canFind = Boolean(needsIndustry || needsProduct.trim())
  const canSubmit =
    !!selectedSuggestion &&
    !!companyName.trim() &&
    !overrideReasonMissing &&
    !submitting

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* ─── Step 1: Buyer needs ─────────────────────────────────────── */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              1
            </span>
            <CardTitle className="text-base font-semibold">
              {locale === "vi" ? "Nhu cầu của Buyer" : "Buyer's needs"}
            </CardTitle>
          </div>
          <p className="ml-8 text-xs text-muted-foreground mt-1">
            {locale === "vi"
              ? "Nhập thông tin buyer cần mua — hệ thống sẽ gợi ý client phù hợp từ danh mục sản phẩm đã đăng ký."
              : "Describe what the buyer is asking for — we'll match against registered client products."}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="needsIndustry">
                {locale === "vi" ? "Ngành hàng" : "Industry"}
              </Label>
              <Select value={needsIndustry} onValueChange={setNeedsIndustry}>
                <SelectTrigger id="needsIndustry">
                  <SelectValue
                    placeholder={
                      locale === "vi" ? "Chọn ngành hàng" : "Select industry"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {locale === "vi"
                        ? `${ind} · ${INDUSTRY_LABELS_VI[ind]}`
                        : ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="needsProduct">
                {locale === "vi"
                  ? "Sản phẩm buyer cần"
                  : "Product the buyer wants"}
              </Label>
              <Input
                id="needsProduct"
                placeholder={
                  locale === "vi" ? "VD: Arabica, cashew W320" : "e.g. Arabica, cashew W320"
                }
                value={needsProduct}
                onChange={(e) => setNeedsProduct(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="needsCapacity">
                {locale === "vi"
                  ? "Công suất cần (/tháng)"
                  : "Capacity needed (/month)"}
              </Label>
              <Input
                id="needsCapacity"
                type="number"
                min="0"
                placeholder="VD: 500"
                value={needsCapacity}
                onChange={(e) => setNeedsCapacity(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleFindClients}
              disabled={!canFind || isFinding}
              className="bg-primary text-primary-foreground"
            >
              {isFinding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {locale === "vi" ? "Đang tìm..." : "Searching..."}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {locale === "vi"
                    ? "Tìm Client phù hợp"
                    : "Find matching clients"}
                </>
              )}
            </Button>
            {!canFind && (
              <p className="text-xs text-muted-foreground">
                {locale === "vi"
                  ? "Chọn ngành hàng hoặc nhập sản phẩm để bắt đầu"
                  : "Pick an industry or enter a product to start"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Step 2: Suggested clients ───────────────────────────────── */}
      {suggestions !== null && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <CardTitle className="text-base font-semibold">
                {locale === "vi" ? "Client gợi ý" : "Suggested clients"}
              </CardTitle>
              {suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-auto font-normal">
                  {suggestions.length}{" "}
                  {locale === "vi" ? "client" : "clients"}
                </Badge>
              )}
            </div>
            <p className="ml-8 text-xs text-muted-foreground mt-1">
              {locale === "vi"
                ? "Chọn 1 client. Các mục 'Override' yêu cầu ghi lý do để audit."
                : "Pick one. 'Override' picks require a written reason for the audit trail."}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {suggestions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {locale === "vi"
                    ? "Chưa có client nào trong hệ thống"
                    : "No clients found in the system"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === "vi"
                    ? "Tạo client mới trước khi gán lead."
                    : "Create a client first before assigning leads."}
                </p>
              </div>
            ) : (
              suggestions.map((s) => (
                <SuggestionCard
                  key={s.client_id}
                  suggestion={s}
                  selected={selectedClientId === s.client_id}
                  onSelect={() => setSelectedClientId(s.client_id)}
                  locale={locale}
                />
              ))
            )}

            {isOverride && (
              <div className="flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <Label
                  htmlFor="overrideReason"
                  className="text-sm font-medium text-destructive"
                >
                  {locale === "vi"
                    ? "Lý do override (bắt buộc)"
                    : "Override reason (required)"}
                </Label>
                <p className="text-xs text-destructive/80">
                  {locale === "vi"
                    ? "Mô tả ngắn gọn vì sao vẫn gán client này dù không phải match tốt nhất. Sẽ được lưu vào activity log."
                    : "Explain briefly why you're overriding the best match. This is saved to the activity log."}
                </p>
                <Textarea
                  id="overrideReason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={
                    locale === "vi"
                      ? "VD: Client đang gia hạn FDA, buyer đồng ý chờ..."
                      : "e.g. Client is renewing FDA, buyer agreed to wait..."
                  }
                  rows={3}
                  className="resize-none bg-background"
                />
                {overrideReasonMissing && overrideReason.length > 0 && (
                  <p className="text-xs text-destructive">
                    {locale === "vi"
                      ? "Tối thiểu 5 ký tự"
                      : "Minimum 5 characters"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Step 3: Buyer details ───────────────────────────────────── */}
      <Card
        className={cn(
          "border-border transition-opacity",
          !selectedSuggestion && "opacity-50 pointer-events-none",
        )}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              3
            </span>
            <CardTitle className="text-base font-semibold">
              {locale === "vi" ? "Thông tin Buyer" : "Buyer details"}
            </CardTitle>
          </div>
          <p className="ml-8 text-xs text-muted-foreground mt-1">
            {locale === "vi"
              ? "Điền thông tin buyer sau khi đã chọn client ở bước 2."
              : "Fill in the buyer's details once you've picked a client above."}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">
                {t.admin.addLead.companyName}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder={t.admin.addLead.companyNamePlaceholder}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">
                <Globe2 className="inline h-3.5 w-3.5 mr-1" />
                {t.admin.addLead.country}
              </Label>
              <Input
                id="country"
                placeholder={t.admin.addLead.countryPlaceholder}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                list="country-suggestions"
              />
              <datalist id="country-suggestions">
                {[
                  "United States",
                  "Canada",
                  "United Kingdom",
                  "Germany",
                  "France",
                  "Netherlands",
                  "Japan",
                  "South Korea",
                  "Australia",
                  "Singapore",
                  "United Arab Emirates",
                  "India",
                  "Pakistan",
                  "Nigeria",
                  "Mexico",
                  "Brazil",
                ].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPerson">
                {t.admin.addLead.contactPerson}
              </Label>
              <Input
                id="contactPerson"
                placeholder={t.admin.addLead.contactPersonPlaceholder}
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">{t.admin.addLead.email}</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder={t.admin.addLead.emailPlaceholder}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">{t.admin.addLead.phone}</Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder={t.admin.addLead.phonePlaceholder}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">{t.admin.addLead.website}</Label>
              <Input
                id="website"
                type="url"
                placeholder={t.admin.addLead.websitePlaceholder}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedinUrl">{t.admin.addLead.linkedin}</Label>
            <Input
              id="linkedinUrl"
              type="url"
              placeholder={t.admin.addLead.linkedinPlaceholder}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="potentialValue">
              {t.admin.addLead.potentialValue}
            </Label>
            <Input
              id="potentialValue"
              type="number"
              min="0"
              step="0.01"
              placeholder={t.admin.addLead.potentialValuePlaceholder}
              value={potentialValue}
              onChange={(e) => setPotentialValue(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t.admin.addLead.notes}</Label>
            <Textarea
              id="notes"
              placeholder={t.admin.addLead.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {riskAssessment && riskAssessment.level !== "low" && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4",
            riskAssessment.level === "high"
              ? "border-destructive/30 bg-destructive/10"
              : "border-chart-5/40 bg-chart-5/10",
          )}
        >
          <AlertTriangle
            className={cn(
              "h-5 w-5 shrink-0 mt-0.5",
              riskAssessment.level === "high"
                ? "text-destructive"
                : "text-chart-5",
            )}
          />
          <div className="flex flex-col gap-1">
            <p
              className={cn(
                "text-sm font-semibold",
                riskAssessment.level === "high"
                  ? "text-destructive"
                  : "text-chart-5",
              )}
            >
              {riskAssessment.level === "high"
                ? t.admin.addLead.riskHighTitle
                : t.admin.addLead.riskMediumTitle}
            </p>
            <ul
              className={cn(
                "text-sm list-disc pl-4 space-y-0.5",
                riskAssessment.level === "high"
                  ? "text-destructive/80"
                  : "text-chart-5/80",
              )}
            >
              {riskAssessment.reasons[locale].map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                riskAssessment.level === "high"
                  ? "text-destructive/80"
                  : "text-chart-5/80",
              )}
            >
              {t.admin.addLead.riskRecommended}:{" "}
              {riskAssessment.recommendedPayment[locale]}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/30">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.admin.addLead.submitting}
            </>
          ) : (
            t.admin.addLead.submit
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Suggestion card
// ─────────────────────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: ClientSuggestion
  selected: boolean
  onSelect: () => void
  locale: "vi" | "en"
}

function SuggestionCard({
  suggestion,
  selected,
  onSelect,
  locale,
}: SuggestionCardProps) {
  const levelStyles: Record<
    MatchLevel,
    { bg: string; border: string; text: string; label_vi: string; label_en: string; icon: React.ReactNode }
  > = {
    best: {
      bg: "bg-chart-4/10",
      border: "border-chart-4/40",
      text: "text-chart-4",
      label_vi: "Phù hợp nhất",
      label_en: "Best match",
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
    possible: {
      bg: "bg-chart-5/10",
      border: "border-chart-5/40",
      text: "text-chart-5",
      label_vi: "Có thể phù hợp",
      label_en: "Possible",
      icon: <CircleDot className="h-3.5 w-3.5" />,
    },
    override: {
      bg: "bg-destructive/10",
      border: "border-destructive/40",
      text: "text-destructive",
      label_vi: "Cần override",
      label_en: "Override required",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
    },
  }
  const style = levelStyles[suggestion.level]

  const displayName =
    suggestion.company_name ?? suggestion.full_name ?? suggestion.client_id

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border p-4 text-left transition-all",
        "hover:border-primary/60 hover:bg-muted/30",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-pretty">
              {displayName}
            </span>
            {suggestion.fda_status === "valid" && (
              <ShieldCheck className="h-4 w-4 text-chart-4 shrink-0" />
            )}
            {suggestion.fda_status === "expiring_soon" && (
              <ShieldAlert className="h-4 w-4 text-chart-5 shrink-0" />
            )}
            {(suggestion.fda_status === "expired" ||
              suggestion.fda_status === "missing") && (
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
            )}
          </div>
          {suggestion.industry && (
            <p className="text-xs text-muted-foreground">
              {suggestion.industry}
              {suggestion.product_count > 0 && (
                <>
                  {" · "}
                  {suggestion.product_count}{" "}
                  {locale === "vi" ? "sản phẩm" : "products"}
                </>
              )}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1 shrink-0 font-medium",
            style.bg,
            style.border,
            style.text,
          )}
        >
          {style.icon}
          {locale === "vi" ? style.label_vi : style.label_en}
        </Badge>
      </div>

      {/* Reasons */}
      <ul className="flex flex-col gap-1">
        {suggestion.reasons.map((r, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 text-xs",
              r.tone === "positive" && "text-chart-4",
              r.tone === "warning" && "text-chart-5",
              r.tone === "danger" && "text-destructive",
            )}
          >
            <span className="mt-0.5 text-[10px] leading-none">
              {r.tone === "positive" ? "✓" : r.tone === "warning" ? "!" : "✗"}
            </span>
            <span className="text-pretty">
              {locale === "vi" ? r.text_vi : r.text_en}
            </span>
          </li>
        ))}
      </ul>

      {/* Matching product chips */}
      {suggestion.matching_products.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
          {suggestion.matching_products.slice(0, 4).map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                {p.product_name}
              </span>
              {p.monthly_capacity_units !== null && (
                <span>
                  · {p.monthly_capacity_units} {p.unit_of_measure}/mo
                </span>
              )}
            </span>
          ))}
          {suggestion.matching_products.length > 4 && (
            <span className="text-[11px] text-muted-foreground">
              +{suggestion.matching_products.length - 4}{" "}
              {locale === "vi" ? "khác" : "more"}
            </span>
          )}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-1 text-xs font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {locale === "vi" ? "Đã chọn" : "Selected"}
          <ChevronRight className="ml-auto h-4 w-4 opacity-40" />
        </div>
      )}
    </button>
  )
}
