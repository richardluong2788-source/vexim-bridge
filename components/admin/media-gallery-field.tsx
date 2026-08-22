"use client"

import { useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { Loader2, Plus, X, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface MediaGalleryFieldProps {
  id: string
  label: string
  value: string[]
  onChange: (urls: string[]) => void
  hint?: string
  folder: string
  maxFiles?: number
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"
const MAX_SIZE = 10 * 1024 * 1024

export function MediaGalleryField({
  id,
  label,
  value,
  onChange,
  hint,
  folder,
  maxFiles = 12,
}: MediaGalleryFieldProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return

    const remaining = maxFiles - value.length
    if (remaining <= 0) {
      toast.error(`Tối đa ${maxFiles} ảnh.`)
      return
    }
    const toUpload = files.slice(0, remaining)

    const oversized = toUpload.find((f) => f.size > MAX_SIZE)
    if (oversized) {
      toast.error(`"${oversized.name}" quá lớn. Tối đa ${MAX_SIZE / (1024 * 1024)}MB mỗi ảnh.`)
      return
    }

    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of toUpload) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const blob = await upload(`${folder}/${Date.now()}_${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/profile/upload-media",
        })
        uploaded.push(blob.url)
      }
      onChange([...value, ...uploaded])
      toast.success(
        uploaded.length > 1 ? `Đã tải lên ${uploaded.length} ảnh` : "Tải lên thành công",
      )
    } catch (error) {
      console.error("[v0] gallery upload error:", error)
      toast.error("Tải lên thất bại. Vui lòng thử lại.")
    } finally {
      setUploading(false)
    }
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {value.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square rounded-lg border border-border overflow-hidden bg-muted/30 group"
          >
            <img
              src={url || "/placeholder.svg"}
              alt={`${label} ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeAt(index)}
              aria-label="Xóa ảnh"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {value.length < maxFiles && (
          <button
            id={id}
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border border-dashed border-border hover:border-accent/50 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                <span className="text-[11px] font-medium">Thêm ảnh</span>
              </>
            )}
          </button>
        )}
      </div>

      {value.length === 0 && !uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          <span>Chưa có ảnh nào. Bấm &quot;Thêm ảnh&quot; để tải lên (chọn được nhiều ảnh).</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleFilesSelect}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
