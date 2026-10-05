import type { Metadata } from "next"
import { siteConfig } from "@/lib/site-config"
import { localizePath } from "@/lib/i18n/routing"
import type { Locale } from "@/lib/i18n/config"

/**
 * Canonical + hreflang wiring for the public (buyer-facing) pages.
 *
 * `metadataBase` is set once in `app/layout.tsx`, but a locale-aware page still
 * has to say which of its URLs is canonical — Google treats the unprefixed path
 * and `/vi/<path>` as two documents unless the markup ties them together.
 */

export function publicUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  // The root has no trailing slash, because that is what Next renders for
  // `alternates.canonical: "/"` — and the sitemap must publish the identical
  // string, or `/` and `https://host/` become two URLs for one page.
  return normalized === "/" ? siteConfig.url : `${siteConfig.url}${normalized}`
}

export interface LocalizedAlternatesOptions {
  /**
   * True when a translated interface exists for the page (for example, the
   * landing page, catalog index and supplier profile).
   *
   * False (default) for single-language pages such as product details, which
   * are written for US buyers and only exist in English. Then the canonical is
   * the unprefixed URL and hreflang declares just that one language, so
   * `/vi/products/<id>` (the same English copy) collapses onto one document.
   */
  bilingual?: boolean
  /** Locale currently being rendered; decides which URL is canonical. */
  locale?: Locale
  /** Language tag for the single-language case (defaults to English). */
  contentLanguage?: string
}

export function localizedAlternates(
  path: string,
  { bilingual = false, locale = "en", contentLanguage = "en" }: LocalizedAlternatesOptions = {},
): Metadata["alternates"] {
  if (!bilingual) {
    const canonical = publicUrl(path)
    return {
      canonical,
      languages: { [contentLanguage]: canonical, "x-default": canonical },
    }
  }

  const canonical = publicUrl(localizePath(path, locale))
  return {
    canonical,
    languages: {
      en: publicUrl(localizePath(path, "en")),
      vi: publicUrl(localizePath(path, "vi")),
      // x-default = the language-neutral entry point (unprefixed, i.e. English).
      "x-default": publicUrl(path),
    },
  }
}

/**
 * Token-scoped pages (share links, shortlist snapshots, invoice/unsubscribe
 * links) are addressed documents: the token in the URL is the only thing
 * keeping them private. Indexing them would put a client's supplier shortlist
 * in Google, so noindex is applied in two places — here and in `app/robots.ts`.
 */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false }

/** Indexable, and links on the page may be followed. */
export const INDEXABLE: Metadata["robots"] = { index: true, follow: true }
