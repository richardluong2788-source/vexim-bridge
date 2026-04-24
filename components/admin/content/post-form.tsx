"use client"

import { useActionState, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, Save, Trash2, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { InsightsMarkdown } from "@/components/insights/insights-markdown"
import {
  INSIGHT_CATEGORIES,
  estimateReadingTime,
  slugify,
  type InsightsPost,
} from "@/lib/insights/types"
import { savePost, deletePost, type SavePostState } from "@/app/admin/content/posts/actions"

interface PostFormProps {
  post?: InsightsPost
}

export function PostForm({ post }: PostFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<SavePostState | null, FormData>(
    savePost,
    null,
  )

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(post?.slug))
  const [locale, setLocale] = useState<"vi" | "en">(post?.locale ?? "vi")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [contentMd, setContentMd] = useState(post?.content_md ?? "")
  const [category, setCategory] = useState(post?.category ?? "fda-compliance")
  const [tags, setTags] = useState((post?.tags ?? []).join(", "))
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url ?? "")
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    post?.status ?? "draft",
  )
  const [publishedAt, setPublishedAt] = useState(
    post?.published_at ? toLocalDatetime(post.published_at) : "",
  )
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "")
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "")
  const [showPreview, setShowPreview] = useState(false)

  const [deleting, startDelete] = useTransition()

  const computedSlug = useMemo(
    () => (slug && slugTouched ? slug : slugify(title)),
    [title, slug, slugTouched],
  )
  const readingTime = useMemo(() => estimateReadingTime(contentMd), [contentMd])

  // React to action completion exactly once per state change.
  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success(post ? "Đã cập nhật bài viết" : "Đã tạo bài viết")
      if (!post) router.push(`/admin/content/posts/${state.id}`)
      else router.refresh()
    } else {
      toast.error(state.error ?? "Không thể lưu")
    }
    // We intentionally depend only on `state` — router/post are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function handleDelete() {
    if (!post) return
    startDelete(async () => {
      const res = await deletePost(post.id)
      if (res.ok) {
        toast.success("Đã xoá bài viết")
        router.push("/admin/content/posts")
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      {/* keep generated slug in sync when untouched */}
      <input type="hidden" name="slug" value={computedSlug} />

      {/* Main column */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Nội dung bài viết</CardTitle>
            <CardDescription>
              Viết bằng Markdown. Hỗ trợ heading, danh sách, bảng, blockquote và code block.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="title">
                Tiêu đề <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Hướng dẫn đăng ký FDA Food Facility 2026"
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={computedSlug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                }}
                placeholder="tu-dong-tao-tu-tieu-de"
              />
              <p className="text-xs text-muted-foreground">
                /insights/<span className="font-mono">{computedSlug || "…"}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="excerpt">Tóm tắt (hiển thị ở danh sách & SEO)</Label>
              <Textarea
                id="excerpt"
                name="excerpt"
                value={excerpt ?? ""}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Mô tả ngắn 1-2 câu về bài viết…"
              />
              <p className="text-xs text-muted-foreground">
                {(excerpt ?? "").length}/500
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="content_md">
                Nội dung (Markdown) <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
                className="gap-1.5"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Tắt xem trước" : "Xem trước"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Textarea
                id="content_md"
                name="content_md"
                value={contentMd}
                onChange={(e) => setContentMd(e.target.value)}
                rows={22}
                className="font-mono text-sm"
                placeholder={"## Tiêu đề\n\nĐoạn mở đầu…\n\n- Ý 1\n- Ý 2"}
              />
              {showPreview ? (
                <div className="rounded-md border border-border bg-background p-5 overflow-auto max-h-[540px]">
                  {contentMd.trim() ? (
                    <InsightsMarkdown>{contentMd}</InsightsMarkdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Chưa có nội dung để xem trước.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Thời gian đọc ước tính: <strong>{readingTime} phút</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tối ưu SEO</CardTitle>
            <CardDescription>
              Nếu để trống, hệ thống dùng tiêu đề và tóm tắt làm meta mặc định.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="seo_title">SEO title</Label>
              <Input
                id="seo_title"
                name="seo_title"
                value={seoTitle ?? ""}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={120}
                placeholder="≤ 60 ký tự tối ưu"
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="seo_description">SEO description</Label>
              <Textarea
                id="seo_description"
                name="seo_description"
                value={seoDescription ?? ""}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="≤ 160 ký tự tối ưu"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side column */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Đăng bài</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="status">Trạng thái</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as typeof status)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Bản nháp</SelectItem>
                  <SelectItem value="published">Xuất bản</SelectItem>
                  <SelectItem value="archived">Lưu trữ</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="status" value={status} />
            </div>

            {status === "published" ? (
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="published_at">Lên lịch (tùy chọn)</Label>
                <Input
                  id="published_at"
                  name="published_at"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Để trống để đăng ngay khi lưu.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Đang lưu…" : post ? "Cập nhật" : "Tạo bài viết"}
              </Button>

              {post ? (
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link href={`/insights/preview/${post.id}`} target="_blank">
                      <Eye className="h-4 w-4" />
                      Xem trước (nháp)
                    </Link>
                  </Button>
                  {post.status === "published" ? (
                    <Button asChild variant="ghost" size="sm" className="gap-1.5">
                      <Link href={`/insights/${post.slug}`} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                        Xem trên site
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {post ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xoá bài viết
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xoá bài viết?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Hành động này không thể hoàn tác. Bài viết sẽ biến mất khỏi danh
                        sách công khai ngay lập tức.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Huỷ</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Đang xoá…" : "Xoá"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân loại</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="locale">Ngôn ngữ</Label>
              <Select
                value={locale}
                onValueChange={(v) => setLocale(v as "vi" | "en")}
              >
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vi">Tiếng Việt</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="locale" value={locale} />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="category">Danh mục</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSIGHT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.labelVi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="category" value={category} />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="tags">Tags (phân tách dấu phẩy)</Label>
              <Input
                id="tags"
                name="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="fda, thuc-pham, xuat-khau"
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="cover_image_url">Ảnh bìa (URL)</Label>
              <Input
                id="cover_image_url"
                name="cover_image_url"
                type="url"
                value={coverImageUrl ?? ""}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://…/cover.jpg"
              />
              {coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="mt-2 aspect-[16/9] w-full rounded-md border border-border object-cover"
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}

function toLocalDatetime(iso: string): string {
  // Convert ISO → value compatible with <input type="datetime-local">
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
