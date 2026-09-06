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
 *   7. NHU CẦU THỰC TẾ - Direct inquiry from outside the platform
 *      (email/phone/Zalo/trade fair...): products, quantity, target price,
 *      timeline, channel. Sets leads.source = 'direct_inquiry' and gets
 *      top AI-matching priority.
 *   → AI auto-matches to best AE based on all signals
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
  Wand2,
  UserPlus,
  X,
  Flame,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import { assessCountryRisk } from "@/lib/risk/country-risk"
import { INDUSTRIES, INDUSTRY_LABELS_VI, INDUSTRY_LABELS_EN, INDUSTRY_HELP_TEXT } from "@/lib/constants/industries"
import { Switch } from "@/components/ui/switch"
import {
  createLeadWithAIMatchingAction,
  type CreateLeadWithAIMatchingInput,
  type AdditionalContactInput,
} from "@/app/admin/leads/new/actions"
import { toast } from "sonner"
import { BuyerAnalysisCard } from "@/components/admin/buyer-analysis-card"
import type { BuyerAnalysisResult } from "@/lib/ai/buyer-analyzer"
import type { BuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

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

  // Liên hệ khác của công ty (phòng ban / đại diện thị trường khác) — nhập
  // ngay lúc tạo buyer, thay vì phải lưu xong rồi mới vào trang chi tiết để
  // thêm. Người liên hệ chính ở trên vẫn được lưu như cũ.
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContactInput[]>([])

  function addContactRow() {
    setAdditionalContacts((prev) => [
      ...prev,
      { fullName: "", title: "", department: "", marketRegion: "", email: "", phone: "", isDecisionMaker: false },
    ])
  }

  function updateContactRow(index: number, patch: Partial<AdditionalContactInput>) {
    setAdditionalContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function removeContactRow(index: number) {
    setAdditionalContacts((prev) => prev.filter((_, i) => i !== index))
  }

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

  // ══════════════════════════════════════════════════════════════════════════
  // Section 7: NHU CẦU THỰC TẾ CỦA BUYER (direct inquiry — migration 068)
  // Buyer chủ động có nhu cầu từ bên ngoài (email/phone/Zalo/hội chợ...),
  // ngược với buyer thuần research từ ImportYeti.
  // ══════════════════════════════════════════════════════════════════════════
  const [hasActiveInquiry, setHasActiveInquiry] = useState(false)
  const [inquiryProducts, setInquiryProducts] = useState("")
  const [inquiryQuantity, setInquiryQuantity] = useState("")
  const [inquiryTargetPrice, setInquiryTargetPrice] = useState("")
  const [inquiryTimeline, setInquiryTimeline] = useState("")
  const [inquiryChannel, setInquiryChannel] = useState<string>("")
  const [inquiryNotes, setInquiryNotes] = useState("")

  // Data quality checks
  const isPurchaseHistoryEmpty = !purchaseHistory.trim()
  const isTopSuppliersEmpty = !topSuppliers.trim()

  const isInquiryMissingDetails =
    hasActiveInquiry &&
    !inquiryProducts.trim() &&
    !inquiryQuantity.trim() &&
    !inquiryNotes.trim()

  // ══════════════════════════════════════════════════════════════════════════
  // Legacy fields for AI matching (backward compatibility)
  // ══════════════════════════════════════════════════════════════════════════
  const [needsCapacity, setNeedsCapacity] = useState("")
  const [potentialValue, setPotentialValue] = useState("")

  // ── Submit state ───────────��──────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // ── Auto-fill from ImportYeti API ──────────────────────────────────────
  const [autoFillLoading, setAutoFillLoading] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [buyerAnalysis, setBuyerAnalysis] = useState<BuyerAnalysisResult | null>(null)
  const [buyerStrategy, setBuyerStrategy] = useState<BuyerStrategy | null>(null)

  const riskAssessment = country.trim() ? assessCountryRisk(country) : null
  const isCompanyNameMissing = !companyName.trim()
  const isImportYetiLinkMissing = !importYetiLink.trim()

  // ══════════════════════════════════════════════════════════════════════════
  // Auto-fill from ImportYeti API
  // ══════════════════════════════════════════════════════════════════════════
  async function handleAutoFillFromImportYeti() {
    if (!importYetiLink.trim()) {
      toast.error(locale === "vi" 
        ? "Vui lòng nhập đường link ImportYeti trước" 
        : "Please enter ImportYeti link first")
      return
    }

    // Validate URL format
    if (!importYetiLink.includes("importyeti.com/company/")) {
      toast.error(locale === "vi"
        ? "Link không hợp lệ. Vui lòng nhập link có dạng: https://importyeti.com/company/company-name"
        : "Invalid link. Please enter a link like: https://importyeti.com/company/company-name")
      return
    }

    setAutoFillLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/importyeti/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importYetiLink: importYetiLink.trim() }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch data from ImportYeti")
      }

      const data: Partial<CreateLeadWithAIMatchingInput> = result.data

      // Auto-fill all available fields
      if (data.companyName) setCompanyName(data.companyName)
      if (data.importAddress) setImportAddress(data.importAddress)
      if (data.website) setWebsite(data.website)
      if (data.contactPhone) setContactPhone(data.contactPhone)
      if (data.country) setCountry(data.country)
      
      // Section 2: Quantitative data
      if (data.totalShipments) setTotalShipments(data.totalShipments.toString())
      if (data.lastShipmentDate) {
        // Convert DD/MM/YYYY to YYYY-MM-DD for input type="date"
        const parts = data.lastShipmentDate.split("/")
        if (parts.length === 3) {
          const [day, month, year] = parts
          setLastShipmentDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
        }
      }
      if (data.avgTeuPerMonth) setAvgTeuPerMonth(data.avgTeuPerMonth.toString())
      if (data.topPeakMonths) setTopPeakMonths(data.topPeakMonths)
      if (data.topLowMonths) setTopLowMonths(data.topLowMonths)
      if (data.peakMonthsDataYear) setPeakMonthsDataYear(data.peakMonthsDataYear.toString())
      if (data.importTrend) setImportTrend(data.importTrend)
      
      // Section 3: HS codes & products
      if (data.hsCode) setHsCode(data.hsCode)
      if (data.mainProduct) setMainProduct(data.mainProduct)
      if (data.secondaryHsCodes) setSecondaryHsCodes(data.secondaryHsCodes)
      
      // Section 4: Supply chain
      if (data.topSuppliers) setTopSuppliers(data.topSuppliers)
      if (data.mainImportCountries) setMainImportCountries(data.mainImportCountries)
      
      // Section 5: Logistics
      if (data.originPorts) setOriginPorts(data.originPorts)
      if (data.destinationPorts) setDestinationPorts(data.destinationPorts)
      if (data.containerTypes) setContainerTypes(data.containerTypes)
      
      // Section 6: AI notes
      if (data.bolDescription) setBolDescription(data.bolDescription)
      if (data.purchaseHistory) setPurchaseHistory(data.purchaseHistory)

      toast.success(locale === "vi"
        ? `Đã tự động điền dữ liệu cho ${data.companyName || "company"}. Đang phân tích buyer...`
        : `Auto-filled data for ${data.companyName || "company"}. Analyzing buyer...`)

      // Trigger AI analysis in background
      runBuyerAnalysis()

    } catch (err) {
      console.error("[SmartLeadForm] Auto-fill error:", err)
      const message = err instanceof Error ? err.message : "Failed to fetch data"
      setError(message)
      toast.error(message)
    } finally {
      setAutoFillLoading(false)
    }
  }

  // Run AI Buyer Analysis
  async function runBuyerAnalysis() {
    if (!importYetiLink.trim()) return

    setAnalysisLoading(true)
    setBuyerAnalysis(null)
    setBuyerStrategy(null)

    try {
      const response = await fetch("/api/importyeti/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importYetiLink: importYetiLink.trim() }),
      })

      const result = await response.json()

      if (!result.success) {
        console.error("[SmartLeadForm] Analysis failed:", result.error)
        toast.error(locale === "vi" 
          ? "Không thể phân tích buyer. Vui lòng thử lại."
          : "Could not analyze buyer. Please try again.")
        return
      }

      setBuyerAnalysis(result.analysis)
      setBuyerStrategy(result.strategy)
      
      toast.success(locale === "vi"
        ? "Đã hoàn thành phân tích buyer!"
        : "Buyer analysis complete!")

    } catch (err) {
      console.error("[SmartLeadForm] Analysis error:", err)
    } finally {
      setAnalysisLoading(false)
    }
  }

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
      additionalContacts: additionalContacts
        .filter((c) => c.fullName.trim())
        .map((c) => ({
          fullName: c.fullName.trim(),
          title: c.title?.trim() || null,
          department: c.department?.trim() || null,
          marketRegion: c.marketRegion?.trim() || null,
          email: c.email?.trim() || null,
          phone: c.phone?.trim() || null,
          isDecisionMaker: c.isDecisionMaker ?? false,
        })),
      
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

      // Section 7: NHU CẦU THỰC TẾ
      hasActiveInquiry,
      inquiryProducts: inquiryProducts || null,
      inquiryQuantity: inquiryQuantity || null,
      inquiryTargetPrice: inquiryTargetPrice || null,
      inquiryTimeline: inquiryTimeline || null,
      inquiryChannel: inquiryChannel || null,
      inquiryNotes: inquiryNotes || null,

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
      {/* AI Buyer Analysis Card (shows after auto-fill) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {(analysisLoading || buyerAnalysis) && (
        <div className="space-y-2">
          {analysisLoading ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {locale === "vi" ? "Đang phân tích buyer với AI..." : "Analyzing buyer with AI..."}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : buyerAnalysis && buyerStrategy ? (
            <BuyerAnalysisCard 
              analysis={buyerAnalysis} 
              strategy={buyerStrategy} 
              locale={locale}
            />
          ) : null}
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
              <div className="flex gap-2">
                <Input
                  id="importYetiLink"
                  type="url"
                  placeholder="https://importyeti.com/company/..."
                  value={importYetiLink}
                  onChange={(e) => setImportYetiLink(e.target.value)}
                  className={cn(
                    "border-border flex-1",
                    isImportYetiLinkMissing && importYetiLink !== "" && "border-destructive bg-destructive/5"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFillFromImportYeti}
                  disabled={autoFillLoading || !importYetiLink.trim()}
                  className="shrink-0 gap-1.5"
                >
                  {autoFillLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="hidden sm:inline">
                        {locale === "vi" ? "Đang tải..." : "Loading..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {locale === "vi" ? "Tự động điền" : "Auto-fill"}
                      </span>
                    </>
                  )}
                </Button>
              </div>
              {importYetiLink.trim() && (
                <p className="text-xs text-muted-foreground">
                  {locale === "vi" 
                    ? "Nhấn \"Tự động điền\" để lấy dữ liệu từ ImportYeti API" 
                    : "Click \"Auto-fill\" to fetch data from ImportYeti API"}
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

          {/* Liên hệ khác (nhiều phòng ban / đại diện thị trường) */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {locale === "vi" ? "Liên hệ khác trong công ty" : "Other contacts at this company"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locale === "vi"
                    ? "Nếu công ty có nhiều phòng ban / đại diện thị trường, thêm ngay ở đây."
                    : "If this company has multiple departments / market reps, add them here."}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addContactRow} className="gap-1.5 shrink-0">
                <UserPlus className="h-3.5 w-3.5" />
                {locale === "vi" ? "Thêm liên hệ" : "Add contact"}
              </Button>
            </div>

            {additionalContacts.map((c, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {locale === "vi" ? `Liên hệ #${index + 2}` : `Contact #${index + 2}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeContactRow(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder={locale === "vi" ? "Họ tên *" : "Full name *"}
                    value={c.fullName}
                    onChange={(e) => updateContactRow(index, { fullName: e.target.value })}
                    className="border-border"
                  />
                  <Input
                    placeholder={locale === "vi" ? "Chức vụ" : "Title"}
                    value={c.title ?? ""}
                    onChange={(e) => updateContactRow(index, { title: e.target.value })}
                    className="border-border"
                  />
                  <Input
                    placeholder={locale === "vi" ? "Phòng ban" : "Department"}
                    value={c.department ?? ""}
                    onChange={(e) => updateContactRow(index, { department: e.target.value })}
                    className="border-border"
                  />
                  <Input
                    placeholder={locale === "vi" ? "Thị trường / khu vực phụ trách" : "Market / region"}
                    value={c.marketRegion ?? ""}
                    onChange={(e) => updateContactRow(index, { marketRegion: e.target.value })}
                    className="border-border"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={c.email ?? ""}
                    onChange={(e) => updateContactRow(index, { email: e.target.value })}
                    className="border-border"
                  />
                  <Input
                    placeholder={locale === "vi" ? "Số điện thoại" : "Phone"}
                    value={c.phone ?? ""}
                    onChange={(e) => updateContactRow(index, { phone: e.target.value })}
                    className="border-border"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <Label className="text-xs font-normal">
                    {locale === "vi" ? "Người quyết định" : "Decision maker"}
                  </Label>
                  <Switch
                    checked={!!c.isDecisionMaker}
                    onCheckedChange={(v) => updateContactRow(index, { isDecisionMaker: v })}
                  />
                </div>
              </div>
            ))}
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
                      {locale === "vi" ? INDUSTRY_LABELS_VI[ind] ?? ind : INDUSTRY_LABELS_EN[ind] ?? ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(needsIndustry === "Agriculture" || needsIndustry === "Food & Beverage" || !needsIndustry) && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === "vi" ? INDUSTRY_HELP_TEXT.vi : INDUSTRY_HELP_TEXT.en}
                </p>
              )}
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
              ? "LR nhap - QUAN TRONG cho email AI có dữ liệu phân tích"
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
      {/* Section 7: NHU CẦU THỰC TẾ CỦA BUYER (direct inquiry) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Card
        className={cn(
          "border-border transition-colors",
          hasActiveInquiry && "border-chart-4/50 bg-chart-4/5",
        )}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-chart-4" />
                {locale === "vi" ? "7. Nhu cầu thực tế của Buyer" : "7. Active Buyer Inquiry"}
              </CardTitle>
              <CardDescription>
                {locale === "vi"
                  ? "Bật khi buyer CHỦ ĐỘNG có nhu cầu từ bên ngoài (email, điện thoại, Zalo, hội chợ, giới thiệu...) — không phải buyer research từ ImportYeti"
                  : "Turn on when the buyer ACTIVELY reached out with demand (email, phone, Zalo, trade fair, referral...) — not an ImportYeti research buyer"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor="hasActiveInquiry" className="text-sm font-medium">
                {hasActiveInquiry
                  ? locale === "vi"
                    ? "Đang có nhu cầu"
                    : "Active inquiry"
                  : locale === "vi"
                    ? "Không có"
                    : "Off"}
              </Label>
              <Switch
                id="hasActiveInquiry"
                checked={hasActiveInquiry}
                onCheckedChange={setHasActiveInquiry}
              />
            </div>
          </div>
          {hasActiveInquiry && (
            <div className="flex gap-2 rounded-sm bg-chart-4/10 p-2 text-xs text-chart-4 mt-3">
              <Flame className="h-4 w-4 flex-shrink-0" />
              <p>
                {locale === "vi"
                  ? "Buyer này sẽ được đánh dấu nguồn \"direct_inquiry\", AI matching ưu tiên cao nhất và hiện badge \"Có nhu cầu ngay\" trong inbox của AE."
                  : "This buyer will be tagged \"direct_inquiry\", get top AI-matching priority and show an \"Active inquiry\" badge in the AE inbox."}
              </p>
            </div>
          )}
        </CardHeader>
        {hasActiveInquiry && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Products */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inquiryProducts">
                  {locale === "vi" ? "Sản phẩm buyer cần mua" : "Products the buyer needs"}
                </Label>
                <Input
                  id="inquiryProducts"
                  placeholder={
                    locale === "vi"
                      ? 'VD: "Cà phê Robusta rang mộc 500g, 200 tấn/tháng"'
                      : 'E.g. "Robusta roasted coffee 500g, 200 MT/month"'
                  }
                  value={inquiryProducts}
                  onChange={(e) => setInquiryProducts(e.target.value)}
                  className="border-border"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="inquiryQuantity">
                  {locale === "vi" ? "Số lượng / MOQ" : "Quantity / MOQ"}
                </Label>
                <Input
                  id="inquiryQuantity"
                  placeholder={locale === "vi" ? "VD: 2 container/tháng" : "E.g. 2 containers/month"}
                  value={inquiryQuantity}
                  onChange={(e) => setInquiryQuantity(e.target.value)}
                  className="border-border"
                />
              </div>

              {/* Target price */}
              <div className="space-y-2">
                <Label htmlFor="inquiryTargetPrice">
                  {locale === "vi" ? "Giá mục tiêu" : "Target price"}
                </Label>
                <Input
                  id="inquiryTargetPrice"
                  placeholder={locale === "vi" ? "VD: 2.100 USD/tấn FOB" : "E.g. 2,100 USD/MT FOB"}
                  value={inquiryTargetPrice}
                  onChange={(e) => setInquiryTargetPrice(e.target.value)}
                  className="border-border"
                />
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <Label htmlFor="inquiryTimeline">
                  {locale === "vi" ? "Timeline cần hàng" : "Timeline"}
                </Label>
                <Input
                  id="inquiryTimeline"
                  placeholder={locale === "vi" ? "VD: Cần chốt trong 2 tuần, giao Q4" : "E.g. Close within 2 weeks, ship Q4"}
                  value={inquiryTimeline}
                  onChange={(e) => setInquiryTimeline(e.target.value)}
                  className="border-border"
                />
              </div>

              {/* Channel */}
              <div className="space-y-2">
                <Label htmlFor="inquiryChannel">
                  {locale === "vi" ? "Kênh nhận nhu cầu" : "Inquiry channel"}
                </Label>
                <Select value={inquiryChannel} onValueChange={setInquiryChannel}>
                  <SelectTrigger id="inquiryChannel" className="border-border">
                    <SelectValue
                      placeholder={locale === "vi" ? "Chọn kênh..." : "Select channel..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">{locale === "vi" ? "Điện thoại" : "Phone"}</SelectItem>
                    <SelectItem value="zalo">Zalo</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="trade_fair">
                      {locale === "vi" ? "Hội chợ / Triển lãm" : "Trade fair"}
                    </SelectItem>
                    <SelectItem value="referral">
                      {locale === "vi" ? "Giới thiệu" : "Referral"}
                    </SelectItem>
                    <SelectItem value="other">{locale === "vi" ? "Khác" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="inquiryNotes">
                  {locale === "vi" ? "Ghi chú nhu cầu" : "Inquiry notes"}
                </Label>
                <Textarea
                  id="inquiryNotes"
                  placeholder={
                    locale === "vi"
                      ? 'VD: "Buyer gọi điện trực tiếp, đang thiếu nguồn cung gấp do supplier Chile trễ hàng. Ưu tiên sample nhanh."'
                      : 'E.g. "Buyer called directly, urgently short on supply because their Chilean supplier is late. Prioritize fast samples."'
                  }
                  value={inquiryNotes}
                  onChange={(e) => setInquiryNotes(e.target.value)}
                  rows={2}
                  className="resize-none border-border"
                />
              </div>
            </div>

            {isInquiryMissingDetails && (
              <div className="flex gap-2 rounded-sm bg-chart-5/10 p-2 text-xs text-chart-5">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>
                  {locale === "vi"
                    ? "⚠️ Nên nhập ít nhất sản phẩm, số lượng hoặc ghi chú — AE sẽ dựa vào dữ liệu này thay vì phải hỏi lại buyer."
                    : "⚠️ Enter at least products, quantity or notes — the AE will rely on this instead of re-asking the buyer."}
                </p>
              </div>
            )}
          </CardContent>
        )}
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
