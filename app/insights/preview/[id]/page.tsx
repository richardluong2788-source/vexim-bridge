import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Clock, Eye } from "lucide-react"
import { requireCapability } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import { getLocale } from "@/lib/i18n/server"
import { adminGetPostById } from "@/lib/insights/queries"
import { getCategoryMeta, type PostLocale } from "@/lib/insights/types"
import { extractToc } from "@/lib/insights/toc"
import { InsightsHeader } from "@/components/insights/insights-header"
import { InsightsMarkdown } from "@/components/insights/insights-markdown"
import { TableOfContents } from "@/components/insights/table-of-contents"
import { LandingFooter } from "@/components/landing/landing-footer"
import { Button } from "@/components/ui/button"

/**
 * Editor-only preview of a post (including drafts and scheduled posts).
 *
 * We gate on CONTENT_VIEW via requireCapability() — same mechanism as
 * /admin/content. We deliberately render a `noindex` meta tag and pass a
 * banner across the top so an editor who shares the URL doesn't get it
 * crawled by Google.
 */

export const metadata = {
  title: "Preview — Vexim Insights",
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDate(iso: string | null, locale: PostLocale): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function InsightsPreviewPage({ params }: PageProps) {
  const { id } = await params

  // Editors only. If the user isn't logged in at all, redirect to login
  // and come back here after auth.
  try {
    await requireCapability(CAPS.CONTENT_VIEW)
  } catch {
    redirect(`/auth/login?next=/insights/preview/${id}`)
  }

  const post = await adminGetPostById(id)
  if (!post) notFound()

  const locale = (await getLocale()) as PostLocale
  const toc = extractToc(post.content_md)
  const cat = getCategoryMeta(post.category)
  const catLabel = post.locale === "vi" ? cat.labelVi : cat.labelEn

  const statusLabel =
    post.status === "published"
      ? post.published_at && new Date(post.published_at) > new Date()
        ? locale === "vi" ? "Đã lên lịch" : "Scheduled"
        : locale === "vi" ? "Đã xuất bản" : "Published"
      : post.status === "draft"
        ? locale === "vi" ? "Bản nháp" : "Draft"
        : locale === "vi" ? "Lưu trữ" : "Archived"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 border-b border-accent/50 bg-accent text-accent-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" aria-hidden />
            <span className="font-medium">
              {locale === "vi" ? "Chế độ xem trước" : "Preview mode"}
            </span>
            <span className="text-accent-foreground/80">
              — {statusLabel} ·{" "}
              {post.status === "published"
                ? formatDate(post.published_at, locale)
                : locale === "vi"
                  ? "chưa xuất bản"
                  : "not published"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/admin/content/posts/${post.id}`}>
                {locale === "vi" ? "Chỉnh sửa" : "Edit"}
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/content/posts">
                {locale === "vi" ? "Danh sách" : "All posts"}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <InsightsHeader locale={post.locale} activeCategory={post.category} />

      <main className="flex-1">
        <header className="border-b border-border/60 bg-linear-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
            <span className="mb-6 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              {catLabel}
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl lg:text-5xl">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
                {post.excerpt}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {post.reading_time_minutes}{" "}
                {post.locale === "vi" ? "phút đọc" : "min read"}
              </span>
            </div>
          </div>
        </header>

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

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12 lg:px-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <article id="post-body" className="mx-auto w-full max-w-3xl lg:mx-0">
            {post.content_md.trim() ? (
              <InsightsMarkdown>{post.content_md}</InsightsMarkdown>
            ) : (
              <p className="italic text-muted-foreground">
                {locale === "vi"
                  ? "Bài viết chưa có nội dung."
                  : "This post has no content yet."}
              </p>
            )}
          </article>

          {toc.length >= 2 ? (
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <TableOfContents
                  entries={toc}
                  title={locale === "vi" ? "Nội dung" : "Contents"}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
