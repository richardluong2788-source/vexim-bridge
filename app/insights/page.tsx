import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { siteConfig } from "@/lib/site-config"
import { getLocale } from "@/lib/i18n/server"
import { listPublishedPosts } from "@/lib/insights/queries"
import { INSIGHT_CATEGORIES, getCategoryMeta, type PostLocale } from "@/lib/insights/types"
import { InsightsHeader } from "@/components/insights/insights-header"
import { InsightsPostCard } from "@/components/insights/insights-post-card"
import { InsightsSearch } from "@/components/insights/insights-search"
import { NewsletterSignup } from "@/components/insights/newsletter-signup"
import { LandingFooter } from "@/components/landing/landing-footer"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

const PAGE_SIZE = 12

interface SearchParams {
  category?: string
  page?: string
  q?: string
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = await searchParams
  const locale = await getLocale()
  const cat = sp.category ? getCategoryMeta(sp.category) : null

  const title = cat
    ? locale === "vi"
      ? `${cat.labelVi} — Vexim Insights`
      : `${cat.labelEn} — Vexim Insights`
    : locale === "vi"
      ? "Vexim Insights — Cẩm nang xuất khẩu sang Mỹ"
      : "Vexim Insights — Export to USA Playbook"

  const description = cat
    ? locale === "vi" ? cat.descriptionVi : cat.descriptionEn
    : locale === "vi"
      ? "Hướng dẫn FDA, case study, tìm buyer Mỹ và thanh toán SWIFT từ đội ngũ Vexim Bridge."
      : "FDA guides, case studies, US buyer outreach and SWIFT payments from the Vexim Bridge team."

  const url = `${siteConfig.url}/insights${cat ? `?category=${cat.value}` : ""}`

  return {
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: siteConfig.name,
      title,
      description,
      images: [{ url: siteConfig.ogImage, width: 1600, height: 1000, alt: siteConfig.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage],
    },
    robots: { index: true, follow: true },
  }
}

export default async function InsightsListingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const locale = (await getLocale()) as PostLocale
  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const activeCategory = sp.category ?? undefined
  const search = sp.q?.trim() || undefined

  if (activeCategory && !INSIGHT_CATEGORIES.some((c) => c.value === activeCategory)) {
    notFound()
  }

  const { posts, total } = await listPublishedPosts({
    locale,
    category: activeCategory,
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const cat = activeCategory ? getCategoryMeta(activeCategory) : null

  const heading = cat
    ? locale === "vi" ? cat.labelVi : cat.labelEn
    : locale === "vi" ? "Cẩm nang xuất khẩu sang Mỹ" : "Export-to-USA Playbook"

  const subheading = cat
    ? locale === "vi" ? cat.descriptionVi : cat.descriptionEn
    : locale === "vi"
      ? "Hướng dẫn, case study và phân tích từ đội Vexim Bridge — biến rào cản FDA, SWIFT và pháp lý thành quy trình lặp lại được."
      : "Guides, case studies and analysis from the Vexim Bridge team — turning FDA, SWIFT and legal friction into a repeatable process."

  const [featured, ...rest] = posts
  const hasResults = posts.length > 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <InsightsHeader locale={locale} activeCategory={activeCategory} />

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/60 bg-linear-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-4 max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Vexim Insights
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                {heading}
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                {subheading}
              </p>
              <div className="mt-4">
                <InsightsSearch
                  placeholder={
                    locale === "vi"
                      ? "Tìm bài viết, ví dụ: FDA, buyer Mỹ..."
                      : "Search posts, e.g. FDA, US buyers..."
                  }
                  activeCategory={activeCategory}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile category pills */}
        <nav
          aria-label={locale === "vi" ? "Danh mục" : "Categories"}
          className="border-b border-border/60 bg-background md:hidden"
        >
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            <Link
              href="/insights"
              className={
                !activeCategory
                  ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : "shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {locale === "vi" ? "Tất cả" : "All"}
            </Link>
            {INSIGHT_CATEGORIES.filter((c) => c.value !== "general").map((c) => (
              <Link
                key={c.value}
                href={`/insights?category=${c.value}`}
                className={
                  activeCategory === c.value
                    ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                }
              >
                {locale === "vi" ? c.labelVi : c.labelEn}
              </Link>
            ))}
          </div>
        </nav>

        {/* Posts */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {!hasResults ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {locale === "vi" ? "Chưa có bài viết" : "No posts yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {locale === "vi"
                    ? "Chúng tôi đang chuẩn bị những bài viết chất lượng. Hãy quay lại sau, hoặc đặt lịch tư vấn ngay."
                    : "We're preparing quality content. Come back soon, or book a consultation."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/">
                    {locale === "vi" ? "Về trang chủ" : "Back to site"}
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="flex flex-col gap-10">
              {/* Featured (page 1, no filter, no search) */}
              {page === 1 && !activeCategory && !search && featured ? (
                <InsightsPostCard post={featured} locale={locale} featured />
              ) : null}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {(page === 1 && !activeCategory && !search ? rest : posts).map((p) => (
                  <InsightsPostCard key={p.id} post={p} locale={locale} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 ? (
                <nav
                  className="flex items-center justify-center gap-2 pt-4"
                  aria-label={locale === "vi" ? "Phân trang" : "Pagination"}
                >
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={buildHref({ page: page - 1, category: activeCategory, q: search })}
                      >
                        ← {locale === "vi" ? "Trước" : "Prev"}
                      </Link>
                    </Button>
                  ) : null}
                  <span className="px-3 text-sm text-muted-foreground">
                    {locale === "vi"
                      ? `Trang ${page} / ${totalPages}`
                      : `Page ${page} of ${totalPages}`}
                  </span>
                  {page < totalPages ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={buildHref({ page: page + 1, category: activeCategory, q: search })}
                      >
                        {locale === "vi" ? "Sau" : "Next"} →
                      </Link>
                    </Button>
                  ) : null}
                </nav>
              ) : null}
            </div>
          )}
        </section>

        {/* Newsletter CTA */}
        <section className="border-t border-border/60 bg-background">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            <NewsletterSignup locale={locale} source="insights-list" />
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

function buildHref({
  page,
  category,
  q,
}: {
  page: number
  category?: string
  q?: string
}): string {
  const params = new URLSearchParams()
  if (category) params.set("category", category)
  if (q) params.set("q", q)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `/insights?${qs}` : "/insights"
}
