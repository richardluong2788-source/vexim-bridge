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
    .select("*")
    .eq("id", id)
    .single()

  if (error || !product) {
    notFound()
  }

  const typedProduct = product as ClientProduct

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Link
            href={`/`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
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
            {typedProduct.image_urls && typedProduct.image_urls.length > 0 ? (
              <div className="space-y-4">
                {/* Main image */}
                <div className="relative w-full bg-muted rounded-lg overflow-hidden aspect-square">
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
                    {typedProduct.image_urls.map((url, idx) => (
                      <div key={idx} className="relative w-full bg-muted rounded overflow-hidden aspect-square">
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
              </div>
            ) : (
              <div className="w-full bg-muted rounded-lg flex items-center justify-center aspect-square">
                <Package className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Price */}
            {(typedProduct.min_unit_price || typedProduct.max_unit_price) && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Price per unit</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatPrice(
                    typedProduct.min_unit_price,
                    typedProduct.max_unit_price,
                    typedProduct.currency
                  )}
                </p>
              </div>
            )}

            {/* Capacity */}
            {typedProduct.monthly_capacity_units && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Capacity</p>
                <p className="font-medium">
                  {formatCapacity(typedProduct.monthly_capacity_units, typedProduct.unit_of_measure)}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <Badge
                variant={typedProduct.status === "active" ? "default" : "secondary"}
              >
                {typedProduct.status === "active" ? "Available" : "Not Available"}
              </Badge>
            </div>

            {/* Compliance */}
            {typedProduct.compliance_badges && typedProduct.compliance_badges.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Certifications</p>
                <div className="space-y-2">
                  {typedProduct.compliance_badges.map((badge) => (
                    <div key={badge} className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">
                        {COMPLIANCE_BADGE_LABELS[badge] || badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HS Code */}
            {typedProduct.hs_code && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">HS Code</p>
                <p className="font-mono text-sm">{typedProduct.hs_code}</p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {typedProduct.description && (
          <div className="mt-12 pt-8 border-t">
            <h2 className="text-lg font-semibold mb-4">Description</h2>
            <p className="text-foreground whitespace-pre-wrap">{typedProduct.description}</p>
          </div>
        )}
      </div>
    </main>
  )
}
