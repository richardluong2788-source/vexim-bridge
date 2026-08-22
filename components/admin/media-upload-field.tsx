"use client"

import { useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { Loader2, Upload, X, ImageIcon, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

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
  image: 10 * 1024 * 1024,
  video: 200 * 1024 * 1024,
}

export function MediaUploadField({ id, label, value, onChange, kind, hint, folder }: MediaUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > MAX_SIZE[kind]) {
      const maxMb = MAX_SIZE[kind] / (1024 * 1024)
      toast.error(`File quá lớn. Tối đa ${maxMb}MB.`)
      return
    }

    setUploading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const blob = await upload(`${folder}/${Date.now()}_${safeName}`, file, {
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

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      {value ? (
        <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
          {kind === "image" ? (
            <img src={value} alt={label} className="w-full max-h-48 object-contain" />
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
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : kind === "image" ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <Video className="h-4 w-4" />
          )}
          {uploading ? "Đang tải..." : "Chọn file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[kind]}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
