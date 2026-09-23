import type { Metadata } from "next"
import Link from "next/link"
import { unstable_cache } from "next/cache"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronLeft, ChevronRight, Package, Search, Store, X } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDictionary } from "@/lib/i18n/server"
import { localizePath } from "@/lib/i18n/routing"
import { localizedAlternates, INDEXABLE } from "@/lib/seo/alternates"
import { siteConfig } from "@/lib/site-config"
import { CATALOG_CACHE_TAG } from "@/lib/catalog/cache"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductCard, type CatalogProduct } from "@/components/product/product-card"
import { JsonLd } from "@/components/seo/json-ld"

/**
 * Public product catalog (`/products`, Vietnamese twin at `/vi/products`).
 *
 * Buyer-facing index over `client_products`, enforcing the same visibility
 * rules as the product page it links into:
 *  - `status = 'active'`;
 *  - only suppliers whose `client_profiles.is_published = true`.
 *
 * The second rule is *not* enforced by RLS on `client_products`, so it lives
 * here — the same way `app/profile/[slug]/page.tsx` treats an unpublished
 * profile as not existing publicly. Without it, a supplier turning off their
 * public profile would still be listed and searchable.
 *
 * Reads go through `createAdminClient()` rather than the session client on
 * purpose: the catalog is the same document for an anonymous crawler, a US
 * buyer with an account and an AE, so nothing here may depend on cookies.
 * That is also what makes `unstable_cache` legal — every read is cached for 5
 * minutes under `CATALOG_CACHE_TAG` and busted by the admin/client product
 * actions and by profile publish/unpublish. (A `export const revalidate` on
 * this route would do nothing while the root layout still awaits `getLocale()`;
 * that needs a cookie-free marketing layout.)
 *
 * Everything is server-rendered with plain GET links (no client JS): search,
 * category and pagination are query-string state, so a filtered catalog can be
 * pasted into an email and crawled by Google.
 */

const PAGE_SIZE = 24

/**
 * Suppliers are the small side of this join, so we filter products by their ids
 * instead of embedding `client_profiles` through `profiles` — same trade-off
 * `loadActiveDemandLadder` documents in app/page.tsx (two cheap queries beat a
 * nested sub-select). The scan limit only matters if Vexim ever publishes more
 * than this many suppliers, and then we degrade to the most recently updated
 * ones rather than showing an unpublished supplier.
 */
const SUPPLIER_SCAN_LIMIT = 500

/** PostgREST caps one response at 1000 rows; category facets are best-effort. */
const FACET_SCAN_LIMIT = 1000

const CATEGORY_PATTERN = /^[\p{L}\p{N}&'’()+,/ .-]{1,60}$/u

type SupplierRow = {
  client_id: string
  slug: string
  display_name: string | null
}

/** A catalog row as the card needs it, with the supplier already resolved. */
type CatalogEntry = CatalogProduct & {
  client_id: string
  created_at?: string
  client?: { id: string; company_name: string } | null
  supplier: { name: string; slug: string } | null
}

type CatalogQuery = {
  category: string | null
  q: string | null
  page: number
}

type CategoryFacet = { name: string; count: number }

type CatalogResult = {
  entries: CatalogEntry[]
  total: number
  categories: CategoryFacet[]
  supplierCount: number
  error: string | null
}

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim()
  return raw ? raw : null
}

/**
 * Search term for the PostgREST `or(...ilike...)` filter. Commas and the
 * `%`/`(`/`)` operators are part of that grammar, so they are stripped instead
 * of passed through — otherwise a single comma turns a search into a malformed
 * request (500) rather than zero results.
 */
function normalizeSearchTerm(value: string | null): string | null {
  if (!value) return null
  const cleaned = value
    .slice(0, 80)
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned.length >= 2 ? cleaned : null
}

function normalizeCategory(value: string | null): string | null {
  if (!value) return null
  return CATEGORY_PATTERN.test(value) ? value : null
}

function readQuery(raw: { category?: string; q?: string; page?: string }): CatalogQuery {
  const requested = Number.parseInt(firstParam(raw.page) ?? "1", 10)
  return {
    category: normalizeCategory(firstParam(raw.category)),
    q: normalizeSearchTerm(firstParam(raw.q)),
    page: Number.isFinite(requested) && requested > 1 ? Math.floor(requested) : 1,
  }
}

/** Localized, filter-preserving link back into this page. */
function catalogHref(query: CatalogQuery, overrides: Partial<CatalogQuery> = {}, locale: "en" | "vi" = "en"): string {
  const merged = { ...query, ...overrides }
  const params = new URLSearchParams()
  if (merged.category) params.set("category", merged.category)
  if (merged.q) params.set("q", merged.q)
  if (merged.page > 1) params.set("page", String(merged.page))
  const search = params.toString()
  return localizePath(search ? `/products?${search}` : "/products", locale)
}

async function loadCatalog(query: CatalogQuery): Promise<CatalogResult> {
  const empty: CatalogResult = { entries: [], total: 0, categories: [], supplierCount: 0, error: null }

  // A public, crawlable page should degrade to an empty catalog instead of a raw
  // 500 when the Supabase env is missing (e.g. a misconfigured deploy) —
  // createAdminClient() throws in that case, before any query runs.
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (cause) {
    console.error("[catalog] supabase client unavailable:", cause)
    return { ...empty, error: "supabase_unconfigured" }
  }

  // 1. Which suppliers may appear in a public catalog at all.
  const { data: supplierData, error: supplierError } = await supabase
    .from("client_profiles")
    .select("client_id, slug, display_name")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(SUPPLIER_SCAN_LIMIT)

  if (supplierError) {
    console.error("[catalog] published supplier lookup failed:", supplierError.message)
    return { ...empty, error: supplierError.message }
  }

  const suppliers = (supplierData ?? []) as unknown as SupplierRow[]
  const supplierById = new Map(suppliers.map((row) => [row.client_id, row]))
  const clientIds = [...supplierById.keys()]
  if (clientIds.length === 0) return empty

  // 2. Facets, computed over every active product of those suppliers so the
  //    category chips stay stable while a filter is applied.
  const { data: facetData } = await supabase
    .from("client_products")
    .select("category, client_id")
    .eq("status", "active")
    .in("client_id", clientIds)
    .limit(FACET_SCAN_LIMIT)

  const facets = (facetData ?? []) as unknown as { category: string | null; client_id: string }[]
  const counts = new Map<string, number>()
  for (const row of facets) {
    if (!row.category) continue
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12)

  // 3. The requested page of products.
  let products = supabase
    .from("client_products")
    .select(
      `id, product_name, product_code, category, subcategory, unit_of_measure,
       min_unit_price, max_unit_price, currency, image_urls, compliance_badges,
       moq_value, moq_unit, sample_available, lead_time, created_at,
       client:client_id ( id, company_name )`,
      { count: "exact" },
    )
    .eq("status", "active")
    .in("client_id", clientIds)

  if (query.category) products = products.eq("category", query.category)
  if (query.q) {
    // Same three fields the public search endpoint matches on (app/api/products/search).
    products = products.or(
      `product_name.ilike.%${query.q}%,product_code.ilike.%${query.q}%,description.ilike.%${query.q}%`,
    )
  }

  const from = (query.page - 1) * PAGE_SIZE
  const { data: productData, error: productError, count: total } = await products
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (productError) {
    console.error("[catalog] product lookup failed:", productError.message)
    return { ...empty, error: productError.message }
  }

  const rows = (productData ?? []) as unknown as Omit<CatalogEntry, "supplier">[]
  const entries: CatalogEntry[] = rows.map((row) => {
    const supplier = supplierById.get(row.client_id)
    // client_profiles.display_name wins over the legal company name, matching
    // what the product page and the supplier profile show.
    const name = supplier?.display_name ?? row.client?.company_name ?? null
    return {
      ...row,
      supplier: name && supplier ? { name, slug: supplier.slug } : null,
    }
  })

  return {
    entries,
    total: total ?? rows.length,
    categories,
    supplierCount: new Set(facets.map((row) => row.client_id)).size,
    error: null,
  }
}

const loadCachedCatalog = unstable_cache(loadCatalog, ["catalog"], {
  revalidate: 300,
  tags: [CATALOG_CACHE_TAG],
})

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { locale, t } = await getDictionary()
  const { total } = await loadCachedCatalog(readQuery(await searchParams))

  const title = `${t.catalog.title} — ${siteConfig.name}`
  const description =
    total > 0
      ? `${total.toLocaleString("en-US")} ${total === 1 ? t.catalog.productWord : t.catalog.productsWord} from Vietnamese exporters: unit prices, MOQ, lead times, HS codes and US compliance status.`
      : t.catalog.intro

  return {
    title,
    description,
    alternates: localizedAlternates("/products", { bilingual: true, locale }),
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/products`,
      type: "website",
    },
    robots: INDEXABLE,
  }
}

export default async function ProductsCatalogPage({ searchParams }: PageProps) {
  const { locale, t } = await getDictionary()
  const query = readQuery(await searchParams)

  const { entries, total, categories, supplierCount, error } = await loadCachedCatalog(query)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(query.page, totalPages)
  const hasFilters = Boolean(query.category || query.q)

  // A category that carries no products at all is a mistyped link, not a
  // catalog state — 404 it so it is never indexed. A search that returns
  // nothing is a normal outcome and keeps its empty state.
  if (query.category && !query.q && total === 0 && page === 1) notFound()

  const itemListOf = {
    "@type": "ItemList" as const,
    numberOfItems: total,
    itemListElement: entries.slice(0, 12).map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.product_name,
      url: `${siteConfig.url}/products/${entry.id}`,
    })),
  }

  return (
    <main className="min-h-screen bg-background">
      <JsonLd data={itemListOf} id="catalog-item-list" />

      <div className="border-b bg-muted/30">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={localizePath("/", locale)}
              className="shrink-0 font-semibold text-foreground hover:text-primary"
            >
              {siteConfig.name}
            </Link>
            <span aria-hidden>·</span>
            <span className="truncate">{t.catalog.breadcrumb}</span>
          </nav>
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">{t.catalog.signIn}</Link>
          </Button>
        </div>
      </div>

      <section className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t.catalog.eyebrow}
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.catalog.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{t.catalog.intro}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {total.toLocaleString("en-US")}{" "}
              {total === 1 ? t.catalog.productWord : t.catalog.productsWord}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              {supplierCount.toLocaleString("en-US")}{" "}
              {supplierCount === 1 ? t.catalog.supplierWord : t.catalog.suppliersWord}
            </span>
          </div>
          <div className="mt-6">
            <Button asChild>
              <Link href={localizePath("/#consultation", locale)}>
                {t.catalog.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.catalog.allCategories}>
            <Link
              href={catalogHref(query, { category: null, page: 1 }, locale)}
              aria-current={query.category ? undefined : "page"}
              className={
                query.category
                  ? "inline-flex h-8 items-center rounded-full border px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  : "inline-flex h-8 items-center rounded-full border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground"
              }
            >
              {t.catalog.allCategories}
            </Link>
            {categories.map((facet) => {
              const active = facet.name === query.category
              return (
                <Link
                  key={facet.name}
                  href={catalogHref(query, { category: active ? null : facet.name, page: 1 }, locale)}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground"
                      : "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  }
                >
                  {facet.name}
                  <span className="text-xs tabular-nums opacity-70">{facet.count}</span>
                </Link>
              )
            })}
          </div>

          <form
            action={localizePath("/products", locale)}
            method="get"
            className="flex w-full items-center gap-2 lg:w-auto"
          >
            {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder={t.catalog.searchPlaceholder}
                aria-label={t.catalog.searchLabel}
                className="pl-8"
              />
            </div>
            <Button type="submit">{t.catalog.search}</Button>
            {hasFilters ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={localizePath("/products", locale)}>
                  <X className="h-4 w-4" />
                  {t.catalog.clear}
                </Link>
              </Button>
            ) : null}
          </form>
        </div>

        {error ? (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {t.catalog.unavailable}
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {hasFilters ? t.catalog.emptySearchTitle : t.catalog.emptyCatalogTitle}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {hasFilters ? t.catalog.emptySearchText : t.catalog.emptyCatalogText}
            </p>
            {hasFilters ? (
              <Button asChild size="sm" variant="outline">
                <Link href={localizePath("/products", locale)}>{t.catalog.browseAll}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map((entry) => (
                <ProductCard
                  key={entry.id}
                  product={entry}
                  supplierName={entry.supplier?.name ?? null}
                  supplierSlug={entry.supplier?.slug ?? null}
                  labels={{
                    priceOnRequest: t.catalog.card.priceOnRequest,
                    moq: t.catalog.card.moq,
                    leadTime: t.catalog.card.leadTime,
                    samples: t.catalog.card.samples,
                  }}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav
                className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6"
                aria-label="Catalog pagination"
              >
                <p className="text-sm text-muted-foreground">
                  {t.catalog.pageWord} {page} {t.catalog.ofWord} {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={catalogHref(query, { page: page - 1 }, locale)}>
                        <ChevronLeft className="h-4 w-4" />
                        {t.catalog.previous}
                      </Link>
                    </Button>
                  ) : null}
                  {page < totalPages ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={catalogHref(query, { page: page + 1 }, locale)}>
                        {t.catalog.next}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}
