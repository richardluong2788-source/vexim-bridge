import { notFound } from "next/navigation"
import { cache } from "react"
import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
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
import { siteConfig } from "@/lib/site-config"
import { formatPrice, toMetaDescription } from "@/lib/product-format"
import { localizedAlternates, INDEXABLE } from "@/lib/seo/alternates"
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/catalog/cache"
import { JsonLd } from "@/components/seo/json-ld"
import { ProductImageGallery } from "@/components/product"
import { ProductRequestQuoteDialog } from "@/components/product"
import { ProductMarkdown } from "@/components/product"
import { InfoTile, ProductOrderTradeInfo, ProductPackagingAndSpecs } from "@/components/product"

interface PageProps {
  params: Promise<{ id: string }>
}

// Real ISR now: the root layout no longer reads cookies, and `?ref=` (quote
// attribution) is decoded inside the quote dialog, so nothing in this route
// touches a per-request API. Next prerenders it at build time for the ids from
// generateStaticParams() and for every other product on first request, caches
// the HTML on the CDN for five minutes, and revalidates in the
// background. Saving a product or publishing a profile calls revalidateCatalog()
// (lib/catalog/cache.ts), which busts both this document and the data below.
// Must stay in step with CATALOG_REVALIDATE_SECONDS (the TTL of the data below):
// Next only accepts a literal for a segment config, so it cannot reference the const.
export const revalidate = 300

// Prerender the freshest catalog pages at build so the first US buyer to arrive
// does not wait on a cold render + Postgres round-trip. Bounded on purpose:
// the point is a warm cache for what a crawler reaches first, not a full copy
// of the catalog. Anything not listed here is rendered on demand instead.
const PRERENDER_PRODUCT_COUNT = 200

/** Keep in step with the catalog index's supplier scan limit. */
const SUPPLIER_SCAN_LIMIT = 500

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

/**
 * Product row + the public identity of its supplier.
 *
 * Two layers of de-duplication: `unstable_cache` (5 minutes, `CATALOG_CACHE_TAG`)
 * so a crawler sweeping the catalog does not hit Postgres per URL, and React
 * `cache()` so `generateMetadata` and the page body share one pass per request.
 *
 * The read deliberately uses the service-role client instead of the session
 * client: the page is one document for an anonymous buyer, a supplier previewing
 * their own listing and an AE opening a tracked link, and cookies on a public
 * page would both defeat caching and change what a preview shows. Because RLS no
 * longer filters for us, the visibility rules the anon policy enforced are stated
 * here: only `status = 'active'` products, and the supplier link only for a
 * published profile. Never widen this `select("*")` by joining `profiles` beyond
 * (id, company_name) — that is how `/api/products/search` ended up exposing
 * supplier emails and FDA registration numbers to anonymous callers.
 *
 * A non-active product therefore returns 404 rather than a preview; the admin and
 * client product dialogs render the row themselves, so nothing internal depends
 * on this URL for editing.
 */
const loadPublicProductUncached = async (id: string) => {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (cause) {
    console.error("[catalog] supabase client unavailable:", cause)
    return null
  }

  const { data, error } = await supabase
    .from("client_products")
    .select(
      `
      *,
      client:client_id (
        id,
        company_name
      )
    `,
    )
    .eq("id", id)
    .eq("status", "active")
    .single()

  if (error || !data) return null

  const clientId = (data as { client_id?: string }).client_id
  let profileSlug: string | null = null
  let profileUpdatedAt: string | null = null
  if (clientId) {
    const { data: clientProfile } = await supabase
      .from("client_profiles")
      .select("slug, updated_at")
      .eq("client_id", clientId)
      .eq("is_published", true)
      .single()
    profileSlug = clientProfile?.slug ?? null
    profileUpdatedAt = clientProfile?.updated_at ?? null
  }

  const product = data as unknown as ClientProduct & {
    client: { id: string; company_name: string } | null
  }

  // `created_by` is an internal profile id; it has no business in the HTML or in
  // the RSC payload of a public page.
  const { created_by: _createdBy, ...publicProduct } = product

  return {
    product: publicProduct as ClientProduct & { client: typeof product.client },
    profileSlug,
    profileUpdatedAt,
  }
}

const loadPublicProductCached = unstable_cache(loadPublicProductUncached, ["catalog-product"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CATALOG_CACHE_TAG],
})

const loadPublicProduct = cache(loadPublicProductCached)

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Same visibility rules as the catalog index and the page body: only active
  // products of suppliers who publish a profile may be prerendered.
  try {
    const admin = createAdminClient()
    const { data: supplierData } = await admin
      .from("client_profiles")
      .select("client_id")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(SUPPLIER_SCAN_LIMIT)

    const clientIds = [
      ...new Set(
        (supplierData ?? [])
          .map((row: { client_id?: string | null }) => row.client_id)
          .filter((value: string | null | undefined): value is string => Boolean(value))
      ),
    ]
    if (clientIds.length === 0) return []

    const { data, error } = await admin
      .from("client_products")
      .select("id")
      .eq("status", "active")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(PRERENDER_PRODUCT_COUNT)

    if (error || !data) return []
    return (data as Array<{ id: string }>).map((row) => ({ id: row.id }))
  } catch (cause) {
    // A build without database access (CI, a preview without secrets) still has
    // to succeed: products not prerendered are simply rendered on demand.
    console.error("[catalog] prerender list unavailable:", cause)
    return []
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const loaded = await loadPublicProduct(id)

  if (!loaded) {
    return {
      title: `Product not found — ${siteConfig.name}`,
      robots: { index: false, follow: true },
    }
  }

  const { product } = loaded
  const supplier = product.client?.company_name
  const title = supplier
    ? `${product.product_name} — ${supplier}`
    : `${product.product_name} — ${siteConfig.name}`
  const price = formatPrice(product.min_unit_price, product.max_unit_price, product.currency)
  const summary = [
    supplier ? `${supplier} (Vietnam)` : null,
    product.category ?? null,
    price ? `Indicative price ${price} per ${product.unit_of_measure}` : null,
    product.moq_value ? `MOQ ${product.moq_value} ${product.moq_unit ?? product.unit_of_measure}` : null,
    product.lead_time ? `Lead time ${product.lead_time}` : null,
  ]
    .filter(Boolean)
    .join(". ")
  const description = summary
    ? toMetaDescription(`${summary}. ${product.usp ?? product.description ?? ""}`)
    : toMetaDescription(product.description)
  const ogImage = product.image_urls?.find((url) => url.startsWith("http"))

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/products/${id}`,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, alt: product.product_name }] } : {}),
    },
    alternates: localizedAlternates(`/products/${id}`),
    robots: INDEXABLE,
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params

  const loaded = await loadPublicProduct(id)

  if (!loaded) {
    notFound()
  }

  const { product: typedProduct, profileSlug } = loaded!

  const companyName = typedProduct.client?.company_name
  const priceDisplay = formatPrice(
    typedProduct.min_unit_price,
    typedProduct.max_unit_price,
    typedProduct.currency
  )

  // schema.org/Product so a Google shopping/industrial listing shows price,
  // supplier and availability instead of a bare snippet. Every value below is
  // supplier-authored, which is why it is rendered through <JsonLd> (it escapes
  // < and > so a "</script>" inside a product description cannot break out).
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: typedProduct.product_name,
    description: toMetaDescription(typedProduct.usp || typedProduct.description),
    ...(typedProduct.image_urls?.length ? { image: typedProduct.image_urls } : {}),
    ...(typedProduct.product_code ? { sku: typedProduct.product_code } : {}),
    ...(typedProduct.hs_code ? { mpn: typedProduct.hs_code } : {}),
    ...(companyName
      ? {
          brand: {
            "@type": "Organization",
            name: companyName,
            ...(profileSlug ? { url: `${siteConfig.url}/profile/${profileSlug}` } : {}),
          },
        }
      : {}),
    ...(priceDisplay && typedProduct.min_unit_price
      ? {
          offers: {
            "@type": "Offer",
            // A published price range is announced at its floor: schema.org has
            // no "from" price, and quoting the top of the range would make the
            // listing look more expensive than the supplier's own page.
            price: typedProduct.min_unit_price,
            priceCurrency: typedProduct.currency,
            availability: "https://schema.org/InStock",
            url: `${siteConfig.url}/products/${id}`,
          },
        }
      : {}),
  }

  return (
    <main lang="en" className="min-h-screen bg-background">
      <JsonLd data={productJsonLd} id="product-json-ld" />

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/products" className="hover:text-foreground transition-colors">
              Export catalog
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
          
          {/* Left: Images Gallery with Verification Badge */}
          <div className="relative">
            {/* Verification badge - top right overlay */}
            <div className="absolute top-3 right-3 z-20">
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-emerald-800">Screened Supplier</span>
              </div>
            </div>
            <ProductImageGallery 
              images={typedProduct.image_urls || []} 
              productName={typedProduct.product_name} 
            />
            {/* Verification details under gallery */}
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Verification</p>
                <Link href="/how-we-verify" className="text-[11px] font-medium text-primary hover:text-cta">How we verify →</Link>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Company information reviewed</div>
                <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Production capability reviewed</div>
                <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Export history reviewed</div>
                <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Certifications reviewed</div>
                <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> U.S. regulatory requirements reviewed</div>
              </div>
              {loaded.profileUpdatedAt && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Last reviewed: {new Date(loaded.profileUpdatedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                Commercial participation does not replace screening. FDA registration is not FDA approval.
              </p>
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Verification badge - top right for product info */}
            <div className="flex items-center justify-between gap-3">
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
              {/* Top-right verification pill */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                <span className="text-[11px] font-semibold text-emerald-800">Screened</span>
              </div>
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
