import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Package, ShieldCheck, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ClientProduct } from "@/lib/supabase/types"

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

const COMPLIANCE_BADGE_LABELS: Record<string, string> = {
  fda: "FDA",
  coa: "COA",
  organic: "Organic",
  fsvp: "FSVP",
  halal: "Halal",
  kosher: "Kosher",
  brcgs: "BRCGS",
  haccp: "HACCP",
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

function formatCapacity(units: number | null, uom: string): string | null {
  if (!units) return null
  return `${units.toLocaleString()} ${uom}/month`
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from("client_products")
    .select(
      `
      *,
      client:client_id(
        id,
        company_name,
        trading_name,
        client_profiles(slug)
      )
    `
    )
    .eq("id", id)
    .single()

  if (error || !product) {
    notFound()
  }

  const typedProduct = product as ClientProduct & {
    client: { 
      id: string
      company_name: string
      trading_name: string
      client_profiles: { slug: string }[] | null 
    } | null
  }
  
  const profileSlug = typedProduct.client?.client_profiles?.[0]?.slug

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Link
            href={profileSlug ? `/profile/${profileSlug}` : "#"}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </Link>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {typedProduct.product_name}
          </h1>
          {typedProduct.category && (
            <p className="text-sm text-muted-foreground mt-2">
              Category: <span className="font-medium">{typedProduct.category}</span>
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Images */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {typedProduct.image_urls && typedProduct.image_urls.length > 0 ? (
                <>
                  {/* Main Image */}
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={typedProduct.image_urls[0]}
                      alt={typedProduct.product_name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Thumbnails */}
                  {typedProduct.image_urls.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {typedProduct.image_urls.slice(0, 4).map((url, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square bg-muted rounded-lg overflow-hidden border-2 border-transparent hover:border-primary cursor-pointer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${typedProduct.product_name} ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <Package className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Price & Capacity */}
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Price per Unit</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatPrice(typedProduct.min_unit_price, typedProduct.max_unit_price, typedProduct.currency) ||
                    "N/A"}
                </p>
              </div>

              {formatCapacity(typedProduct.monthly_capacity_units, typedProduct.unit_of_measure) && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Monthly Capacity</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCapacity(
                      typedProduct.monthly_capacity_units,
                      typedProduct.unit_of_measure
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {typedProduct.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p className="text-foreground leading-relaxed">{typedProduct.description}</p>
              </div>
            )}

            {/* Compliance Badges */}
            {typedProduct.compliance_badges && typedProduct.compliance_badges.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {typedProduct.compliance_badges.map((badge) => (
                    <Badge
                      key={badge}
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      {COMPLIANCE_BADGE_LABELS[badge] || badge.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* HS Code */}
            {typedProduct.hs_code && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">HS Code</p>
                <p className="font-mono text-sm text-foreground">{typedProduct.hs_code}</p>
              </div>
            )}

            {/* Status */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Badge
                variant={typedProduct.status === "active" ? "default" : "secondary"}
                className={
                  typedProduct.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                {typedProduct.status === "active"
                  ? "Active"
                  : typedProduct.status === "inactive"
                    ? "Inactive"
                    : "Suspended"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
