"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Save,
  Eye,
  Globe,
  EyeOff,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createClientProfile,
  updateClientProfile,
  publishProfile,
  unpublishProfile,
  checkSlugAvailability,
} from "@/lib/profile/actions"
import { generateSlug } from "@/lib/profile/utils"
import type {
  ClientProfileWithRelations,
  ComplianceDoc,
  ClientProduct,
  USPPoint,
} from "@/lib/supabase/types"

interface AdminProfileManagerProps {
  clientId: string
  clientName: string
  existingProfile?: ClientProfileWithRelations
  availableDocs: ComplianceDoc[]
  availableProducts: ClientProduct[]
  t?: any
}

const ICON_OPTIONS = [
  { value: "clock", label: "Clock (Experience)" },
  { value: "award", label: "Award (Quality)" },
  { value: "globe", label: "Globe (Export)" },
  { value: "factory", label: "Factory (Production)" },
  { value: "shield", label: "Shield (Safety)" },
  { value: "leaf", label: "Leaf (Organic)" },
  { value: "check", label: "Check (Certified)" },
  { value: "star", label: "Star (Excellence)" },
  { value: "users", label: "Users (Team)" },
  { value: "trending", label: "Trending (Growth)" },
]

export function AdminProfileManager({
  clientId,
  clientName,
  existingProfile,
  availableDocs,
  availableProducts,
  t,
}: AdminProfileManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  // Use provided translations
  const trans = t

  // Form state
  const [slug, setSlug] = useState(existingProfile?.slug || generateSlug(clientName))
  const [displayName, setDisplayName] = useState(existingProfile?.display_name || clientName)
  const [tagline, setTagline] = useState(existingProfile?.tagline || "")
  const [coverImageUrl, setCoverImageUrl] = useState(existingProfile?.cover_image_url || "")
  const [logoUrl, setLogoUrl] = useState(existingProfile?.logo_url || "")
  const [videoUrl, setVideoUrl] = useState(existingProfile?.video_url || "")
  const [uspPoints, setUspPoints] = useState<USPPoint[]>(
    existingProfile?.usp_points || [{ title: "", icon: "check" }]
  )
  const [productionCapacity, setProductionCapacity] = useState(
    existingProfile?.production_capacity || ""
  )
  const [moq, setMoq] = useState(existingProfile?.moq || "")
  const [leadTime, setLeadTime] = useState(existingProfile?.lead_time_days || "")
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>(
    existingProfile?.featured_certifications || []
  )
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    existingProfile?.featured_products || []
  )
  const [enableRequestQuote, setEnableRequestQuote] = useState(
    existingProfile?.enable_request_quote ?? true
  )
  const [enableDownloadPdf, setEnableDownloadPdf] = useState(
    existingProfile?.enable_download_pdf ?? false
  )
  const [pdfUrl, setPdfUrl] = useState(existingProfile?.pdf_capability_url || "")

  const isPublished = existingProfile?.is_published ?? false
  const profileUrl = existingProfile?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/profile/${existingProfile.slug}`
    : null

  // Add USP point
  const addUspPoint = () => {
    if (uspPoints.length < 4) {
      setUspPoints([...uspPoints, { title: "", icon: "check" }])
    }
  }

  // Remove USP point
  const removeUspPoint = (index: number) => {
    setUspPoints(uspPoints.filter((_, i) => i !== index))
  }

  // Update USP point
  const updateUspPoint = (index: number, field: keyof USPPoint, value: string) => {
    const updated = [...uspPoints]
    updated[index] = { ...updated[index], [field]: value }
    setUspPoints(updated)
  }

  // Toggle certification
  const toggleCertification = (id: string) => {
    setSelectedCertifications((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  // Toggle product
  const toggleProduct = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== id))
    } else if (selectedProducts.length < 6) {
      setSelectedProducts([...selectedProducts, id])
    }
  }

  // Copy URL
  const copyUrl = async () => {
    if (profileUrl) {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success(trans?.status?.copyUrl || "URL copied to clipboard")
    }
  }

  // Save profile
  const handleSave = () => {
    startTransition(async () => {
      // Validate slug
      const slugCheck = await checkSlugAvailability(slug, existingProfile?.id)
      if (!slugCheck.available) {
        toast.error(trans?.status?.slugTaken || "Slug is already taken. Please choose a different one.")
        return
      }

      // Filter valid USP points
      const validUspPoints = uspPoints.filter((p) => p.title.trim())

      const data = {
        slug,
        display_name: displayName || undefined,
        tagline: tagline || undefined,
        cover_image_url: coverImageUrl || undefined,
        logo_url: logoUrl || undefined,
        video_url: videoUrl || undefined,
        usp_points: validUspPoints,
        production_capacity: productionCapacity || undefined,
        moq: moq || undefined,
        lead_time_days: leadTime || undefined,
        featured_certifications: selectedCertifications,
        featured_products: selectedProducts,
        enable_request_quote: enableRequestQuote,
        enable_download_pdf: enableDownloadPdf,
        pdf_capability_url: pdfUrl || undefined,
      }

      let result
      if (existingProfile) {
        result = await updateClientProfile(existingProfile.id, data)
      } else {
        result = await createClientProfile({ client_id: clientId, ...data })
      }

      if (result.success) {
        toast.success(existingProfile ? (trans?.status?.updateSuccess || "Profile updated") : (trans?.status?.createSuccess || "Profile created"))
        router.refresh()
      } else {
        toast.error(result.error || trans?.status?.saveFailed || "Failed to save profile")
      }
    })
  }

  // Toggle publish
  const handleTogglePublish = () => {
    if (!existingProfile) return

    startTransition(async () => {
      const result = isPublished
        ? await unpublishProfile(existingProfile.id)
        : await publishProfile(existingProfile.id)

      if (result.success) {
        toast.success(isPublished ? (trans?.status?.unpublishSuccess || "Profile unpublished") : (trans?.status?.publishSuccess || "Profile published"))
        router.refresh()
      } else {
        toast.error(result.error || trans?.status?.updateFailed || "Failed to update publish status")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Status bar — always visible so admins can see publish state / know to save first */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {existingProfile ? (
                <Badge variant={isPublished ? "default" : "secondary"}>
                  {isPublished ? (
                    <>
                      <Globe className="w-3 h-3 mr-1" />
                      {trans?.status?.published || "Published"}
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      {trans?.status?.draft || "Draft"}
                    </>
                  )}
                </Badge>
              ) : (
                <Badge variant="outline">
                  <EyeOff className="w-3 h-3 mr-1" />
                  {trans?.status?.notSaved || "Not saved yet"}
                </Badge>
              )}
              {profileUrl && isPublished && (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    /profile/{existingProfile?.slug}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyUrl}>
                    {copied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </div>
              )}
              {!existingProfile && (
                <p className="text-xs text-muted-foreground">
                  {trans?.status?.saveFirstHint ||
                    "Save the profile below before you can publish it."}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePublish}
                disabled={isPending || !existingProfile}
                title={
                  !existingProfile
                    ? trans?.status?.saveFirstHint || "Save the profile below before you can publish it."
                    : undefined
                }
              >
                {isPublished ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-1" />
                    {trans?.status?.unpublish || "Unpublish"}
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-1" />
                    {trans?.status?.publish || "Publish"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.basicInfo?.title || "Basic Information"}</CardTitle>
          <CardDescription>{trans?.basicInfo?.subtitle || "Company name and URL settings"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">{trans?.basicInfo?.slug || "URL Slug"}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder={trans?.basicInfo?.slugPlaceholder || "company-name"}
              />
              <p className="text-xs text-muted-foreground">
                {(trans?.basicInfo?.profileUrl || "Profile URL: /profile/{slug}").replace("{slug}", slug || "...")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">{trans?.basicInfo?.displayName || "Display Name"}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={trans?.basicInfo?.displayNamePlaceholder || "Company Name"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">{trans?.basicInfo?.tagline || "Tagline"}</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={trans?.basicInfo?.taglinePlaceholder || "Your company's value proposition..."}
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.branding?.title || "Branding"}</CardTitle>
          <CardDescription>{trans?.branding?.subtitle || "Cover image, logo, and video"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coverUrl">{trans?.branding?.coverImage || "Cover Image URL"}</Label>
              <Input
                id="coverUrl"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder={trans?.branding?.urlPlaceholder || "https://..."}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">{trans?.branding?.logo || "Logo URL"}</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder={trans?.branding?.urlPlaceholder || "https://..."}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">{trans?.branding?.video || "Factory Video URL (YouTube or direct)"}</Label>
            <Input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={trans?.branding?.videoPlaceholder || "https://youtube.com/watch?v=..."}
            />
          </div>
        </CardContent>
      </Card>

      {/* USP Points */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.usp?.title || "Why Choose Us (USP)"}</CardTitle>
          <CardDescription>{trans?.usp?.subtitle || "3-4 key selling points (max 4)"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uspPoints.map((point, index) => (
            <div key={index} className="flex items-start gap-3">
              <Select
                value={point.icon}
                onValueChange={(val) => updateUspPoint(index, "icon", val)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={point.title}
                onChange={(e) => updateUspPoint(index, "title", e.target.value)}
                placeholder={trans?.usp?.placeholder || "e.g., 20 years export experience"}
                className="flex-1"
              />

              {uspPoints.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeUspPoint(index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}

          {uspPoints.length < 4 && (
            <Button variant="outline" size="sm" onClick={addUspPoint}>
              <Plus className="w-4 h-4 mr-1" />
              {trans?.usp?.addPoint || "Add Point"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Production Stats */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.production?.title || "Production Capability"}</CardTitle>
          <CardDescription>{trans?.production?.subtitle || "Key statistics for buyers"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">{trans?.production?.capacity || "Production Capacity"}</Label>
              <Input
                id="capacity"
                value={productionCapacity}
                onChange={(e) => setProductionCapacity(e.target.value)}
                placeholder={trans?.production?.capacityPlaceholder || "Up to 10 containers/month"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moq">{trans?.production?.moq || "Minimum Order (MOQ)"}</Label>
              <Input
                id="moq"
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                placeholder={trans?.production?.moqPlaceholder || "Flexible from 1 pallet"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="leadTime">{trans?.production?.leadTime || "Lead Time"}</Label>
              <Input
                id="leadTime"
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                placeholder={trans?.production?.leadTimePlaceholder || "25-30 days"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Featured Certifications */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.certifications?.title || "Featured Certifications"}</CardTitle>
          <CardDescription>{trans?.certifications?.subtitle || "Select certificates to display on the profile"}</CardDescription>
        </CardHeader>
        <CardContent>
          {availableDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {trans?.certifications?.noCerts || "No certifications uploaded yet. Upload documents in the Compliance tab."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox
                    id={`cert-${doc.id}`}
                    checked={selectedCertifications.includes(doc.id)}
                    onCheckedChange={() => toggleCertification(doc.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`cert-${doc.id}`} className="text-sm font-medium cursor-pointer">
                      {doc.title || doc.kind}
                    </Label>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {doc.kind}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Featured Products */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.products?.title || "Featured Products"}</CardTitle>
          <CardDescription>{trans?.products?.subtitle || "Select up to 6 products to showcase"}</CardDescription>
        </CardHeader>
        <CardContent>
          {availableProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {trans?.products?.noProducts || "No products added yet. Add products in the Products tab."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox
                    id={`prod-${product.id}`}
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                    disabled={
                      !selectedProducts.includes(product.id) && selectedProducts.length >= 6
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`prod-${product.id}`} className="text-sm font-medium cursor-pointer">
                      {product.product_name}
                    </Label>
                    {product.category && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {product.category}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{trans?.cta?.title || "Call-to-Action"}</CardTitle>
          <CardDescription>{trans?.cta?.subtitle || "Configure buttons on the profile page"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enableQuote">{trans?.cta?.enableQuote || "Enable Request Quote"}</Label>
              <p className="text-xs text-muted-foreground">
                {trans?.cta?.enableQuoteDesc || "Allow buyers to submit quote requests"}
              </p>
            </div>
            <Switch
              id="enableQuote"
              checked={enableRequestQuote}
              onCheckedChange={setEnableRequestQuote}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enablePdf">{trans?.cta?.enablePdf || "Enable Download PDF"}</Label>
              <p className="text-xs text-muted-foreground">
                {trans?.cta?.enablePdfDesc || "Allow buyers to download capability PDF"}
              </p>
            </div>
            <Switch
              id="enablePdf"
              checked={enableDownloadPdf}
              onCheckedChange={setEnableDownloadPdf}
            />
          </div>

          {enableDownloadPdf && (
            <div className="space-y-2">
              <Label htmlFor="pdfUrl">{trans?.cta?.pdfUrl || "PDF URL"}</Label>
              <Input
                id="pdfUrl"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder={trans?.branding?.urlPlaceholder || "https://..."}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <a
            href={profileUrl || `/profile/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye className="w-4 h-4 mr-2" />
            {trans?.actions?.preview || "Preview"}
          </a>
        </Button>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {trans?.actions?.saving || "Saving..."}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {trans?.actions?.save || "Save Profile"}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
