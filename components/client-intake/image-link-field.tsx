"use client"

import { useState } from "react"
import { SmartImage } from "@/components/ui/smart-image"
import { X, ImageIcon, Loader2 } from "lucide-react"
import { ImageLinkInput } from "@/components/ui/image-link-input"
import { Label } from "@/components/ui/label"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { validateAndCompressImage, MAX_INPUT_SIZE } from "@/lib/images/compress"

interface ImageLinkFieldProps {
  /** Current image URLs. */
  value: string[]
  /** Called with the next list of URLs whenever images are added or removed. */
  onChange: (urls: string[]) => void
  /** Maximum number of images allowed in this field. */
  max?: number
  /** Recommended pixel dimensions shown as a hint, e.g. "1200 x 1200px (vuông)". */
  recommendedSize?: string
  /** Intake token for authenticated Blob upload (public link). */
  token?: string
  /** Optional label override for upload zone */
  uploadLabel?: string
}

/**
 * Trường ảnh trong form đăng ký doanh nghiệp:
 * - Trước: CHỈ nhận link ảnh công khai
 * - Nay: thêm khung upload file trực tiếp, giới hạn 5MB
 * - Vẫn giữ link input để linh hoạt, số lượng ảnh giữ nguyên (max)
 */
export function ImageLinkField({
  value,
  onChange,
  max = 5,
  recommendedSize,
  token,
  uploadLabel,
}: ImageLinkFieldProps) {
  const [compressing, setCompressing] = useState(false)
  const [uploading, setUploading] = useState(false)

  function handleLinksAdd(urls: string[]) {
    onChange([...value, ...urls].slice(0, max))
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return

    if (value.length + selected.length > max) {
      toast.error(`Chỉ được tối đa ${max} ảnh. Hiện đã có ${value.length} ảnh.`)
      return
    }

    for (const f of selected) {
      if (f.size > MAX_INPUT_SIZE) {
        toast.error(`Ảnh "${f.name}" vượt quá 5MB (${(f.size / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn ảnh nhỏ hơn 5MB.`)
        return
      }
    }

    setCompressing(true)
    let compressedFiles: File[] = []
    try {
      for (const f of selected) {
        try {
          const result = await validateAndCompressImage(f)
          compressedFiles.push(result.file)
        } catch (err: any) {
          toast.error(err.message || `Không thể xử lý ảnh ${f.name}`)
          setCompressing(false)
          return
        }
      }
    } catch {
      setCompressing(false)
      return
    }
    setCompressing(false)

    // If token provided, upload to Vercel Blob, else use local object URLs as fallback? We need upload.
    if (!token) {
      // No token – fallback to local preview? But we need URL. Use object URL temporarily and let parent handle? For now just add as blob URL and warn.
      // Actually without token we can't upload, so we keep file as data URL? Simpler: convert to data URL and push as is? But spec says upload.
      // We'll try to use same product-intake upload route without token? Better to require token.
      // If no token, just create object URLs and let form submit handle? We'll add as blob URLs (will not persist). So warn.
      toast.error("Không có token upload – vui lòng dùng link ảnh hoặc liên hệ AE.")
      return
    }

    setUploading(true)
    try {
      const newUrls: string[] = []
      for (const file of compressedFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const blob = await upload(`client-intake/${token}/${Date.now()}_${safeName}`, file, {
          access: 'public',
          handleUploadUrl: `/api/client-intake/upload-images?token=${encodeURIComponent(token)}`,
          clientPayload: JSON.stringify({ token }),
        })
        newUrls.push(blob.url)
      }
      onChange([...value, ...newUrls].slice(0, max))
      toast.success(`Đã tải ${newUrls.length} ảnh lên`)
    } catch (err: any) {
      console.error("[ImageLinkField] upload failed:", err)
      toast.error(err.message || "Upload ảnh thất bại")
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const remaining = max - value.length
  const canAddMore = remaining > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Link input */}
      <ImageLinkInput
        existing={value}
        max={max}
        onAdd={handleLinksAdd}
        disabled={uploading || compressing}
        placeholder="Dán link ảnh công khai (https://...)"
      />

      {/* Upload frame – NEW */}
      {canAddMore && (
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
          <input
            type="file"
            id={`file-${token}-${max}-${recommendedSize}`}
            multiple={max > 1}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={uploading || compressing}
            className="hidden"
          />
          <Label htmlFor={`file-${token}-${max}-${recommendedSize}`} className="cursor-pointer flex flex-col items-center gap-1">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm font-medium">{uploadLabel || "Kéo thả ảnh vào đây hoặc bấm để chọn"}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF – Dưới 5MB/ảnh</p>
          </Label>
          {(compressing || uploading) && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {compressing ? "Đang xử lý ảnh..." : "Đang tải ảnh lên..."}
            </div>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted"
            >
              <SmartImage
                src={url || "/placeholder.svg"}
                alt={`Ảnh đã thêm ${i + 1}`}
                fill
                sizes="96px"
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg"
                }}
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
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {value.length}/{max} ảnh · {canAddMore ? "có thể dán link hoặc tải file" : "đã đủ số lượng"} · JPG, PNG, WEBP · Dưới 5MB
        </p>
        {recommendedSize && (
          <p className="text-xs text-muted-foreground">
            Kích thước đề xuất: {recommendedSize}
          </p>
        )}
      </div>
    </div>
  )
}
