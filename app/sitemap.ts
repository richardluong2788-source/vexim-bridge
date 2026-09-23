import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { localizePath } from "@/lib/i18n/routing"
import { CATALOG_CACHE_TAG } from "@/lib/catalog/cache"
import { publicUrl } from "@/lib/seo/alternates"

// The catalog moves when a supplier publishes, not per request — and the URL
// list is assembled from Postgres, so rebuild it hourly rather than per crawl.
export const revalidate = 3600

// Last update of legal documents — keep in sync with the `EFFECTIVE_DATE`
// constants inside each /app/legal/*/page.tsx file. We surface this in the
// sitemap so search engines can detect freshness without re-crawling.
const LEGAL_LAST_UPDATED = new Date("2026-04-26")

/**
 * Caps below are deliberate: PostgREST answers at most 1000 rows per request,
 * and a sitemap file is capped at 50k URLs by the spec. Vexim is nowhere near
 * either, and the crawl of a catalog this size is bounded by `/products`
 * pagination long before these numbers matter.
 */
const PRODUCT_URL_LIMIT = 900
const PROFILE_URL_LIMIT = 400

type Entry = MetadataRoute.Sitemap[number]

function page(url: string, lastModified: Date, priority: number, changeFrequency: Entry["changeFrequency"]): Entry {
  return { url, lastModified, changeFrequency, priority }
}

/** Static floor: pages that exist regardless of database state. */
function staticEntries(now: Date): Entry[] {
  return [
    // The landing page is bilingual, so both locales get their own row.
    page(publicUrl("/"), now, 1, "weekly"),
    page(publicUrl(localizePath("/", "vi")), now, 0.95, "weekly"),
    page(publicUrl("/products"), now, 0.9, "daily"),
    page(publicUrl(localizePath("/products", "vi")), now, 0.85, "daily"),
    {
      url: publicUrl("/auth/login"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // Legal hub + each policy. Lower priority than the home page but still
    // indexable — these pages signal trust to Google and contribute to E-E-A-T.
    page(publicUrl("/legal"), LEGAL_LAST_UPDATED, 0.4, "yearly"),
    page(publicUrl("/legal/terms"), LEGAL_LAST_UPDATED, 0.5, "yearly"),
    page(publicUrl("/legal/privacy"), LEGAL_LAST_UPDATED, 0.5, "yearly"),
    page(publicUrl("/legal/cookies"), LEGAL_LAST_UPDATED, 0.4, "yearly"),
  ]
}

async function collectCatalogEntries(): Promise<Entry[]> {
  // Computed inside the cached function: `unstable_cache` builds its key from the
  // arguments, so it must receive only plain JSON-able values (a Date would
  // produce a new cache entry per request and defeat the point).
  const now = new Date()
  const supabase = createAdminClient()

  // Same visibility rule the catalog index uses: a product is public only while
  // its supplier profile is published. Without this filter the sitemap would
  // advertise URLs that 404 (or expose a supplier who left).
  const { data: suppliers } = await supabase
    .from("client_profiles")
    .select("slug, client_id, updated_at")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(PROFILE_URL_LIMIT)

  const profiles = (suppliers ?? []) as unknown as {
    slug: string
    client_id: string
    updated_at: string | null
  }[]

  const [products, productError] = await (async () => {
    if (profiles.length === 0) return [[] as { id: string; updated_at: string | null }[], null]
    const { data, error } = await supabase
      .from("client_products")
      .select("id, updated_at")
      .eq("status", "active")
      .in("client_id", profiles.map((profile) => profile.client_id))
      .order("updated_at", { ascending: false })
      .limit(PRODUCT_URL_LIMIT)
    return [(data ?? []) as unknown as { id: string; updated_at: string | null }[], error]
  })()

  if (productError) console.error("[sitemap] product urls skipped:", productError.message)

  return [
    ...profiles.map((profile) =>
      page(
        publicUrl(`/profile/${profile.slug}`),
        profile.updated_at ? new Date(profile.updated_at) : now,
        0.7,
        "weekly",
      ),
    ),
    ...products.map((product) =>
      page(
        publicUrl(`/products/${product.id}`),
        product.updated_at ? new Date(product.updated_at) : now,
        0.8,
        "weekly",
      ),
    ),
  ]
}

const collectCachedCatalogEntries = unstable_cache(collectCatalogEntries, ["sitemap-catalog"], {
  revalidate: 3600,
  tags: [CATALOG_CACHE_TAG],
})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  try {
    const catalog = await collectCachedCatalogEntries()
    return [...staticEntries(now), ...catalog]
  } catch (error) {
    // A build or crawl of the sitemap must never fail because the database (or
    // its env vars) were unreachable — publish the static floor instead.
    console.error("[sitemap] catalog urls unavailable:", error)
    return staticEntries(now)
  }
}
