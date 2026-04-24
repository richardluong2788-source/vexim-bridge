import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock } from "lucide-react"
import { siteConfig } from "@/lib/site-config"
import { getLocale } from "@/lib/i18n/server"
import { getPublishedPostBySlug, listRelatedPosts } from "@/lib/insights/queries"
import { getCategoryMeta, type PostLocale } from "@/lib/insights/types"
import { extractToc } from "@/lib/insights/toc"
import { InsightsHeader } from "@/components/insights/insights-header"
import { InsightsMarkdown } from "@/components/insights/insights-markdown"
import { InsightsPostCard } from "@/components/insights/insights-post-card"
import { ReadingProgress } from "@/components/insights/reading-progress"
import { TableOfContents } from "@/components/insights/table-of-contents"
import { NewsletterSignup } from "@/components/insights/newsletter-signup"
import { LandingFooter } from "@/components/landing/landing-footer"
import { Button } from "@/components/ui/button"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale = (await getLocale()) as PostLocale
  const post = await getPublishedPostBySlug(slug, locale)
  if (!post) return { title: "Not found" }

  const title = post.seo_title ?? `${post.title} — ${siteConfig.name}`
  const description =
    post.seo_description ?? post.excerpt ?? siteConfig.description
  const url = `${siteConfig.url}/insights/${post.slug}`
  const ogImage = post.cover_image_url ?? siteConfig.ogImage

  return {
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: siteConfig.name,
      title,
      description,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      images: [{ url: ogImage, width: 1600, height: 1000, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  }
}

function formatDate(iso: string | null, locale: PostLocale): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function InsightsPostPage({ params }: PageProps) {
  const { slug } = await params
  const locale = (await getLocale()) as PostLocale

  const post = await getPublishedPostBySlug(slug, locale)
  if (!post) notFound()

  const [related, toc] = await Promise.all([
    listRelatedPosts(post.id, post.category, locale, 3),
    Promise.resolve(extractToc(post.content_md)),
  ])

  const cat = getCategoryMeta(post.category)
  const catLabel = locale === "vi" ? cat.labelVi : cat.labelEn

  // JSON-LD Article schema for rich results
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    image: post.cover_image_url ?? `${siteConfig.url}${siteConfig.ogImage}`,
    inLanguage: locale === "vi" ? "vi-VN" : "en-US",
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/favicon.ico`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteConfig.url}/insights/${post.slug}`,
    },
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <ReadingProgress targetId="post-body" />
      <InsightsHeader locale={locale} activeCategory={post.category} />

      <main id="main" className="flex-1">
        {/* Article header */}
        <header className="border-b border-border/60 bg-linear-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <div className="mb-6">
              <Link
                href={`/insights?category=${post.category}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent hover:underline"
              >
                {catLabel}
              </Link>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl lg:text-5xl">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
                {post.excerpt}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <time dateTime={post.published_at ?? undefined}>
                {formatDate(post.published_at, locale)}
              </time>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {post.reading_time_minutes}{" "}
                {locale === "vi" ? "phút đọc" : "min read"}
              </span>
            </div>
          </div>
        </header>

        {/* Cover image */}
        {post.cover_image_url ? (
          <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image_url}
              alt=""
              className="aspect-[16/9] w-full rounded-xl border border-border object-cover"
            />
          </div>
        ) : null}

        {/* Body with optional TOC sidebar on large screens */}
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12 lg:px-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <article
            id="post-body"
            className="mx-auto w-full max-w-3xl lg:mx-0"
          >
            <InsightsMarkdown>{post.content_md}</InsightsMarkdown>

            {post.tags.length > 0 ? (
              <div className="mt-12 flex flex-wrap gap-2 border-t border-border pt-6">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-10">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/insights">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  {locale === "vi" ? "Quay lại danh sách" : "Back to all posts"}
                </Link>
              </Button>
            </div>

            {/* Inline newsletter after article body */}
            <div className="mt-12">
              <NewsletterSignup locale={locale} source={`post:${post.slug}`} />
            </div>
          </article>

          {/* TOC sidebar — hidden below lg, sticky on lg+ */}
          {toc.length >= 2 ? (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <TableOfContents
                  entries={toc}
                  title={locale === "vi" ? "Nội dung" : "Contents"}
                />
              </div>
            </aside>
          ) : null}
        </div>

        {/* Related */}
        {related.length > 0 ? (
          <section className="border-t border-border/60 bg-muted/30">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <h2 className="mb-8 text-2xl font-semibold tracking-tight">
                {locale === "vi" ? "Bài liên quan" : "Related articles"}
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {related.map((r) => (
                  <InsightsPostCard key={r.id} post={r} locale={locale} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <section className="border-t border-border/60 bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              {locale === "vi"
                ? "Sẵn sàng đưa sản phẩm sang Mỹ?"
                : "Ready to launch your product in the US?"}
            </h2>
            <p className="max-w-xl text-sm text-primary-foreground/80 md:text-base">
              {locale === "vi"
                ? "Đặt lịch tư vấn 30 phút miễn phí — đội Vexim Bridge sẽ đánh giá hồ sơ FDA, danh sách buyer và lộ trình thanh toán."
                : "Book a free 30-minute consultation — the Vexim Bridge team will review your FDA profile, buyer list and payment roadmap."}
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-2">
              <Link href="/#contact">
                {locale === "vi" ? "Đặt lịch tư vấn" : "Book a consultation"}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
