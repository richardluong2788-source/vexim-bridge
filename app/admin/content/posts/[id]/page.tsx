import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { adminGetPostById } from "@/lib/insights/queries"
import { PostForm } from "@/components/admin/content/post-form"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditInsightsPostPage({ params }: PageProps) {
  const { id } = await params
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.CONTENT_VIEW)) redirect("/admin")

  const post = await adminGetPostById(id)
  if (!post) notFound()

  const statusLabel =
    post.status === "published"
      ? "Đã xuất bản"
      : post.status === "archived"
        ? "Lưu trữ"
        : "Nháp"

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:p-8">
      <div>
        <Link
          href="/admin/content/posts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Chỉnh sửa: {post.title}
          </h1>
          <Badge variant={post.status === "published" ? "default" : "secondary"}>
            {statusLabel}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Slug hiện tại:{" "}
          <span className="font-mono text-foreground">/{post.slug}</span>
        </p>
      </div>

      <PostForm post={post} />
    </div>
  )
}
