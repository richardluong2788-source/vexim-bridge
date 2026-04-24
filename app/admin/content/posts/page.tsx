import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, FileText } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { adminListAllPosts } from "@/lib/insights/queries"
import { getCategoryMeta } from "@/lib/insights/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export const dynamic = "force-dynamic"

interface SearchParams {
  status?: "draft" | "published" | "archived" | "all"
  locale?: "vi" | "en" | "all"
  q?: string
  page?: string
}

const PAGE_SIZE = 20

export default async function AdminContentPostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.CONTENT_VIEW)) redirect("/admin")

  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const status = sp.status ?? "all"
  const locale = sp.locale ?? "all"
  const search = sp.q?.trim()

  const { posts, total } = await adminListAllPosts({
    status,
    locale,
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canWrite = can(current.role, CAPS.CONTENT_WRITE)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights — Bài viết</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý blog công khai tại{" "}
            <Link href="/insights" className="underline underline-offset-4" target="_blank">
              /insights
            </Link>
            . Tổng: {total} bài.
          </p>
        </div>
        {canWrite ? (
          <Button asChild className="gap-1.5">
            <Link href="/admin/content/posts/new">
              <Plus className="h-4 w-4" />
              Tạo bài mới
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
          <CardDescription>Lọc theo trạng thái, ngôn ngữ và từ khoá.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="flex flex-col gap-3 md:flex-row md:items-end"
          >
            <div className="flex flex-col gap-1 md:w-44">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                Trạng thái
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="draft">Nháp</option>
                <option value="published">Đã xuất bản</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 md:w-36">
              <label htmlFor="locale" className="text-xs font-medium text-muted-foreground">
                Ngôn ngữ
              </label>
              <select
                id="locale"
                name="locale"
                defaultValue={locale}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Tìm kiếm
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={search ?? ""}
                placeholder="Tiêu đề hoặc slug…"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <Button type="submit" variant="secondary" className="md:w-auto">
              Lọc
            </Button>
          </form>
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Chưa có bài viết nào</EmptyTitle>
            <EmptyDescription>
              Tạo bài viết đầu tiên để xuất bản trên /insights.
            </EmptyDescription>
          </EmptyHeader>
          {canWrite ? (
            <EmptyContent>
              <Button asChild>
                <Link href="/admin/content/posts/new">
                  <Plus className="h-4 w-4" />
                  Tạo bài mới
                </Link>
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead className="w-32">Danh mục</TableHead>
                  <TableHead className="w-20">Ngôn ngữ</TableHead>
                  <TableHead className="w-28">Trạng thái</TableHead>
                  <TableHead className="w-36">Cập nhật</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => {
                  const cat = getCategoryMeta(p.category)
                  const scheduled =
                    p.status === "published" &&
                    p.published_at != null &&
                    new Date(p.published_at) > new Date()
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/admin/content/posts/${p.id}`}
                            className="flex flex-col gap-0.5 hover:text-accent"
                          >
                            <span className="font-medium text-foreground">{p.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              /{p.slug}
                            </span>
                          </Link>
                          <Link
                            href={`/insights/preview/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs font-medium text-accent underline-offset-4 hover:underline"
                          >
                            Xem trước
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{cat.labelVi}</TableCell>
                      <TableCell className="text-sm uppercase">{p.locale}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} scheduled={scheduled} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.updated_at).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border p-4 text-sm text-muted-foreground">
              <span>
                Trang {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildAdminHref({
                        page: page - 1,
                        status,
                        locale,
                        q: search,
                      })}
                    >
                      ← Trước
                    </Link>
                  </Button>
                ) : null}
                {page < totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildAdminHref({
                        page: page + 1,
                        status,
                        locale,
                        q: search,
                      })}
                    >
                      Sau →
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  scheduled,
}: {
  status: "draft" | "published" | "archived"
  scheduled?: boolean
}) {
  if (status === "published" && scheduled) {
    return (
      <Badge className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/15">
        Scheduled
      </Badge>
    )
  }
  if (status === "published") {
    return <Badge className="bg-accent/15 text-accent hover:bg-accent/20">Published</Badge>
  }
  if (status === "archived") {
    return <Badge variant="outline">Archived</Badge>
  }
  return <Badge variant="secondary">Draft</Badge>
}

function buildAdminHref(opts: {
  page: number
  status: string
  locale: string
  q?: string
}): string {
  const params = new URLSearchParams()
  if (opts.status && opts.status !== "all") params.set("status", opts.status)
  if (opts.locale && opts.locale !== "all") params.set("locale", opts.locale)
  if (opts.q) params.set("q", opts.q)
  if (opts.page > 1) params.set("page", String(opts.page))
  const qs = params.toString()
  return qs ? `/admin/content/posts?${qs}` : "/admin/content/posts"
}
