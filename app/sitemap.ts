import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site-config"

// Last update of legal documents — keep in sync with the `EFFECTIVE_DATE`
// constants inside each /app/legal/*/page.tsx file. We surface this in the
// sitemap so search engines can detect freshness without re-crawling.
const LEGAL_LAST_UPDATED = new Date("2026-04-26")

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url
  const now = new Date()

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/auth/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // Legal hub + each policy. Lower priority than the home page but still
    // indexable — these pages signal trust to Google and contribute to E-E-A-T.
    {
      url: `${base}/legal`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${base}/legal/terms`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/legal/privacy`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/legal/cookies`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ]
}
