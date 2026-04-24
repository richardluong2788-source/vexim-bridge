import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site-config"
import { listPublishedSlugs } from "@/lib/insights/queries"
import { INSIGHT_CATEGORIES } from "@/lib/insights/types"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/insights`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/auth/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]

  const categoryEntries: MetadataRoute.Sitemap = INSIGHT_CATEGORIES
    .filter((c) => c.value !== "general")
    .map((c) => ({
      url: `${base}/insights?category=${c.value}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))

  // Try to include published posts. If the DB query fails (e.g. during
  // first deploy before the migration has run), we silently skip them
  // rather than breaking the sitemap entirely.
  let postEntries: MetadataRoute.Sitemap = []
  try {
    const posts = await listPublishedSlugs()
    postEntries = posts.map((p) => ({
      url: `${base}/insights/${p.slug}`,
      lastModified: new Date(p.updated_at ?? p.published_at ?? now),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
  } catch (err) {
    console.error("[v0] sitemap: failed to load insights posts", err)
  }

  return [...staticEntries, ...categoryEntries, ...postEntries]
}
