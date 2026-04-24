"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import type { InsightsPost, PostLocale, PostStatus } from "@/lib/insights/types"
import { estimateReadingTime, slugify } from "@/lib/insights/types"

const TABLE = "insights_posts"

const formSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự").max(200),
  slug: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  locale: z.enum(["vi", "en"]),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content_md: z.string().default(""),
  category: z.string().trim().min(1).max(64),
  tags: z.string().optional().default(""),
  cover_image_url: z
    .string()
    .trim()
    .url("URL ảnh không hợp lệ")
    .optional()
    .or(z.literal(""))
    .nullable(),
  status: z.enum(["draft", "published", "archived"]),
  published_at: z.string().optional().nullable(),
  seo_title: z.string().trim().max(120).optional().nullable(),
  seo_description: z.string().trim().max(300).optional().nullable(),
})

export type SavePostState =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

function extractFormFields(formData: FormData) {
  return {
    id: (formData.get("id") as string) || undefined,
    title: (formData.get("title") as string) ?? "",
    slug: (formData.get("slug") as string) ?? "",
    locale: ((formData.get("locale") as string) ?? "vi") as PostLocale,
    excerpt: (formData.get("excerpt") as string) ?? "",
    content_md: (formData.get("content_md") as string) ?? "",
    category: (formData.get("category") as string) ?? "general",
    tags: (formData.get("tags") as string) ?? "",
    cover_image_url: (formData.get("cover_image_url") as string) ?? "",
    status: ((formData.get("status") as string) ?? "draft") as PostStatus,
    published_at: (formData.get("published_at") as string) ?? "",
    seo_title: (formData.get("seo_title") as string) ?? "",
    seo_description: (formData.get("seo_description") as string) ?? "",
  }
}

/**
 * Create or update an insights post. Idempotent on (id) when present,
 * else creates a new row. Enforces CONTENT_WRITE for drafts and
 * additionally CONTENT_PUBLISH when status=published.
 */
export async function savePost(
  _prev: SavePostState | null,
  formData: FormData,
): Promise<SavePostState> {
  const raw = extractFormFields(formData)
  const parsed = formSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const input = parsed.data
  const requiredCap =
    input.status === "published" ? CAPS.CONTENT_PUBLISH : CAPS.CONTENT_WRITE
  const guard = await requireCap(requiredCap)
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error === "unauthenticated" ? "Vui lòng đăng nhập" : "Bạn không có quyền",
    }
  }

  const { admin, userId } = guard

  const tags = input.tags
    ? input.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  const slug = (input.slug && input.slug.length > 0 ? input.slug : slugify(input.title)).toLowerCase()
  if (!slug) {
    return { ok: false, error: "Slug rỗng — vui lòng nhập tiêu đề hợp lệ" }
  }

  const reading = estimateReadingTime(input.content_md || "")

  // Auto-set published_at when publishing and none provided
  let publishedAt: string | null = null
  if (input.status === "published") {
    publishedAt =
      input.published_at && input.published_at.length > 0
        ? new Date(input.published_at).toISOString()
        : new Date().toISOString()
  } else if (input.status === "archived" && input.published_at) {
    publishedAt = new Date(input.published_at).toISOString()
  }

  const payload: Partial<InsightsPost> & Record<string, unknown> = {
    slug,
    locale: input.locale,
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() || null,
    content_md: input.content_md,
    category: input.category,
    tags,
    cover_image_url:
      input.cover_image_url && input.cover_image_url.length > 0
        ? input.cover_image_url
        : null,
    status: input.status,
    published_at: publishedAt,
    reading_time_minutes: reading,
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as unknown as { from: (t: string) => any }

  if (input.id) {
    const { data, error } = await db
      .from(TABLE)
      .update(payload)
      .eq("id", input.id)
      .select("id, slug")
      .single()
    if (error) {
      console.error("[v0] savePost update error:", error.message)
      if ((error.message ?? "").includes("duplicate")) {
        return { ok: false, error: "Slug đã tồn tại trong cùng ngôn ngữ" }
      }
      return { ok: false, error: error.message }
    }
    revalidatePath("/insights")
    revalidatePath(`/insights/${data.slug}`)
    revalidatePath("/admin/content/posts")
    return { ok: true, id: data.id, slug: data.slug }
  }

  const { data, error } = await db
    .from(TABLE)
    .insert({ ...payload, author_id: userId })
    .select("id, slug")
    .single()

  if (error) {
    console.error("[v0] savePost insert error:", error.message)
    if ((error.message ?? "").includes("duplicate")) {
      return { ok: false, error: "Slug đã tồn tại trong cùng ngôn ngữ" }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/insights")
  revalidatePath(`/insights/${data.slug}`)
  revalidatePath("/admin/content/posts")
  return { ok: true, id: data.id, slug: data.slug }
}

export async function deletePost(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireCap(CAPS.CONTENT_PUBLISH)
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error === "unauthenticated" ? "Vui lòng đăng nhập" : "Bạn không có quyền",
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = guard.admin as unknown as { from: (t: string) => any }
  const { error } = await db.from(TABLE).delete().eq("id", id)
  if (error) {
    console.error("[v0] deletePost error:", error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath("/insights")
  revalidatePath("/admin/content/posts")
  return { ok: true }
}

export async function updatePostStatus(
  id: string,
  status: PostStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const requiredCap =
    status === "published" ? CAPS.CONTENT_PUBLISH : CAPS.CONTENT_WRITE
  const guard = await requireCap(requiredCap)
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error === "unauthenticated" ? "Vui lòng đăng nhập" : "Bạn không có quyền",
    }
  }

  const payload: Record<string, unknown> = { status }
  if (status === "published") {
    payload.published_at = new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = guard.admin as unknown as { from: (t: string) => any }
  const { error } = await db.from(TABLE).update(payload).eq("id", id)
  if (error) {
    console.error("[v0] updatePostStatus error:", error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath("/insights")
  revalidatePath("/admin/content/posts")
  return { ok: true }
}
