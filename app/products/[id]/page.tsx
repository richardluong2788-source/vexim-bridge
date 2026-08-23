import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  ShieldCheck, 
  ChevronRight, 
  Truck, 
  CheckCircle2,
  Mail,
  Building2,
  Package,
  Globe
} from "lucide-react"
import Link from "next/link"
import type { ClientProduct } from "@/lib/supabase/types"
import { ProductImageGallery } from "@/components/product"
import { ProductRequestQuoteDialog } from "@/components/product"
import { ProductMarkdown } from "@/components/product"
import { InfoTile, ProductOrderTradeInfo, ProductPackagingAndSpecs } from "@/components/product"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string }>
}

export const dynamic = "force-dynamic"

const COMPLIANCE_BADGE_LABELS: Record<string, { label: string; color: string }> = {
  fda: { label: "FDA Registered", color: "bg-blue-50 text-blue-700 border-blue-200" },
  coa: { label: "COA Available", color: "bg-purple-50 text-purple-700 border-purple-200" },
  organic: { label: "Organic Certified", color: "bg-green-50 text-green-700 border-green-200" },
  fsvp: { label: "FSVP Compliant", color: "bg-orange-50 text-orange-700 border-orange-200" },
  halal: { label: "Halal Certified", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  kosher: { label: "Kosher Certified", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  brcgs: { label: "BRCGS", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  haccp: { label: "HACCP", color: "bg-teal-50 text-teal-700 border-teal-200" },
}

function formatPrice(min: number | null, max: number | null, currency: string): string | null {
  if (!min && !max) return null

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n)

  if (min && max && min !== max) {
    return `${fmt(min)} - ${fmt(max)}`
  }
  return fmt(min || max || 0)
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { ref: trackingRef } = await searchParams

  // Decode tracking ref to get opportunity ID (if present)
  let opportunityId: string | null = null
  if (trackingRef) {
    try {
      opportunityId = atob(trackingRef)
    } catch {
      // Invalid base64, ignore
    }
  }

  const supabase = await createClient()

  // Fetch product with client info
  const { data: product, error } = await supabase
    .from("client_products")
    .select(`
      *,
      client:client_id(
        id,
        company_name
      )
    `)
    .eq("id", id)
    .single()

  if (error || !product) {
    notFound()
  }

  // Fetch client profile slug separately
  let profileSlug: string | null = null
  if (product.client_id) {
    const { data: clientProfile } = await supabase
      .from("client_profiles")
      .select("slug")
      .eq("client_id", product.client_id)
      .eq("is_published", true)
      .single()
    
    profileSlug = clientProfile?.slug ?? null
  }

  const typedProduct = product as ClientProduct & {
    client: {
      id: string
      company_name: string
    } | null
  }

  const companyName = typedProduct.client?.company_name
  const priceDisplay = formatPrice(
    typedProduct.min_unit_price,
    typedProduct.max_unit_price,
    typedProduct.currency
  )

  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            {typedProduct.category && (
              <>
                <span>{typedProduct.category}</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {typedProduct.product_name}
            </span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Left: Images Gallery */}
          <ProductImageGallery 
            images={typedProduct.image_urls || []} 
            productName={typedProduct.product_name} 
          />

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Category & Status */}
            <div className="flex items-center gap-3 flex-wrap">
              {typedProduct.category && (
                <Badge variant="secondary" className="text-xs">
                  {typedProduct.category}
                </Badge>
              )}
              {typedProduct.subcategory && (
                <Badge variant="outline" className="text-xs">
                  {typedProduct.subcategory}
                </Badge>
              )}
              <Badge
                variant={typedProduct.status === "active" ? "default" : "secondary"}
                className={typedProduct.status === "active" ? "bg-green-600" : ""}
              >
                {typedProduct.status === "active" ? "Available" : "Unavailable"}
              </Badge>
            </div>

            {/* Product Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {typedProduct.product_name}
            </h1>

            {/* Supplier */}
            {companyName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Supplied by</span>
                {profileSlug ? (
                  <Link 
                    href={`/profile/${profileSlug}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {companyName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{companyName}</span>
                )}
              </div>
            )}

            {/* Price */}
            {priceDisplay && (
              <div className="bg-muted/50 rounded-lg p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Unit Price</p>
                <p className="text-3xl font-bold text-primary">
                  {priceDisplay}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  per {typedProduct.unit_of_measure}
                </p>
              </div>
            )}

            {/* Quick Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {typedProduct.monthly_capacity_units && (
                <div className="bg-background border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Truck className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Monthly Capacity</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {typedProduct.monthly_capacity_units.toLocaleString()} {typedProduct.unit_of_measure}
                  </p>
                </div>
              )}
              {typedProduct.hs_code && (
                <div className="bg-background border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Package className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">HS Code</span>
                  </div>
                  <p className="text-lg font-semibold font-mono">
                    {typedProduct.hs_code}
                  </p>
                </div>
              )}
              {typedProduct.country_of_origin && (
                <div className="bg-background border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Origin</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {typedProduct.country_of_origin}
                  </p>
                </div>
              )}
            </div>

            {/* Order & Trade Terms */}
            <ProductOrderTradeInfo product={typedProduct} />

            {/* Certifications */}
            {typedProduct.compliance_badges && typedProduct.compliance_badges.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Certifications & Compliance
                </h3>
                <div className="flex flex-wrap gap-2">
                  {typedProduct.compliance_badges.map((badge) => {
                    const badgeInfo = COMPLIANCE_BADGE_LABELS[badge] || { 
                      label: badge.toUpperCase(), 
                      color: "bg-gray-50 text-gray-700 border-gray-200" 
                    }
                    return (
                      <span
                        key={badge}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${badgeInfo.color}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {badgeInfo.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* CTA Buttons */}
            <div className="space-y-3">
              <ProductRequestQuoteDialog
                productId={typedProduct.id}
                productName={typedProduct.product_name}
                clientId={typedProduct.client_id}
                opportunityRef={opportunityId}
              >
                <Button size="lg" className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  Request Quote
                </Button>
              </ProductRequestQuoteDialog>
              {profileSlug && (
                <Button variant="outline" size="lg" className="w-full" asChild>
                  <Link href={`/profile/${profileSlug}`}>
                    <Building2 className="w-4 h-4 mr-2" />
                    View Supplier Profile
                  </Link>
                </Button>
              )}
            </div>

            {/* Product Code */}
            {typedProduct.product_code && (
              <p className="text-xs text-muted-foreground">
                SKU: <span className="font-mono">{typedProduct.product_code}</span>
              </p>
            )}
          </div>
        </div>

        {/* Description & USP Section */}
        {(typedProduct.description || typedProduct.usp || typedProduct.key_specifications || typedProduct.packing || typedProduct.package_size || typedProduct.shelf_life || typedProduct.storage_conditions || typedProduct.private_label_available) && (
          <div className="mt-12 pt-8 border-t space-y-10">
            {typedProduct.description && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Product Description</h2>
                <ProductMarkdown content={typedProduct.description} />
              </div>
            )}

            {typedProduct.usp && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Key Highlights</h2>
                <ProductMarkdown content={typedProduct.usp} />
              </div>
            )}

            <ProductPackagingAndSpecs product={typedProduct} />
          </div>
        )}
      </div>
    </main>
  )
}
