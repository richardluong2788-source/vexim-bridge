import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { siteConfig } from "@/lib/site-config"

export interface LegalSection {
  /** Slug used as the anchor target (e.g. `#thu-thap-du-lieu`). */
  id: string
  /** Section heading shown in both the ToC sidebar and the main column. */
  title: string
}

interface LegalPageProps {
  /** Path-relative URL of the page, e.g. `/legal/terms`. Used for JSON-LD. */
  pathname: string
  /** Human-readable title of the document (Vietnamese). */
  title: string
  /** One-line summary, surfaced under the title and in the ToC card. */
  summary: string
  /** Last-updated date displayed at the top. */
  effectiveDate: string
  /** Section list — drives the sticky ToC and BreadcrumbList markup. */
  sections: LegalSection[]
  /** Page body. Use semantic <section id={...}> blocks matching `sections`. */
  children: ReactNode
}

/**
 * Reusable wrapper for /legal/* pages.
 *
 * Renders:
 *   - Breadcrumbs (visible) + BreadcrumbList JSON-LD (for Google rich results)
 *   - Title, summary, effective date
 *   - Sticky table-of-contents on desktop, inline card on mobile
 *   - The content column with constrained max-width and `prose`-like spacing
 *   - Bottom cross-links to the other legal documents
 */
export function LegalPage({ pathname, title, summary, effectiveDate, sections, children }: LegalPageProps) {
  const url = `${siteConfig.url}${pathname}`

  // BreadcrumbList structured data — Google uses this to render the
  // "Home > Legal > <Page>" trail on the search result instead of the URL.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Pháp lý", item: `${siteConfig.url}/legal` },
      { "@type": "ListItem", position: 3, name: title, item: url },
    ],
  }

  // WebPage with `dateModified` so search engines know freshness without
  // having to re-crawl just to compare hashes.
  const webpageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: title,
    description: summary,
    inLanguage: "vi-VN",
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.legalName,
      url: siteConfig.url,
    },
    dateModified: effectiveDate,
  }

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify is safe — no user-controlled values.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageJsonLd) }}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Breadcrumbs */}
        <nav aria-label="Đường dẫn" className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Trang chủ
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Pháp lý</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Sticky ToC on desktop */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 rounded-lg border border-border/60 bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trong tài liệu này
              </p>
              <ol className="mt-3 flex flex-col gap-2.5 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex gap-2 leading-snug text-muted-foreground hover:text-foreground"
                    >
                      <span className="tabular-nums text-muted-foreground/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* Article body */}
          <article className="lg:col-span-9">
            <header className="mb-10 border-b border-border/60 pb-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tài liệu pháp lý
              </p>
              <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
                {summary}
              </p>
              <p className="mt-6 text-xs text-muted-foreground">
                Hiệu lực từ:{" "}
                <time dateTime={effectiveDate} className="font-medium text-foreground">
                  {formatVietnameseDate(effectiveDate)}
                </time>
              </p>
            </header>

            <div className="legal-prose flex flex-col gap-8 text-sm leading-relaxed text-foreground/90">
              {children}
            </div>

            {/* Cross-links so visitors and crawlers can hop between policies */}
            <footer className="mt-14 border-t border-border/60 pt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tài liệu liên quan
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CrossLink href="/legal/terms" label="Điều khoản dịch vụ" pathname={pathname} />
                <CrossLink href="/legal/privacy" label="Chính sách bảo mật" pathname={pathname} />
                <CrossLink href="/legal/cookies" label="Chính sách cookie" pathname={pathname} />
              </div>
              <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
                Có thắc mắc về tài liệu này? Liên hệ{" "}
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {siteConfig.contact.email}
                </a>
                .
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  )
}

function CrossLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const isCurrent = href === pathname
  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={
        "flex items-center justify-between rounded-md border border-border/60 px-4 py-3 text-sm transition-colors " +
        (isCurrent
          ? "bg-muted text-muted-foreground"
          : "hover:border-foreground/40 hover:bg-muted/50")
      }
    >
      <span className="font-medium text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

function formatVietnameseDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d)
}
