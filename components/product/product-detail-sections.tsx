import { Boxes, CreditCard, Warehouse, Tag, Sparkles, type LucideIcon } from "lucide-react"
import type { ClientProduct } from "@/lib/supabase/types"

export function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: LucideIcon
}) {
  return (
    <div className="bg-background border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold leading-snug">{value}</p>
    </div>
  )
}

/** Order Terms (MOQ, lead time, samples) & Trade Terms (incoterm, payment) — shown in the info column */
export function ProductOrderTradeInfo({ product }: { product: ClientProduct }) {
  const hasOrderTerms = Boolean(product.moq_value || product.lead_time || product.sample_available)
  const hasTradeTerms = Boolean(product.incoterm || product.payment_terms)

  if (!hasOrderTerms && !hasTradeTerms) return null

  return (
    <div className="space-y-5">
      {hasOrderTerms && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Boxes className="w-4 h-4" />
            Order Terms
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {product.moq_value != null && (
              <InfoTile
                label="MOQ"
                value={`${product.moq_value.toLocaleString()}${product.moq_unit ? ` ${product.moq_unit}` : ""}`}
              />
            )}
            {product.lead_time && <InfoTile label="Lead Time" value={product.lead_time} />}
            {product.sample_available && <InfoTile label="Samples" value="Available" />}
          </div>
          {product.sample_available && product.sample_notes && (
            <p className="text-xs text-muted-foreground mt-2">{product.sample_notes}</p>
          )}
        </div>
      )}

      {hasTradeTerms && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Trade Terms
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {product.incoterm && (
              <InfoTile
                label="Incoterm"
                value={product.incoterm_place ? `${product.incoterm} — ${product.incoterm_place}` : product.incoterm}
              />
            )}
            {product.payment_terms && <InfoTile label="Payment Terms" value={product.payment_terms} />}
          </div>
        </div>
      )}
    </div>
  )
}

/** Key specs, packaging/storage, and private label — shown full-width near the description */
export function ProductPackagingAndSpecs({ product }: { product: ClientProduct }) {
  const hasPackaging = Boolean(
    product.packing || product.package_size || product.shelf_life || product.storage_conditions
  )

  if (!product.key_specifications && !hasPackaging && !product.private_label_available) {
    return null
  }

  return (
    <>
      {product.key_specifications && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Key Specifications</h2>
          <p className="text-muted-foreground leading-relaxed text-pretty">{product.key_specifications}</p>
        </div>
      )}

      {hasPackaging && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Warehouse className="w-5 h-5" />
            Packaging & Storage
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {product.packing && <InfoTile label="Packing" value={product.packing} />}
            {product.package_size && <InfoTile label="Package Size" value={product.package_size} />}
            {product.shelf_life && <InfoTile label="Shelf Life" value={product.shelf_life} />}
            {product.storage_conditions && <InfoTile label="Storage" value={product.storage_conditions} />}
          </div>
        </div>
      )}

      {product.private_label_available && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Private Label / OEM
          </h2>
          <div className="flex items-start gap-3 bg-muted/50 border rounded-lg p-4">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Private label / OEM packaging supported</p>
              {product.private_label_notes && (
                <p className="text-sm text-muted-foreground mt-1">{product.private_label_notes}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
