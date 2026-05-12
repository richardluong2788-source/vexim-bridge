"use client"

import { useState, useRef, useCallback } from "react"
import { Paperclip, X, Upload, FileText, Image as ImageIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { UploadedAttachment } from "@/app/api/attachments/upload/route"

interface Props {
  attachments: UploadedAttachment[]
  onChange: (attachments: UploadedAttachment[]) => void
  disabled?: boolean
}

const MAX_FILES = 5
const MAX_SIZE_MB = 10

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/")
}

export function EmailAttachmentPicker({ attachments, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)

      // Validate count
      if (attachments.length + fileArray.length > MAX_FILES) {
        setError(`Tối đa ${MAX_FILES} files`)
        return
      }

      // Validate sizes
      for (const file of fileArray) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          setError(`"${file.name}" vượt quá ${MAX_SIZE_MB}MB`)
          return
        }
      }

      setError(null)
      setUploading(true)

      try {
        const formData = new FormData()
        fileArray.forEach((file) => formData.append("files", file))

        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Upload failed")
        }

        const data = await res.json()
        onChange([...attachments, ...data.attachments])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [attachments, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled || uploading) return
      handleFiles(e.dataTransfer.files)
    },
    [disabled, uploading, handleFiles]
  )

  const handleRemove = useCallback(
    (index: number) => {
      onChange(attachments.filter((_, i) => i !== index))
    },
    [attachments, onChange]
  )

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          (disabled || uploading) && "pointer-events-none opacity-50"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Kéo thả files vào đây hoặc{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-primary hover:underline"
              >
                chọn files
              </button>
            </p>
            <p className="text-xs text-muted-foreground/70">
              Tối đa {MAX_FILES} files, mỗi file {MAX_SIZE_MB}MB
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att, index) => (
            <li
              key={att.url}
              className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2"
            >
              {/* Thumbnail or icon */}
              {isImageType(att.contentType) ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{att.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(att.size)}
                </p>
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Xóa</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add more button when has attachments */}
      {attachments.length > 0 && attachments.length < MAX_FILES && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Paperclip className="mr-2 h-4 w-4" />
          Thêm file
        </Button>
      )}
    </div>
  )
}
