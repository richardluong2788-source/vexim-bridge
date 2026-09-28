import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site-config"
import { DEFAULT_LOCALE, NOINDEX_SEGMENTS, PRIVATE_SEGMENTS } from "@/lib/i18n/routing"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Authenticated-only surfaces.
          ...PRIVATE_SEGMENTS.map((segment) => `/${segment}/`),
          // Token-addressed documents (share links, shortlist snapshots, invoice
          // and one-click unsubscribe): the URL is the only secret. Each page also
          // sets <meta robots noindex>, because a robots rule is advisory.
          ...NOINDEX_SEGMENTS.map((segment) => `/${segment}/`),
          // /<default-locale>/<path> is normalized onto the unprefixed URL by the
          // middleware; disallowing it keeps crawlers off the redirect.
          `/${DEFAULT_LOCALE}/`,
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
