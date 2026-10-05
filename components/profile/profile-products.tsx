"use client"

import Link from "next/link"
import { Package, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n/config"
import { getProfileCopy } from "@/lib/profile/translations"
import type { ClientProfileWithRelations, ClientProduct } from "@/lib/supabase/types"
import { markdownToPlainText } from "@/lib/markdown-preview"
import { formatPrice } from "@/lib/product-format"

interface ProfileProductsProps {
  profile: ClientProfileWithRelations
  locale: Locale
}

function formatCapacity(units: number | null, unitOfMeasure: string, locale: Locale): string | null {
  if (!units) return null

  const copy = getProfileCopy(locale)
  const formattedUnits = units.toLocaleString(copy.products.numberLocale)
  const unit = unitOfMeasure.trim()
  return `${formattedUnits}${unit ? ` ${unit}` : ""}/${copy.products.month}`
}

export function ProfileProducts({ profile, locale }: ProfileProductsProps) {
  const copy = getProfileCopy(locale)
  const products = profile.products || []

  if (products.length === 0) return null

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-8 text-center">
          {copy.products.heading}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {products.slice(0, 6).map((product: ClientProduct) => {
            const price = formatPrice(
              product.min_unit_price,
              product.max_unit_price,
              product.currency,
              copy.products.numberLocale,
            )
            const capacity = formatCapacity(
              product.monthly_capacity_units,
              product.unit_of_measure,
              locale,
            )

            return (
              <Link href={`/products/${product.id}`} key={product.id}>
                <Card className="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col !p-0 !gap-0">
                  {/* Product image */}
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden flex-shrink-0">
                    {product.image_urls && product.image_urls.length > 0 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={product.image_urls[0]}
                        alt={product.product_name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50">
                        <Package className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Category badge; the category itself is supplier-provided data. */}
                    {product.category && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                          {copy.products.categories[product.category] ?? product.category}
                        </Badge>
                      </div>
                    )}

                    {product.image_urls && product.image_urls.length > 1 && (
                      <div className="absolute bottom-3 right-3">
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs">
                          {copy.products.moreImages(product.image_urls.length - 1)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                      {product.product_name}
                    </h3>

                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {markdownToPlainText(product.description)}
                      </p>
                    )}

                    {product.compliance_badges && product.compliance_badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {product.compliance_badges.slice(0, 4).map((badge) => (
                          <Badge
                            key={badge}
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-200"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            {copy.products.complianceBadges[badge] || badge.toUpperCase()}
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
                      {price && (
                        <Badge variant="outline" className="text-accent border-accent/30">
                          {price}
                        </Badge>
                      )}
                      {capacity && <Badge variant="outline">{capacity}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
