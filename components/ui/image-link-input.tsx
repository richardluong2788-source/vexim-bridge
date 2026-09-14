"use client"

import { useState } from "react"
import { Link2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { parseImageLinks, normalizeImageLink } from "@/lib/utils/image-link"
import { cn } from "@/lib/utils"

interface ImageLinkInputProps {
  /** Danh sách URL ảnh hiện có (để chống thêm trùng). */
  existing: string[]
  /** Số ảnh tối đa cho phép. */
  max: number
  /** Được gọi với các URL hợp lệ mỗi khi người dùng thêm link. */
  onAdd: (urls: string[]) => void
  placeholder?: string
  buttonLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Ô dán link ảnh dùng chung cho các form có thư viện ảnh (sản phẩm,
 * ảnh nhà máy, logo/ảnh bìa...). Hỗ trợ dán nhiều link cùng lúc, cách
 * nhau bởi dấu cách/dấu phẩy/xuống dòng. Link được thêm trực tiếp vào
 * danh sách mà không cần upload — ảnh sẽ hiện thumbnail ngay bên dưới.
 */
export function ImageLinkInput({
  existing,
  max,
  onAdd,
  placeholder = "Dán link ảnh tại đây (https://...) — có thể dán nhiều link",
  buttonLabel = "Thêm link",
  disabled = false,
  className,
}: ImageLinkInputProps) {
  const [value, setValue] = useState("")
  const remaining = max - existing.length

  const handleAdd = () => {
    if (remaining <= 0) {
      toast.error(`Tối đa ${max} ảnh.`)
      return
    }

    const parsed = parseImageLinks(value, existing).map(normalizeImageLink)
    // Sau khi normalize (vd. link Google Drive) có thể phát sinh trùng.
    const seen = new Set(existing)
    const links = parsed.filter((url) => {
      if (seen.has(url)) return false
      seen.add(url)
      return true
    })

    if (links.length === 0) {
      toast.error("Vui lòng dán link ảnh hợp lệ, bắt đầu bằng https://")
      return
    }

    const accepted = links.slice(0, remaining)
    onAdd(accepted)
    setValue("")

    if (accepted.length < links.length) {
      toast.error(`Chỉ thêm được ${accepted.length} ảnh do đạt giới hạn ${max} ảnh.`)
    } else {
      toast.success(
        accepted.length > 1 ? `Đã thêm ${accepted.length} ảnh từ link` : "Đã thêm ảnh từ link",
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (!disabled && remaining > 0 && value.trim()) handleAdd()
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative flex-1">
        <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || remaining <= 0}
          className="pl-8"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        disabled={disabled || remaining <= 0 || !value.trim()}
        className="shrink-0 gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {buttonLabel}
      </Button>
    </div>
  )
}
