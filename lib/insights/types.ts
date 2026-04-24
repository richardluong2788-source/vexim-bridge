/**
 * Vexim Insights (blog) — shared types and constants.
 *
 * The `insights_posts` table is NOT in the generated Database types yet
 * (lib/supabase/types.ts would require regenerating). Until it is, this
 * file is the single source of truth for the row shape and we cast at
 * query sites via `.from("insights_posts" as "profiles")` — the runtime
 * is unaffected, only the TS type is hinted.
 */

export type PostStatus = "draft" | "published" | "archived"
export type PostLocale = "vi" | "en"

export interface InsightsPost {
  id: string
  slug: string
  locale: PostLocale
  title: string
  excerpt: string | null
  content_md: string
  cover_image_url: string | null
  category: string
  tags: string[]
  author_id: string | null
  status: PostStatus
  published_at: string | null
  reading_time_minutes: number
  seo_title: string | null
  seo_description: string | null
  view_count: number
  created_at: string
  updated_at: string
}

export type InsightsPostInsert = Omit<
  InsightsPost,
  "id" | "view_count" | "created_at" | "updated_at"
> & {
  id?: string
}

export type InsightsPostUpdate = Partial<Omit<InsightsPost, "id" | "created_at">>

// ---------------------------------------------------------------------------
// Categories — MVP is a small, curated set. Keep labels here so landing
// pages, admin filters and RSS all agree.
// ---------------------------------------------------------------------------

export interface CategoryMeta {
  value: string
  labelVi: string
  labelEn: string
  descriptionVi: string
  descriptionEn: string
}

export const INSIGHT_CATEGORIES: readonly CategoryMeta[] = [
  {
    value: "fda-compliance",
    labelVi: "Tuân thủ FDA",
    labelEn: "FDA Compliance",
    descriptionVi:
      "Hướng dẫn đăng ký, gia hạn và vận hành tuân thủ FDA cho 4 ngành trọng điểm.",
    descriptionEn:
      "Registration, renewal and ongoing compliance playbooks for four FDA-regulated industries.",
  },
  {
    value: "export-guides",
    labelVi: "Cẩm nang xuất khẩu",
    labelEn: "Export Guides",
    descriptionVi: "Tìm buyer, đàm phán, logistics và thanh toán USD qua SWIFT.",
    descriptionEn: "Finding buyers, negotiation, logistics and USD collection via SWIFT.",
  },
  {
    value: "case-studies",
    labelVi: "Case study",
    labelEn: "Case Studies",
    descriptionVi: "Các deal thực tế chúng tôi đã giúp khách hàng chốt thành công.",
    descriptionEn: "Real deals we have helped Vietnamese manufacturers close.",
  },
  {
    value: "market-reports",
    labelVi: "Báo cáo thị trường",
    labelEn: "Market Reports",
    descriptionVi: "Xu hướng nhập khẩu Mỹ, phân tích thuế quan và ngành.",
    descriptionEn: "US import trends, tariffs, and industry-specific analysis.",
  },
  {
    value: "general",
    labelVi: "Chung",
    labelEn: "General",
    descriptionVi: "Các bài viết và thông báo khác.",
    descriptionEn: "Announcements and miscellaneous articles.",
  },
] as const

export function getCategoryMeta(value: string): CategoryMeta {
  return (
    INSIGHT_CATEGORIES.find((c) => c.value === value) ??
    INSIGHT_CATEGORIES[INSIGHT_CATEGORIES.length - 1]
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Very small slugifier — good enough for Vietnamese titles. Removes
 * diacritics, lowercases, replaces non-[a-z0-9] with hyphens, trims.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}

/** Estimate reading time in minutes (200 wpm). Minimum 1. */
export function estimateReadingTime(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
