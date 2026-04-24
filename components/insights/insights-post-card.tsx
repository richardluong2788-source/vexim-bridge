import Link from "next/link"
import { Clock } from "lucide-react"
import type { InsightsPost } from "@/lib/insights/types"
import { getCategoryMeta } from "@/lib/insights/types"

interface InsightsPostCardProps {
  post: Pick<
    InsightsPost,
    | "slug"
    | "locale"
    | "title"
    | "excerpt"
    | "cover_image_url"
    | "category"
    | "published_at"
    | "reading_time_minutes"
  >
  locale?: "vi" | "en"
  featured?: boolean
}

function formatDate(iso: string | null, locale: "vi" | "en"): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function InsightsPostCard({ post, locale = "vi", featured = false }: InsightsPostCardProps) {
  const cat = getCategoryMeta(post.category)
  const catLabel = locale === "vi" ? cat.labelVi : cat.labelEn

  return (
    <article
      className={
        featured
          ? "group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-0 transition-colors hover:border-accent/50 md:flex-row md:gap-8 md:p-0"
          : "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-accent/50"
      }
    >
      {post.cover_image_url ? (
        <Link
          href={`/insights/${post.slug}`}
          className={
            featured
              ? "relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted md:aspect-[5/4] md:w-1/2"
              : "relative block aspect-[16/9] w-full overflow-hidden bg-muted"
          }
          aria-label={post.title}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </Link>
      ) : (
        <Link
          href={`/insights/${post.slug}`}
          className={
            featured
              ? "relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-linear-to-br from-primary to-accent md:aspect-[5/4] md:w-1/2"
              : "relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-linear-to-br from-primary to-accent"
          }
          aria-label={post.title}
        >
          <span className="text-2xl font-semibold tracking-tight text-primary-foreground">
            Vexim Insights
          </span>
        </Link>
      )}

      <div className={featured ? "flex flex-1 flex-col gap-3 p-6 md:py-8 md:pr-8" : "flex flex-1 flex-col gap-3 p-5"}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-medium text-accent">
            {catLabel}
          </span>
          <span aria-hidden>·</span>
          <time dateTime={post.published_at ?? undefined}>
            {formatDate(post.published_at, locale)}
          </time>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {post.reading_time_minutes} {locale === "vi" ? "phút đọc" : "min read"}
          </span>
        </div>

        <h3
          className={
            featured
              ? "text-xl font-semibold tracking-tight text-balance md:text-2xl"
              : "text-lg font-semibold tracking-tight text-balance"
          }
        >
          <Link
            href={`/insights/${post.slug}`}
            className="after:absolute after:inset-0 after:content-[''] hover:text-accent"
          >
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-auto pt-2 text-sm font-medium text-accent">
          {locale === "vi" ? "Đọc bài" : "Read article"} →
        </div>
      </div>
    </article>
  )
}
