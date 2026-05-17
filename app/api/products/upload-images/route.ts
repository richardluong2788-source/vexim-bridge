import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 10
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Tối đa ${MAX_FILES} ảnh` },
        { status: 400 }
      )
    }

    const urls: string[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Ảnh "${file.name}" vượt quá giới hạn 10MB` },
          { status: 400 }
        )
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Định dạng "${file.type}" không được hỗ trợ` },
          { status: 400 }
        )
      }

      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const pathname = `product-images/${user.id}/${timestamp}_${safeName}`

      const blob = await put(pathname, file, {
        access: "private",
        contentType: file.type,
      })

      urls.push(blob.url)
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error("[v0] product image upload error:", error)
    return NextResponse.json({ error: "Upload thất bại" }, { status: 500 })
  }
}
