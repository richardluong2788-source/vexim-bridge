"use client"

/**
 * Lead Researcher Buyer Entry Form — 7-section spec with ImportYeti data.
 *
 * Sections:
 *   1. THÔNG TIN ĐỊNH DANH - Company, contact, ImportYeti link
 *   2. DỮ LIỆU ĐỊNH LƯỢNG - Shipments, TEU, peak/low months from ImportYeti
 *   3. MÃ HS & SẢN PHẨM - HS codes, products
 *   4. CHUỖI CUNG ỨNG - Suppliers, import countries
 *   5. LOGISTICS - Ports, containers
 *   6. GHI CHÚ CHO AI - BOL description, notes, priority
 *   7. AI auto-matches to best AE based on all signals
 */

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Loader2,
  Building2,
  BarChart3,
  Package,
  Network,
  Ship,
  MessageSquareText,
  Star,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import { assessCountryRisk } from "@/lib/risk/country-risk"
import { INDUSTRIES, INDUSTRY_LABELS_VI } from "@/lib/constants/industries"
import { createLeadWithAIMatchingAction } from "@/app/admin/leads/new/actions"

export function SmartLeadForm() {
  const router = useRouter()
  const supabase = createClient()
  const { locale } = useTranslation()

  // ══════════════════════════════════════════════════════════════════════════
  // Section 1: THÔNG TIN ĐỊNH DANH (LR tự nhập - cơ bản)
  // ══════════════════════════════════════════════════════════════════════════
  const [companyName, setCompanyName] = useState("")
  const [importAddress, setImportAddress] = useState("")
  const [website, setWebsite] = useState("")
  const [importYetiLink, setImportYetiLink] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactTitle, setContactTitle] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [country, setCountry] = useState("")

  // ══════════════════════════════════════════════════════════════════════════
  // Section 2: DỮ LIỆU ĐỊNH LƯỢNG (LR copy-paste từ ImportYeti)
  // ══════════════════════════════════════════════════════════════════════════
  const [totalShipments, setTotalShipments] = useState("")
  const [lastShipmentDate, setLastShipmentDate] = useState("")
  const [avgTeuPerMonth, setAvgTeuPerMonth] = useState("")
  const [topPeakMonths, setTopPeakMonths] = useState("")
  const [topLowMonths, setTopLowMonths] = useState("")

  // ══════════════════════════════════════════════════════════════════════════
  // Section 3: MÃ HS & SẢN PHẨM (LR nhập - quan trọng cho AI matching)
  // ══════════════════════════════════════════════════════════════════════════
  const [hsCode, setHsCode] = useState("")
  const [mainProduct, setMainProduct] = useState("")
  const [secondaryHsCodes, setSecondaryHsCodes] = useState("")
  const [needsIndustry, setNeedsIndustry] = useState("")

  // ══════════════════════════════════════════════════════════════════════════
  // Section 4: CHUỖI CUNG ỨNG HIỆN TẠI (LR nhập - để AI phân tích đối thủ)
  // ══════════════════════════════════════════════════════════════════════════
  const [topSuppliers, setTopSuppliers] = useState("")
  const [mainImportCountries, setMainImportCountries] = useState("")

  // ══════════════════════════════════════════════════════════════════════════
  // Section 5: LOGISTICS (LR nhập - để AI gợi ý lợi thế cạnh tranh)
  // ══════════════════════════════════════════════════════════════════════════
  const [originPorts, setOriginPorts] = useState("")
  const [destinationPorts, setDestinationPorts] = useState("")
  const [containerTypes, setContainerTypes] = useState("")

  // ══════════════════════════════════════════════════════════════════════════
  // Section 6: GHI CHÚ CHO AI (LR nhập - tùy chọn nhưng rất giá trị)
  // ══════════════════════════════════════════════════════════════════════════
  const [bolDescription, setBolDescription] = useState("")
  const [purchaseHistory, setPurchaseHistory] = useState("")
  const [notes, setNotes] = useState("")
  const [priorityRating, setPriorityRating] = useState<string>("")

  // ══════════════════════════════════════════════════════════════════════════
  // Legacy fields for AI matching (backward compatibility)
  // ══════════════════════════════════════════════════════════════════════════
  const [needsCapacity, setNeedsCapacity] = useState("")
  const [potentialValue, setPotentialValue] = useState("")

  // ── Submit state ──────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const riskAssessment = country.trim() ? assessCountryRisk(country) : null
  const isCompanyNameMissing = !companyName.trim()
  const isImportYetiLinkMissing = !importYetiLink.trim()

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
      // Section 1
      companyName,
      importAddress: importAddress || null,
      website: website || null,
      importYetiLink: importYetiLink || null,
      contactPerson: contactPerson || null,
      contactTitle: contactTitle || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      country: country.trim() || null,
      
      // Section 2
      totalShipments: totalShipments ? parseInt(totalShipments, 10) : null,
      lastShipmentDate: lastShipmentDate || null,
      avgTeuPerMonth: avgTeuPerMonth ? parseFloat(avgTeuPerMonth) : null,
      topPeakMonths: topPeakMonths || null,
      topLowMonths: topLowMonths || null,
      
      // Section 3
      hsCode: hsCode || null,
      mainProduct: mainProduct || null,
      secondaryHsCodes: secondaryHsCodes || null,
      industry: needsIndustry || null,
      productKeyword: mainProduct || null,
      
      // Section 4
      topSuppliers: topSuppliers || null,
      mainImportCountries: mainImportCountries || null,
      
      // Section 5
      originPorts: originPorts || null,
      destinationPorts: destinationPorts || null,
      containerTypes: containerTypes || null,
      
      // Section 6
      bolDescription: bolDescription || null,
      purchaseHistory: purchaseHistory || null,
      notes: notes || null,
      priorityRating: priorityRating ? parseInt(priorityRating, 10) : null,
      
      // Legacy
      capacityNeeded: needsCapacity ? parseFloat(needsCapacity) : null,
      potentialValue: potentialValue ? parseFloat(potentialValue) : null,
      peakMonths: topPeakMonths || null,
    })

    if (!result.success) {
      setError(result.error ?? "Failed to create buyer")
      setSubmitting(false)
      return
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
              ? "Buyer duoc them thanh cong! He thong AI dang phan tich..."
              : "Buyer added successfully! AI is analyzing..."}
          </p>
          <p className="text-sm text-muted-foreground">
            {locale === "vi"
              ? "Se chuyen huong ve danh sach buyer"
              : "Redirecting to buyer list"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Section 1: THONG TIN DINH DANH */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            {locale === "vi" ? "1. Thong tin dinh danh" : "1. Identification"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR tu nhap - thong tin co ban tu ImportYeti"
              : "LR enters - basic info from ImportYeti"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Company name (required) */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName" className="text-sm font-medium">
                {locale === "vi" ? "Ten cong ty *" : "Company Name *"}
              </Label>
              <Input
                id="companyName"
                placeholder={locale === "vi" ? "VD: American Cashew Co." : "E.g. American Cashew Co."}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={cn(
                  "border-border",
                  isCompanyNameMissing && companyName !== "" && "border-destructive bg-destructive/5"
                )}
              />
              {isCompanyNameMissing && companyName !== "" && (
                <p className="text-xs text-destructive">
                  {locale === "vi" ? "Ten cong ty khong duoc de trong" : "Company name is required"}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="importAddress">
                {locale === "vi" ? "Dia chi" : "Address"}
              </Label>
              <Input
                id="importAddress"
                placeholder={locale === "vi" ? "Quan trong de xac dinh bang (VD: 123 Main St, Norfolk, VA)" : "Important for state identification"}
                value={importAddress}
                onChange={(e) => setImportAddress(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://..."
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="border-border"
              />
            </div>

            {/* ImportYeti Link (required) */}
            <div className="space-y-2">
              <Label htmlFor="importYetiLink" className="flex items-center gap-1.5">
                {locale === "vi" ? "Duong link ImportYeti *" : "ImportYeti Link *"}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input
                id="importYetiLink"
                type="url"
                placeholder="https://importyeti.com/company/..."
                value={importYetiLink}
                onChange={(e) => setImportYetiLink(e.target.value)}
                className={cn(
                  "border-border",
                  isImportYetiLinkMissing && importYetiLink !== "" && "border-destructive bg-destructive/5"
                )}
              />
            </div>

            {/* Contact person */}
            <div className="space-y-2">
              <Label htmlFor="contactPerson">
                {locale === "vi" ? "Nguoi lien he" : "Contact Person"}
              </Label>
              <Input
                id="contactPerson"
                placeholder={locale === "vi" ? "VD: Sarah Chen" : "E.g. Sarah Chen"}
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Contact title */}
            <div className="space-y-2">
              <Label htmlFor="contactTitle">
                {locale === "vi" ? "Chuc vu" : "Job Title"}
              </Label>
              <Input
                id="contactTitle"
                placeholder={locale === "vi" ? "VD: Purchasing Manager" : "E.g. Purchasing Manager"}
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
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
                {locale === "vi" ? "So dien thoai" : "Phone"}
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
                {locale === "vi" ? "Quoc gia" : "Country"}
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
                      riskAssessment.level === "high"
                        ? "bg-destructive"
                        : riskAssessment.level === "medium"
                          ? "bg-chart-5"
                          : "bg-chart-4"
                    )}
                  />
                  <span className="text-muted-foreground">
                    {locale === "vi" 
                      ? riskAssessment.reasons.vi[0] 
                      : riskAssessment.reasons.en[0]}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Section 2: DU LIEU DINH LUONG */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            {locale === "vi" ? "2. Du lieu dinh luong" : "2. Quantitative Data"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR copy-paste tu ImportYeti - de AI phan tich"
              : "LR copy-paste from ImportYeti - for AI analysis"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total shipments */}
            <div className="space-y-2">
              <Label htmlFor="totalShipments">
                {locale === "vi" ? "Tong so lo hang" : "Total Shipments"}
              </Label>
              <Input
                id="totalShipments"
                type="number"
                placeholder="VD: 2,201"
                value={totalShipments}
                onChange={(e) => setTotalShipments(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Last shipment date */}
            <div className="space-y-2">
              <Label htmlFor="lastShipmentDate">
                {locale === "vi" ? "Ngay lo hang gan nhat" : "Last Shipment Date"}
              </Label>
              <Input
                id="lastShipmentDate"
                type="date"
                value={lastShipmentDate}
                onChange={(e) => setLastShipmentDate(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Avg TEU/month */}
            <div className="space-y-2">
              <Label htmlFor="avgTeuPerMonth">
                {locale === "vi" ? "Avg TEU/thang" : "Avg TEU/month"}
              </Label>
              <Input
                id="avgTeuPerMonth"
                type="number"
                step="0.01"
                placeholder="VD: 1.93"
                value={avgTeuPerMonth}
                onChange={(e) => setAvgTeuPerMonth(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Top 3 peak months */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="topPeakMonths">
                {locale === "vi" ? "Top 3 thang cao diem (so lo)" : "Top 3 Peak Months (shipments)"}
              </Label>
              <Input
                id="topPeakMonths"
                placeholder={locale === "vi" ? "VD: Thang 8:338, Thang 7:286, Thang 9:280" : "E.g. Aug:338, Jul:286, Sep:280"}
                value={topPeakMonths}
                onChange={(e) => setTopPeakMonths(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Top 3 low months */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="topLowMonths">
                {locale === "vi" ? "Top 3 thang thap diem" : "Top 3 Low Months"}
              </Label>
              <Input
                id="topLowMonths"
                placeholder={locale === "vi" ? "VD: Thang 2:112, Thang 3:105" : "E.g. Feb:112, Mar:105"}
                value={topLowMonths}
                onChange={(e) => setTopLowMonths(e.target.value)}
                className="border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Section 3: MA HS & SAN PHAM */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            {locale === "vi" ? "3. Ma HS & San pham" : "3. HS Code & Products"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR nhap - quan trong cho AI matching"
              : "LR enters - important for AI matching"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Main HS code (required) */}
            <div className="space-y-2">
              <Label htmlFor="hsCode">
                {locale === "vi" ? "Ma HS chinh (1-3 cai) *" : "Main HS Code (1-3) *"}
              </Label>
              <Input
                id="hsCode"
                placeholder={locale === "vi" ? "VD: 0801.32" : "E.g. 0801.32"}
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                className="border-border"
              />
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "Lay tu Product Breakdown hoac shipment" : "From Product Breakdown or shipment"}
              </p>
            </div>

            {/* Main product */}
            <div className="space-y-2">
              <Label htmlFor="mainProduct">
                {locale === "vi" ? "San pham chinh (ten thuong mai) *" : "Main Product (trade name) *"}
              </Label>
              <Input
                id="mainProduct"
                placeholder={locale === "vi" ? "VD: Cashew kernels shelled" : "E.g. Cashew kernels shelled"}
                value={mainProduct}
                onChange={(e) => setMainProduct(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Secondary HS codes */}
            <div className="space-y-2">
              <Label htmlFor="secondaryHsCodes">
                {locale === "vi" ? "Ma HS phu (neu co)" : "Secondary HS Codes (if any)"}
              </Label>
              <Input
                id="secondaryHsCodes"
                placeholder={locale === "vi" ? "VD: 0801.31, 2008.19" : "E.g. 0801.31, 2008.19"}
                value={secondaryHsCodes}
                onChange={(e) => setSecondaryHsCodes(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="industry">
                {locale === "vi" ? "Nganh hang" : "Industry"}
              </Label>
              <Select value={needsIndustry} onValueChange={setNeedsIndustry}>
                <SelectTrigger id="industry" className="border-border">
                  <SelectValue placeholder={locale === "vi" ? "Chon nganh..." : "Select industry..."} />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {locale === "vi" ? INDUSTRY_LABELS_VI[ind] ?? ind : ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Section 4: CHUOI CUNG UNG HIEN TAI */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4 text-primary" />
            {locale === "vi" ? "4. Chuoi cung ung hien tai" : "4. Current Supply Chain"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR nhap - de AI phan tich doi thu"
              : "LR enters - for AI competitor analysis"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top 5 suppliers */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="topSuppliers">
                {locale === "vi" ? "Top 5 supplier (ten + nuoc) *" : "Top 5 Suppliers (name + country) *"}
              </Label>
              <Textarea
                id="topSuppliers"
                placeholder={
                  locale === "vi"
                    ? "VD: Thao Tam (VN), Tai Nhung (VN), Thanh Vy (VN), Comextra Majora (Indonesia), Amendoas Do Brasil (Brazil)"
                    : "E.g. Thao Tam (VN), Tai Nhung (VN), Comextra Majora (Indonesia)"
                }
                value={topSuppliers}
                onChange={(e) => setTopSuppliers(e.target.value)}
                rows={2}
                className="resize-none border-border"
              />
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "Tu tab \"Suppliers\" tren ImportYeti" : "From \"Suppliers\" tab on ImportYeti"}
              </p>
            </div>

            {/* Main import countries */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mainImportCountries">
                {locale === "vi" ? "Quoc gia nhap khau chinh" : "Main Import Countries"}
              </Label>
              <Input
                id="mainImportCountries"
                placeholder={locale === "vi" ? "VD: Vietnam (68%), Brazil (8%), Indonesia (3%)" : "E.g. Vietnam (68%), Brazil (8%)"}
                value={mainImportCountries}
                onChange={(e) => setMainImportCountries(e.target.value)}
                className="border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Section 5: LOGISTICS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ship className="h-4 w-4 text-primary" />
            {locale === "vi" ? "5. Logistics" : "5. Logistics"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR nhap - de AI goi y loi the canh tranh"
              : "LR enters - for AI competitive advantage suggestions"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Origin ports */}
            <div className="space-y-2">
              <Label htmlFor="originPorts">
                {locale === "vi" ? "Cang xuat chinh (top 2)" : "Top Origin Ports (top 2)"}
              </Label>
              <Input
                id="originPorts"
                placeholder={locale === "vi" ? "VD: Vung Tau (46%), Singapore (11%)" : "E.g. Vung Tau (46%), Singapore (11%)"}
                value={originPorts}
                onChange={(e) => setOriginPorts(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Destination ports */}
            <div className="space-y-2">
              <Label htmlFor="destinationPorts">
                {locale === "vi" ? "Cang dich chinh (top 2)" : "Top Destination Ports (top 2)"}
              </Label>
              <Input
                id="destinationPorts"
                placeholder={locale === "vi" ? "VD: Norfolk VA (38%), Newark NJ (37%)" : "E.g. Norfolk VA (38%), Newark NJ (37%)"}
                value={destinationPorts}
                onChange={(e) => setDestinationPorts(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Container types */}
            <div className="space-y-2">
              <Label htmlFor="containerTypes">
                {locale === "vi" ? "Loai container pho bien" : "Common Container Types"}
              </Label>
              <Input
                id="containerTypes"
                placeholder={locale === "vi" ? "VD: 20ft (63%)" : "E.g. 20ft (63%)"}
                value={containerTypes}
                onChange={(e) => setContainerTypes(e.target.value)}
                className="border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Section 6: GHI CHU CHO AI */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4 text-primary" />
            {locale === "vi" ? "6. Ghi chu cho AI" : "6. Notes for AI"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR nhap - tuy chon nhung rat gia tri"
              : "LR enters - optional but very valuable"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* BOL description */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bolDescription">
                {locale === "vi" ? "Mo ta san pham mau (copy 1-2 dong tu BOL)" : "Sample Product Description (copy 1-2 lines from BOL)"}
              </Label>
              <Textarea
                id="bolDescription"
                placeholder={
                  locale === "vi"
                    ? 'VD: "700 Cartons Of Indian Cashew 320 Count Scorched Wholes Pack In 1 X 50 Lb Flexipack..."'
                    : 'E.g. "700 Cartons Of Indian Cashew 320 Count Scorched Wholes Pack In 1 X 50 Lb Flexipack..."'
                }
                value={bolDescription}
                onChange={(e) => setBolDescription(e.target.value)}
                rows={2}
                className="resize-none border-border"
              />
            </div>

            {/* Purchase history */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="purchaseHistory">
                {locale === "vi" ? "Lich su mua hang" : "Purchase History"}
              </Label>
              <Textarea
                id="purchaseHistory"
                placeholder={
                  locale === "vi"
                    ? "VD: Mua 500 tan cashew tu Vietnam nam 2024, 300 tan tu Brazil 2023..."
                    : "E.g. Purchased 500 MT cashew from Vietnam in 2024, 300 MT from Brazil 2023..."
                }
                value={purchaseHistory}
                onChange={(e) => setPurchaseHistory(e.target.value)}
                rows={2}
                className="resize-none border-border"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {locale === "vi" ? "Nhan xet them cua LR" : "Additional LR Notes"}
              </Label>
              <Textarea
                id="notes"
                placeholder={
                  locale === "vi"
                    ? 'VD: "Co ve ho uu tien quality cao, packaging vacuum"'
                    : 'E.g. "Seems to prioritize high quality, vacuum packaging"'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none border-border"
              />
            </div>

            {/* Priority rating */}
            <div className="space-y-2">
              <Label htmlFor="priorityRating" className="flex items-center gap-1.5">
                {locale === "vi" ? "Muc do uu tien (1-5 sao)" : "Priority Rating (1-5 stars)"}
                <Star className="h-3 w-3 text-chart-5" />
              </Label>
              <Select value={priorityRating} onValueChange={setPriorityRating}>
                <SelectTrigger id="priorityRating" className="border-border">
                  <SelectValue placeholder={locale === "vi" ? "Chon muc do..." : "Select rating..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - {locale === "vi" ? "Rat cao" : "Very High"}</SelectItem>
                  <SelectItem value="4">4 - {locale === "vi" ? "Cao" : "High"}</SelectItem>
                  <SelectItem value="3">3 - {locale === "vi" ? "Trung binh" : "Medium"}</SelectItem>
                  <SelectItem value="2">2 - {locale === "vi" ? "Thap" : "Low"}</SelectItem>
                  <SelectItem value="1">1 - {locale === "vi" ? "Rat thap" : "Very Low"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Capacity needed */}
            <div className="space-y-2">
              <Label htmlFor="needsCapacity">
                {locale === "vi" ? "Cong suat can (tan/thang)" : "Capacity Needed (MT/month)"}
              </Label>
              <Input
                id="needsCapacity"
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
                {locale === "vi" ? "Gia tri tiem nang (USD)" : "Potential Value (USD)"}
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
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Submit */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          {locale === "vi" ? "Huy" : "Cancel"}
        </Button>
        <Button
          type="submit"
          disabled={isCompanyNameMissing || submitting}
          className="gap-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {locale === "vi" ? "Them Buyer" : "Add Buyer"}
        </Button>
      </div>

      {/* Info box */}
      <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">
                {locale === "vi" ? "AI se tu dong lam gi sau khi LR nhap?" : "What will AI do after LR enters data?"}
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>{locale === "vi" ? "Lay them thong tin bo sung neu thieu" : "Fetch additional info if missing"}</li>
                <li>{locale === "vi" ? "Matching voi client VN phu hop" : "Match with suitable VN clients"}</li>
                <li>{locale === "vi" ? "Phan tich doi thu, tim diem yeu" : "Analyze competitors, find weaknesses"}</li>
                <li>{locale === "vi" ? "Tinh toan loi the logistics cua client VN" : "Calculate VN client logistics advantages"}</li>
                <li>{locale === "vi" ? "De xuat thoi diem tiep can tot nhat" : "Suggest best approach timing"}</li>
                <li>{locale === "vi" ? "Sinh kich ban chao hang ca nhan hoa" : "Generate personalized sales scripts"}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
