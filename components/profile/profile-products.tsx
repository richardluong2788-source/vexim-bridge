"use client"

import Image from "next/image"
import { Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ClientProfileWithRelations, ClientProduct } from "@/lib/supabase/types"

interface ProfileProductsProps {
  profile: ClientProfileWithRelations
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
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.product_name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
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
