"use client"

import Image from "next/image"
import { X } from "lucide-react"

import { ImageLinkInput } from "@/components/ui/image-link-input"

interface ImageLinkFieldProps {
  /** Current image URLs. */
  value: string[]
  /** Called with the next list of URLs whenever images are added or removed. */
  onChange: (urls: string[]) => void
  /** Maximum number of images allowed in this field. */
  max?: number
  /** Recommended pixel dimensions shown as a hint, e.g. "1200 x 1200px (vuông)". */
  recommendedSize?: string
}

/**
 * Trường ảnh trong phiếu khảo sát gửi cho nhà cung cấp: CHỈ nhận link ảnh
 * công khai (không cho tải file từ máy) và KHÔNG bắt buộc — nhà cung cấp
 * có thể bỏ trống, nhân viên sẽ xin ảnh sau và cập nhật từ màn hình nội bộ.
 */
export function ImageLinkField({
  value,
  onChange,
  max = 5,
  recommendedSize,
}: ImageLinkFieldProps) {
  // Thêm ảnh bằng link ngoài: chỉ lưu URL, không upload nên không tốn dung lượng.
  function handleLinksAdd(urls: string[]) {
    onChange([...value, ...urls].slice(0, max))
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Chỉ cho dán link ảnh — không có ô chọn file từ máy. */}
      <ImageLinkInput
        existing={value}
        max={max}
        onAdd={handleLinksAdd}
        placeholder="Dán link ảnh công khai (https://...)"
      />

      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div
              key={url}
              className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted"
            >
              <Image
                src={url || "/placeholder.svg"}
                alt={`Ảnh đã thêm ${i + 1}`}
                fill
                sizes="96px"
                className="object-cover"
                onError={(e) => {
                  // Link hỏng/không phải ảnh công khai: hiển thị ảnh placeholder.
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

      <p className="text-xs text-muted-foreground">
        {value.length}/{max} ảnh · chỉ nhận link ảnh (JPG, PNG, WEBP…){max > 1
          ? " · có thể dán nhiều link cùng lúc"
          : ""}
      </p>
      {recommendedSize && (
        <p className="text-xs text-muted-foreground">
          Kích thước đề xuất: {recommendedSize}
        </p>
      )}
    </div>
  )
}
