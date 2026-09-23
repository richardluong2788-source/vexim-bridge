import Link from "next/link"
import { Building2, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { COMPLIANCE_BADGES } from "@/lib/constants/product-options"
import { formatMoq, formatPrice } from "@/lib/product-format"
import { cn } from "@/lib/utils"

/**
 * Labels for the `compliance_badges` codes stored on `client_products`.
 * Derived from the canonical option list so the catalog can never invent a
 * certification the intake forms do not offer.
 */
const COMPLIANCE_LABELS: Record<string, string> = Object.fromEntries(
  COMPLIANCE_BADGES.map((badge) => [badge.value, badge.label]),
)

/** Row shape this card needs — a strict subset of a `client_products` row. */
export interface CatalogProduct {
  id: string
  product_name: string
  product_code?: string | null
  category?: string | null
  subcategory?: string | null
  unit_of_measure?: string | null
  min_unit_price?: number | null
  max_unit_price?: number | null
  currency?: string | null
  image_urls?: string[] | null
  compliance_badges?: string[] | null
  moq_value?: number | null
  moq_unit?: string | null
  sample_available?: boolean | null
  lead_time?: string | null
}

export interface ProductCardProps {
  product: CatalogProduct
  /** Supplier display name (client_profiles.display_name ?? profiles.company_name). */
  supplierName: string | null
  /** Public profile slug, or null when the supplier is not published. */
  supplierSlug?: string | null
  className?: string
}

/**
 * One product in a buyer-facing grid (`/products`, and reused anywhere the
 * catalog is embedded).
 *
 * The card itself is not an `<a>` — the whole surface is clickable through the
 * title link's stretched pseudo-element (`after:absolute after:inset-0`), which
 * keeps the supplier link a separate, valid anchor instead of nesting anchors.
 */
export function ProductCard({ product, supplierName, supplierSlug, className }: ProductCardProps) {
  const image = product.image_urls?.[0] ?? null
  const price = formatPrice(product.min_unit_price, product.max_unit_price, product.currency ?? "USD")
  const moq = formatMoq(product.moq_value, product.moq_unit)
  const badges = (product.compliance_badges ?? []).slice(0, 2)
  const extraBadges = Math.max(0, (product.compliance_badges?.length ?? 0) - badges.length)

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.product_name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
            <Package className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {supplierName ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {supplierSlug ? (
              <Link
                href={`/profile/${supplierSlug}`}
                className="relative z-10 truncate hover:text-foreground hover:underline"
              >
                {supplierName}
              </Link>
            ) : (
              <span className="truncate">{supplierName}</span>
            )}
          </div>
        ) : null}

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          <Link
            href={`/products/${product.id}`}
            className="after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {product.product_name}
          </Link>
        </h3>

        {(product.category || product.subcategory) && (
          <p className="truncate text-xs text-muted-foreground">
            {[product.category, product.subcategory].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-auto space-y-2 pt-2">
          {price ? (
            <p className="text-sm font-semibold text-primary">
              {price}
              {product.unit_of_measure ? (
                <span className="font-normal text-muted-foreground"> / {product.unit_of_measure}</span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Price on request</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {moq ? <span>MOQ {moq}</span> : null}
            {product.lead_time ? <span>Lead time {product.lead_time}</span> : null}
            {product.sample_available ? <span>Samples available</span> : null}
          </div>

          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {badges.map((badge) => (
                <Badge key={badge} variant="secondary" className="text-[10px] font-medium">
                  {COMPLIANCE_LABELS[badge] ?? badge.toUpperCase()}
                </Badge>
              ))}
              {extraBadges > 0 ? (
                <Badge variant="outline" className="text-[10px] font-medium">
                  +{extraBadges}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
