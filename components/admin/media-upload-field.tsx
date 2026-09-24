"use client"

import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { Loader2, X, ImageIcon, Video, Link2Off, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { isValidImageUrl } from "@/lib/utils/image-link"
import { validateAndCompressImage } from "@/lib/images/compress"

interface MediaUploadFieldProps {
  id: string
  label: string
  value: string
  onChange: (url: string) => void
  kind: "image" | "video"
  hint?: string
  folder: string
}

const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/webm,video/quicktime",
}

const MAX_SIZE = {
  image: 5 * 1024 * 1024, // Spec B: 5MB limit, auto compress 300-800KB
  video: 200 * 1024 * 1024,
}

export function MediaUploadField({ id, label, value, onChange, kind, hint, folder }: MediaUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [previewBroken, setPreviewBroken] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPreviewBroken(false)
  }, [value])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > MAX_SIZE[kind]) {
      const maxMb = MAX_SIZE[kind] / (1024 * 1024)
      toast.error(`File quá lớn. Tối đa ${maxMb}MB.`)
      return
    }

    let fileToUpload = file
    if (kind === "image") {
      setCompressing(true)
      try {
        const result = await validateAndCompressImage(file)
        fileToUpload = result.file
        if (result.wasCompressed) {
          toast.success(`Đã tối ưu: ${(result.originalSize / 1024).toFixed(0)}KB → ${(result.compressedSize / 1024).toFixed(0)}KB`)
        }
      } catch (err: any) {
        toast.error(err.message || "Không thể xử lý ảnh")
        setCompressing(false)
        return
      }
      setCompressing(false)
    }

    setUploading(true)
    try {
      const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const blob = await upload(`${folder}/${Date.now()}_${safeName}`, fileToUpload, {
        access: "public",
        handleUploadUrl: "/api/profile/upload-media",
      })
      onChange(blob.url)
      toast.success("Tải lên thành công")
    } catch (error) {
      console.error("[v0] media upload error:", error)
      toast.error("Tải lên thất bại. Vui lòng thử lại.")
    } finally {
      setUploading(false)
    }
  }

  const isYoutube = kind === "video" && /youtube\.com|youtu\.be/.test(value)
  const showImagePreview = kind === "image" && value && isValidImageUrl(value)
  const showInvalidLinkNote = kind === "image" && value && !isValidImageUrl(value)

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
        {kind === "image" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
            <Sparkles className="h-3 w-3" /> 5MB → 300-800KB
          </span>
        )}
      </Label>

      {value ? (
        <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
          {kind === "image" ? (
            showImagePreview ? (
              previewBroken ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Link2Off className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="truncate">
                    Không tải được ảnh từ link này — kiểm tra lại link có công khai không.
                  </span>
                </div>
              ) : (
                <img
                  src={value}
                  alt={label}
                  loading="lazy"
                  onError={() => setPreviewBroken(true)}
                  className="w-full max-h-48 object-contain"
                />
              )
            ) : showInvalidLinkNote ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">Đang chờ link ảnh hợp lệ (bắt đầu bằng https://)...</span>
              </div>
            ) : null
          ) : isYoutube ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Video className="h-4 w-4 shrink-0" />
              <span className="truncate">{value}</span>
            </div>
          ) : (
            <video src={value} className="w-full max-h-48" controls />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => onChange("")}
            aria-label="Xóa"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="flex-1"
        />
        {(kind === "video" || !showImagePreview) && (
        <Button
          type="button"
          variant="outline"
          disabled={uploading || compressing}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 gap-2"
        >
          {uploading || compressing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : kind === "image" ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <Video className="h-4 w-4" />
          )}
          {compressing ? "Đang nén..." : uploading ? "Đang tải..." : "Chọn file"}
        </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[kind]}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {kind === "image" && (
        <p className="text-[11px] text-muted-foreground">
          Dưới 5MB/ảnh, tự nén còn 300-800KB WebP. <span className="italic">Bạn có thể bổ sung sau</span> – không bắt buộc ngay.
        </p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
