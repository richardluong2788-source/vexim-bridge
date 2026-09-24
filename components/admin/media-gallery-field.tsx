"use client"

import { useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { Loader2, Plus, X, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ImageLinkInput } from "@/components/ui/image-link-input"
import { toast } from "sonner"
import { validateAndCompressImage, MAX_INPUT_SIZE } from "@/lib/images/compress"

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
  const [compressing, setCompressing] = useState(false)
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
    const toUploadRaw = files.slice(0, remaining)

    for (const f of toUploadRaw) {
      if (f.size > MAX_INPUT_SIZE) {
        toast.error(`"${f.name}" vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn 5MB.`)
        return
      }
    }

    setCompressing(true)
    let toUpload: File[] = []
    try {
      for (const f of toUploadRaw) {
        try {
          const result = await validateAndCompressImage(f)
          toUpload.push(result.file)
        } catch (err: any) {
          toast.error(err.message || `Không thể xử lý ảnh ${f.name}`)
          setCompressing(false)
          return
        }
      }
    } finally {
      setCompressing(false)
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
        uploaded.length > 1 ? `Đã tải lên ${uploaded.length} ảnh` : "Tải lên thành công"
      )
    } catch (error) {
      console.error("[v0] gallery upload error:", error)
      toast.error("Tải lên thất bại. Vui lòng thử lại.")
    } finally {
      setUploading(false)
    }
  }

  const handleLinksAdd = (urls: string[]) => {
    onChange([...value, ...urls].slice(0, maxFiles))
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <ImageLinkInput
        existing={value}
        max={maxFiles}
        onAdd={handleLinksAdd}
        disabled={uploading || compressing}
      />

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {value.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square rounded-lg border border-border overflow-hidden bg-muted/30 group"
          >
            <img
              src={url || "/placeholder.svg"}
              alt={`${label} ${index + 1}`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.svg"
              }}
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
            disabled={uploading || compressing}
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border border-dashed border-border hover:border-accent/50 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
          >
            {uploading || compressing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                <span className="text-[11px] font-medium">Thêm ảnh</span>
                <span className="text-[9px] italic">Bổ sung sau OK</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          <span>
            {value.length}/{maxFiles} ảnh · Dưới 5MB/ảnh · <span className="italic">Bạn có thể bổ sung sau</span>
          </span>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleFilesSelect}
      />
    </div>
  )
}
