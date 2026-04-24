/**
 * Read-side helpers for Insights (blog). Public pages use the anon client
 * (RLS limits to published rows); admin pages use the service-role client
 * after a capability check.
 *
 * The `insights_posts` table isn't in the generated Database types yet,
 * so we cast the Supabase client to `any` at the .from() boundary and
 * re-apply our own `InsightsPost` typing to the result. Runtime is
 * unaffected; only TypeScript's table-name check is bypassed.
 */
import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { InsightsPost, PostLocale } from "./types"

const TABLE = "insights_posts"

const PUBLIC_COLS =
  "id, slug, locale, title, excerpt, cover_image_url, category, tags, published_at, reading_time_minutes, author_id, status, created_at, updated_at"

const LIST_COLS =
  "id, slug, locale, title, excerpt, cover_image_url, category, tags, published_at, reading_time_minutes"

export interface ListPostsOptions {
  locale?: PostLocale
  category?: string
  tag?: string
  limit?: number
  offset?: number
  search?: string
}

/** Public — published posts only (RLS enforces this too). */
export async function listPublishedPosts(
  opts: ListPostsOptions = {},
): Promise<{ posts: InsightsPost[]; total: number }> {
  const supabase = (await createClient()) as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const limit = Math.min(opts.limit ?? 12, 50)
  const offset = opts.offset ?? 0

  let query = supabase
    .from(TABLE)
    .select(LIST_COLS, { count: "exact" })
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.locale) query = query.eq("locale", opts.locale)
  if (opts.category) query = query.eq("category", opts.category)
  if (opts.tag) query = query.contains("tags", [opts.tag])
  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim().replace(/%/g, "").replace(/,/g, " ")
    query = query.or(
      `title.ilike.%${term}%,excerpt.ilike.%${term}%,content_md.ilike.%${term}%`,
    )
  }

  const { data, count, error } = await query
  if (error) {
    console.error("[v0] listPublishedPosts error:", error.message)
    return { posts: [], total: 0 }
  }
  return { posts: (data ?? []) as InsightsPost[], total: count ?? 0 }
}

/** Public — a single published post by slug + locale. */
export async function getPublishedPostBySlug(
  slug: string,
  locale: PostLocale,
): Promise<InsightsPost | null> {
  const supabase = (await createClient()) as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("locale", locale)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error("[v0] getPublishedPostBySlug error:", error.message)
    return null
  }
  return (data as InsightsPost | null) ?? null
}

/** Public — list *all* published slugs for sitemap / static params. */
export async function listPublishedSlugs(): Promise<
  Array<Pick<InsightsPost, "slug" | "locale" | "updated_at" | "published_at">>
> {
  const supabase = (await createClient()) as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("slug, locale, updated_at, published_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(1000)

  if (error) {
    console.error("[v0] listPublishedSlugs error:", error.message)
    return []
  }
  return (data ?? []) as Array<
    Pick<InsightsPost, "slug" | "locale" | "updated_at" | "published_at">
  >
}

/** Public — related posts by shared category (excluding current id). */
export async function listRelatedPosts(
  currentId: string,
  category: string,
  locale: PostLocale,
  limit = 3,
): Promise<InsightsPost[]> {
  const supabase = (await createClient()) as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(LIST_COLS)
    .eq("status", "published")
    .eq("locale", locale)
    .eq("category", category)
    .neq("id", currentId)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as InsightsPost[]
}

// ---------------------------------------------------------------------
// Admin-side — bypasses RLS. Callers MUST check the content capability
// BEFORE calling these. See lib/auth/guard.ts.
// ---------------------------------------------------------------------

export async function adminListAllPosts(opts: {
  limit?: number
  offset?: number
  status?: "draft" | "published" | "archived" | "all"
  locale?: PostLocale | "all"
  search?: string
}): Promise<{ posts: InsightsPost[]; total: number }> {
  const admin = createAdminClient() as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const limit = Math.min(opts.limit ?? 20, 100)
  const offset = opts.offset ?? 0

  let query = admin
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status)
  if (opts.locale && opts.locale !== "all") query = query.eq("locale", opts.locale)
  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim().replace(/%/g, "")
    query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`)
  }

  const { data, count, error } = await query
  if (error) {
    console.error("[v0] adminListAllPosts error:", error.message)
    return { posts: [], total: 0 }
  }
  return { posts: (data ?? []) as InsightsPost[], total: count ?? 0 }
}

export async function adminGetPostById(id: string): Promise<InsightsPost | null> {
  const admin = createAdminClient() as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[v0] adminGetPostById error:", error.message)
    return null
  }
  return (data as InsightsPost | null) ?? null
}

export { PUBLIC_COLS, TABLE }
