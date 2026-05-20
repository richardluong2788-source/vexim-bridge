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
  const [peakMonthsDataYear, setPeakMonthsDataYear] = useState("")
  const [importTrend, setImportTrend] = useState("")

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
  // Section 6: GHI CHÚ CHO AI (LR nhập - CRITICAL FOR PERSONALIZATION)
  // ══════════════════════════════════════════════════════════════════════════
  const [bolDescription, setBolDescription] = useState("")
  const [purchaseHistory, setPurchaseHistory] = useState("")
  const [notes, setNotes] = useState("")
  const [priorityRating, setPriorityRating] = useState<string>("")
  
  // Data quality checks
  const isPurchaseHistoryEmpty = !purchaseHistory.trim()
  const isTopSuppliersEmpty = !topSuppliers.trim()

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
      peakMonthsDataYear: peakMonthsDataYear ? parseInt(peakMonthsDataYear, 10) : null,
      importTrend: importTrend || null,
      
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
            {locale === "vi" ? "1. Thông tin định danh" : "1. Identification"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR tự nhập - thông tin cơ bản từ ImportYeti"
              : "LR enters - basic info from ImportYeti"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Company name (required) */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName" className="text-sm font-medium">
                {locale === "vi" ? "Tên công ty *" : "Company Name *"}
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
                  {locale === "vi" ? "Tên công ty không được để trống" : "Company name is required"}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="importAddress">
                {locale === "vi" ? "Địa chỉ" : "Address"}
              </Label>
              <Input
                id="importAddress"
                placeholder={locale === "vi" ? "Quan trọng để xác định bang (VD: 123 Main St, Norfolk, VA)" : "Important for state identification"}
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
                {locale === "vi" ? "Đường link ImportYeti *" : "ImportYeti Link *"}
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

            {/* Contact title */}
            <div className="space-y-2">
              <Label htmlFor="contactTitle">
                {locale === "vi" ? "Chức vụ" : "Job Title"}
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
            {locale === "vi" ? "2. Dữ liệu định lượng" : "2. Quantitative Data"}
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
                {locale === "vi" ? "Tổng số lô hàng" : "Total Shipments"}
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
                {locale === "vi" ? "Ngày lô hàng gần nhất" : "Last Shipment Date"}
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
                {locale === "vi" ? "Avg TEU/tháng" : "Avg TEU/month"}
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
                {locale === "vi" ? "Top 3 tháng cao điểm (số lô)" : "Top 3 Peak Months (shipments)"}
              </Label>
              <Input
                id="topPeakMonths"
                placeholder={locale === "vi" ? "VD: Tháng 8:338, Tháng 7:286, Tháng 9:280" : "E.g. Aug:338, Jul:286, Sep:280"}
                value={topPeakMonths}
                onChange={(e) => setTopPeakMonths(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Top 3 low months */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="topLowMonths">
                {locale === "vi" ? "Top 3 tháng thấp điểm" : "Top 3 Low Months"}
              </Label>
              <Input
                id="topLowMonths"
                placeholder={locale === "vi" ? "VD: Tháng 2:112, Tháng 3:105" : "E.g. Feb:112, Mar:105"}
                value={topLowMonths}
                onChange={(e) => setTopLowMonths(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Peak months data year */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="peakMonthsDataYear">
                {locale === "vi" ? "Năm dữ liệu" : "Data Year"}
              </Label>
              <Input
                id="peakMonthsDataYear"
                placeholder={locale === "vi" ? "VD: 2025, 2026" : "E.g. 2025, 2026"}
                value={peakMonthsDataYear}
                onChange={(e) => setPeakMonthsDataYear(e.target.value)}
                className="border-border"
              />
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "Năm của dữ liệu ImportYeti" : "Year of ImportYeti data"}
              </p>
            </div>

            {/* Import trend */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="importTrend">
                {locale === "vi" ? "Xu hướng nhập khẩu" : "Import Trend"}
              </Label>
              <Select value={importTrend} onValueChange={setImportTrend}>
                <SelectTrigger id="importTrend" className="border-border">
                  <SelectValue placeholder={locale === "vi" ? "Chọn xu hướng" : "Select trend"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="growing">
                    {locale === "vi" ? "Đang tăng" : "Growing"}
                  </SelectItem>
                  <SelectItem value="stable">
                    {locale === "vi" ? "Ổn định" : "Stable"}
                  </SelectItem>
                  <SelectItem value="declining">
                    {locale === "vi" ? "Đang giảm" : "Declining"}
                  </SelectItem>
                  <SelectItem value="unknown">
                    {locale === "vi" ? "Chưa rõ" : "Unknown"}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {locale === "vi" ? "So sánh với các năm trước" : "Compare with previous years"}
              </p>
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
            {locale === "vi" ? "3. Mã HS & Sản phẩm" : "3. HS Code & Products"}
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
                {locale === "vi" ? "Mã HS chính (1-3 cái) *" : "Main HS Code (1-3) *"}
              </Label>
              <Input
                id="hsCode"
                placeholder={locale === "vi" ? "VD: 0801.32" : "E.g. 0801.32"}
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                className="border-border"
              />
              <p className="text-xs text-muted-foreground">
                  {locale === "vi" ? "Lấy từ Product Breakdown hoặc shipment" : "From Product Breakdown or shipment"}
              </p>
            </div>

            {/* Main product */}
            <div className="space-y-2">
              <Label htmlFor="mainProduct">
                {locale === "vi" ? "Sản phẩm chính (tên thương mại) *" : "Main Product (trade name) *"}
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
                {locale === "vi" ? "Mã HS phụ (nếu có)" : "Secondary HS Codes (if any)"}
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
                {locale === "vi" ? "Ngành hàng" : "Industry"}
              </Label>
              <Select value={needsIndustry} onValueChange={setNeedsIndustry}>
                <SelectTrigger id="industry" className="border-border">
                  <SelectValue placeholder={locale === "vi" ? "Chọn ngành..." : "Select industry..."} />
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
            {locale === "vi" ? "4. Chuỗi cung ứng hiện tại" : "4. Current Supply Chain"}
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
                {locale === "vi" ? "Top 5 supplier (tên + nước) *" : "Top 5 Suppliers (name + country) *"}
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
                  {locale === "vi" ? "Từ tab \"Suppliers\" trên ImportYeti" : "From \"Suppliers\" tab on ImportYeti"}
              </p>
            </div>

            {/* Main import countries */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mainImportCountries">
                {locale === "vi" ? "Quốc gia nhập khẩu chính" : "Main Import Countries"}
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
                {locale === "vi" ? "Cảng xuất chính (top 2)" : "Top Origin Ports (top 2)"}
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
                {locale === "vi" ? "Cảng đích chính (top 2)" : "Top Destination Ports (top 2)"}
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
                {locale === "vi" ? "Loại container phổ biến" : "Common Container Types"}
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
      <Card className={cn("border-border", (isPurchaseHistoryEmpty || isTopSuppliersEmpty) && "border-chart-5/50 bg-chart-5/5")}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4 text-primary" />
            {locale === "vi" ? "6. Ghi chú cho AI" : "6. Notes for AI"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "LR nhap - QUAN TRONG cho email AI co 'vu khi'"
              : "LR enters - CRITICAL for AI to write personalized emails"}
          </CardDescription>
          {(isPurchaseHistoryEmpty || isTopSuppliersEmpty) && (
            <div className="flex gap-2 rounded-sm bg-chart-5/10 p-2 text-xs text-chart-5 mt-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <div>
                {isPurchaseHistoryEmpty && (
                  <p>{locale === "vi" ? "⚠️ Lịch sử mua hàng rỗng = AI không thể cá nhân hóa email" : "⚠️ Empty purchase history = AI cannot personalize the email"}</p>
                )}
                {isTopSuppliersEmpty && (
                  <p>{locale === "vi" ? "⚠️ Nhà cung cấp hàng đầu rỗng = AI sẽ mất cơ hội tận dụng Vietnam supplier leverage" : "⚠️ Empty suppliers = AI loses Vietnam supplier angle"}</p>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* BOL description */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bolDescription">
                {locale === "vi" ? "Mô tả sản phẩm mẫu (copy 1-2 dòng từ BOL)" : "Sample Product Description (copy 1-2 lines from BOL)"}
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
                {locale === "vi" ? "Lịch sử mua hàng" : "Purchase History"}
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
                {locale === "vi" ? "Nhận xét thêm của LR" : "Additional LR Notes"}
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
                {locale === "vi" ? "Mức độ ưu tiên (1-5 sao)" : "Priority Rating (1-5 stars)"}
                <Star className="h-3 w-3 text-chart-5" />
              </Label>
              <Select value={priorityRating} onValueChange={setPriorityRating}>
                <SelectTrigger id="priorityRating" className="border-border">
                  <SelectValue placeholder={locale === "vi" ? "Chọn mức độ..." : "Select rating..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - {locale === "vi" ? "Rất cao" : "Very High"}</SelectItem>
                  <SelectItem value="4">4 - {locale === "vi" ? "Cao" : "High"}</SelectItem>
                  <SelectItem value="3">3 - {locale === "vi" ? "Trung bình" : "Medium"}</SelectItem>
                  <SelectItem value="2">2 - {locale === "vi" ? "Thấp" : "Low"}</SelectItem>
                  <SelectItem value="1">1 - {locale === "vi" ? "Rất thấp" : "Very Low"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Capacity needed */}
            <div className="space-y-2">
              <Label htmlFor="needsCapacity">
                {locale === "vi" ? "Công suất cần (tấn/tháng)" : "Capacity Needed (MT/month)"}
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

      {/* Info box */}
      <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">
              {locale === "vi" ? "AI sẽ tự động làm gì sau khi LR nhập?" : "What will AI do after LR enters data?"}
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>{locale === "vi" ? "Lấy thêm thông tin bổ sung nếu thiếu" : "Fetch additional info if missing"}</li>
              <li>{locale === "vi" ? "Matching với client VN phù hợp" : "Match with suitable VN clients"}</li>
              <li>{locale === "vi" ? "Phân tích đối thủ, tìm điểm yếu" : "Analyze competitors, find weaknesses"}</li>
              <li>{locale === "vi" ? "Tính toán lợi thế logistics của client VN" : "Calculate VN client logistics advantages"}</li>
              <li>{locale === "vi" ? "Đề xuất thời điểm tiếp cận tốt nhất" : "Suggest best approach timing"}</li>
              <li>{locale === "vi" ? "Sinh kịch bản chào hàng cá nhân hóa" : "Generate personalized sales scripts"}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
