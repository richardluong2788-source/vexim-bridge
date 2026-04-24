"use client"

import { useState } from "react"
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
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Globe2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import { notifyLeadAssigned } from "@/app/admin/opportunities/actions"
import { sendBuyerInquiryReceivedEmailAction } from "@/app/admin/leads/new/buyer-email-actions"
import { assessCountryRisk } from "@/lib/risk/country-risk"
import { INDUSTRIES, INDUSTRY_LABELS_VI } from "@/lib/constants/industries"

interface ClientOption {
  id: string
  full_name: string | null
  company_name: string | null
  industry: string | null
  fda_registration_number: string | null
  fda_expires_at: string | null
}

interface AddLeadFormProps {
  clients: ClientOption[]
}

export function AddLeadForm({ clients }: AddLeadFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const { t, locale } = useTranslation()

  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Lead fields
  const [companyName, setCompanyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [industry, setIndustry] = useState("")
  const [country, setCountry] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")
  const [potentialValue, setPotentialValue] = useState("")

  // Live risk assessment — surfaces medium/high-risk countries to the admin
  // before they commit the lead so they can brief the client early.
  const riskAssessment = country.trim() ? assessCountryRisk(country) : null

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const hasFdaNumber = !!selectedClient?.fda_registration_number
  // R-02 — FDA expiry is a HARD block. "No number" and "expired" are both
  // fatal; the UI refuses to submit and the matching DB trigger (migration
  // 013) refuses to INSERT the opportunity as defence-in-depth.
  const fdaExpiresAt = selectedClient?.fda_expires_at ?? null
  const isFdaExpired = (() => {
    if (!fdaExpiresAt) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(fdaExpiresAt) < today
  })()
  const isCompliant = hasFdaNumber && !isFdaExpired
  const isBlocked = Boolean(selectedClientId) && !isCompliant
  const blockReason: "missing" | "expired" | null = !selectedClientId
    ? null
    : !hasFdaNumber
      ? "missing"
      : isFdaExpired
        ? "expired"
        : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isBlocked) return
    setError(null)
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        company_name: companyName,
        contact_person: contactPerson || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        linkedin_url: linkedinUrl || null,
        industry: industry || null,
        country: country.trim() || null,
        website: website || null,
        notes: notes || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (leadError || !lead) {
      setError(leadError?.message ?? "Failed to create lead")
      setLoading(false)
      return
    }

    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .insert({
        client_id: selectedClientId,
        lead_id: lead.id,
        stage: "new",
        potential_value: potentialValue ? parseFloat(potentialValue) : null,
      })
      .select()
      .single()

    if (oppError || !opp) {
      setError(oppError?.message ?? "Failed to create opportunity")
      setLoading(false)
      return
    }

    // Audit trail (best-effort). Log two entries: one for lead creation,
    // one for the opportunity being assigned to a client.
    const clientLabel =
      selectedClient?.company_name ?? selectedClient?.full_name ?? "client"
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
        description: `${lead.company_name} → ${clientLabel}`,
        performed_by: user?.id ?? null,
      },
    ])

    // Fire the in-app + email notification to the assigned client. Failure
    // is silent so it never blocks the admin's success screen.
    try {
      await notifyLeadAssigned(opp.id)
    } catch (err) {
      console.error("[v0] notifyLeadAssigned failed", err)
    }

    // Send buyer the acknowledgement email. Non-throwing, fully logged
    // server-side — silent failure is OK here.
    if (contactEmail.trim()) {
      try {
        await sendBuyerInquiryReceivedEmailAction(lead.id)
      } catch (err) {
        console.error("[v0] sendBuyerInquiryReceivedEmailAction failed", err)
      }
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
          <p className="text-base font-medium text-foreground">{t.admin.addLead.success}</p>
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Client assignment */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">{t.admin.addLead.step1}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.addLead.step1Desc}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client">
              {t.admin.addLead.selectClient} <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder={t.admin.addLead.selectClientPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    {t.admin.addLead.noClients}
                  </div>
                ) : (
                  clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <span>{client.company_name ?? client.full_name ?? client.id}</span>
                        {client.fda_registration_number ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-chart-4" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Compliance block warning (missing OR expired FDA) */}
          {isBlocked && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-destructive">
                  {blockReason === "expired"
                    ? locale === "vi"
                      ? "FDA đã hết hạn — không thể tạo cơ hội mới"
                      : "FDA registration expired — cannot create new opportunity"
                    : t.admin.addLead.complianceBlockTitle}
                </p>
                <p className="text-sm text-destructive/80 text-pretty">
                  {blockReason === "expired"
                    ? locale === "vi"
                      ? `FDA của khách hàng đã hết hạn vào ngày ${fdaExpiresAt ? new Date(fdaExpiresAt).toLocaleDateString("vi-VN") : "—"}. Vui lòng yêu cầu khách hàng gia hạn FDA trước khi gán buyer mới.`
                      : `This client's FDA registration expired on ${fdaExpiresAt ? new Date(fdaExpiresAt).toLocaleDateString("en-US") : "—"}. Ask them to renew before assigning new buyers.`
                    : t.admin.addLead.complianceBlockDesc}
                </p>
                <p className="text-xs text-destructive/70 mt-1">
                  <strong>{selectedClient?.company_name ?? selectedClient?.full_name}</strong>
                </p>
              </div>
            </div>
          )}

          {isCompliant && selectedClient && (
            <div className="flex items-start gap-2 rounded-lg border border-chart-4/30 bg-chart-4/10 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-chart-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-chart-4">{t.admin.addLead.complianceOkTitle}</p>
                <p className="text-xs text-chart-4/80">
                  {t.admin.addLead.complianceOkDesc}{" "}
                  <span className="font-mono">{selectedClient.fda_registration_number}</span>
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="potentialValue">{t.admin.addLead.potentialValue}</Label>
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
        </CardContent>
      </Card>

      {/* Lead details */}
      <Card
        className={cn("border-border transition-opacity", isBlocked && "opacity-50 pointer-events-none")}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">{t.admin.addLead.step2}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.addLead.step2Desc}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">
                {t.admin.addLead.companyName} <span className="text-destructive">*</span>
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
              <Label htmlFor="industry">{t.admin.addLead.industryLabel}</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder={t.admin.addLead.industryPlaceholder} />
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
              <Label htmlFor="contactPerson">{t.admin.addLead.contactPerson}</Label>
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
              riskAssessment.level === "high" ? "text-destructive" : "text-chart-5",
            )}
          />
          <div className="flex flex-col gap-1">
            <p
              className={cn(
                "text-sm font-semibold",
                riskAssessment.level === "high" ? "text-destructive" : "text-chart-5",
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
              {t.admin.addLead.riskRecommended}: {riskAssessment.recommendedPayment[locale]}
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
          disabled={loading || !!isBlocked || !selectedClientId || !companyName}
          className="bg-primary text-primary-foreground"
        >
          {loading ? (
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
