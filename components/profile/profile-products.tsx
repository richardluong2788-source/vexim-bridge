"use client"

import { Package, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ClientProfileWithRelations, ClientProduct } from "@/lib/supabase/types"
import { getProxiedBlobUrl } from "@/lib/blob-utils"

interface ProfileProductsProps {
  profile: ClientProfileWithRelations
}

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

export function ProfileProducts({ profile }: ProfileProductsProps) {
  const products = profile.products || []

  if (products.length === 0) return null

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-8 text-center">
          Featured Products
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {products.slice(0, 6).map((product: ClientProduct) => (
            <Card
              key={product.id}
              className="group overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                {product.image_urls && product.image_urls.length > 0 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={getProxiedBlobUrl(product.image_urls[0])}
                    alt={product.product_name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50">
                    <Package className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}

                {/* Category Badge */}
                {product.category && (
                  <div className="absolute top-3 left-3">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                      {product.category}
                    </Badge>
                  </div>
                )}

                {/* Image count indicator */}
                {product.image_urls && product.image_urls.length > 1 && (
                  <div className="absolute bottom-3 right-3">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs">
                      +{product.image_urls.length - 1} more
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                  {product.product_name}
                </h3>

                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Compliance Badges */}
                {product.compliance_badges && product.compliance_badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.compliance_badges.slice(0, 4).map((badge) => (
                      <Badge
                        key={badge}
                        variant="outline"
                        className="text-xs bg-green-50 text-green-700 border-green-200"
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        {COMPLIANCE_BADGE_LABELS[badge] || badge.toUpperCase()}
                      </Badge>
                    ))}
                    {product.compliance_badges.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{product.compliance_badges.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {formatPrice(product.min_unit_price, product.max_unit_price, product.currency) && (
                    <Badge variant="outline" className="text-accent border-accent/30">
                      {formatPrice(product.min_unit_price, product.max_unit_price, product.currency)}
                    </Badge>
                  )}

                  {formatCapacity(product.monthly_capacity_units, product.unit_of_measure) && (
                    <Badge variant="outline">
                      {formatCapacity(product.monthly_capacity_units, product.unit_of_measure)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
