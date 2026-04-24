import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { PostForm } from "@/components/admin/content/post-form"

export const dynamic = "force-dynamic"

export default async function NewInsightsPostPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.CONTENT_WRITE)) redirect("/admin/content/posts")

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
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Tạo bài viết mới</h1>
        <p className="text-sm text-muted-foreground">
          Lưu nháp để chỉnh sửa sau, hoặc chọn <strong>Xuất bản</strong> để đăng ngay.
        </p>
      </div>

      <PostForm />
    </div>
  )
}
