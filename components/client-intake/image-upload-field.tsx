"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, X } from "lucide-react"
import { upload } from "@vercel/blob/client"

import { cn } from "@/lib/utils"

interface ImageUploadFieldProps {
  /** Current uploaded image URLs. */
  value: string[]
  /** Called with the next list of URLs whenever images are added or removed. */
  onChange: (urls: string[]) => void
  /** Maximum number of images allowed in this field. */
  max?: number
  /** Optional id used to associate an external label. */
  id?: string
  /** Recommended pixel dimensions shown as a hint, e.g. "1200 x 1200px (vuông)". */
  recommendedSize?: string
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,image/avif"
const MAX_BYTES = 5 * 1024 * 1024

export function ImageUploadField({
  value,
  onChange,
  max = 5,
  id,
  recommendedSize,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = max - value.length
  const canAdd = remaining > 0 && !isUploading

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)

    const files = Array.from(fileList).slice(0, remaining)
    if (files.length < fileList.length) {
      setError(`Chỉ được tải tối đa ${max} ảnh cho mục này.`)
    }

    const oversized = files.find((f) => f.size > MAX_BYTES)
    if (oversized) {
      setError("Mỗi ảnh không được vượt quá 5MB.")
      return
    }

    setIsUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/client-intake/upload",
        })
        uploaded.push(blob.url)
      }
      onChange([...value, ...uploaded])
    } catch (err) {
      console.error("[v0] image upload failed:", err)
      setError("Tải ảnh thất bại, vui lòng thử lại.")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
    setError(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div
            key={url}
            className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted"
          >
            <Image
              src={url || "/placeholder.svg"}
              alt={`Ảnh đã tải ${i + 1}`}
              fill
              sizes="96px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/70 text-background transition-opacity hover:bg-foreground"
              aria-label={`Xoá ảnh ${i + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary",
            )}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span>Tải ảnh lên</span>
              </>
            )}
          </button>
        )}

        {isUploading && !canAdd && (
          <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED}
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="text-xs text-muted-foreground">
        {value.length}/{max} ảnh · JPG, PNG, WEBP — tối đa 5MB mỗi ảnh
        {max > 1 && " · có thể chọn nhiều ảnh cùng lúc"}
      </p>
      {recommendedSize && (
        <p className="text-xs text-muted-foreground">
          Kích thước đề xuất: {recommendedSize}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
