"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { deleteBuyer } from "@/app/admin/buyers/actions"

interface DeleteBuyerButtonProps {
  buyerId: string
  buyerName: string | null
  locale: "vi" | "en"
  onDeleted?: () => void
  variant?: "ghost" | "outline" | "destructive"
  size?: "sm" | "md" | "lg"
}

export function DeleteBuyerButton({
  buyerId,
  buyerName,
  locale,
  onDeleted,
  variant = "ghost",
  size = "sm",
}: DeleteBuyerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    const result = await deleteBuyer(buyerId)

    if (!result.ok) {
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, { vi: string; en: string }> = {
        buyer_not_found: {
          vi: "Không tìm thấy buyer",
          en: "Buyer not found",
        },
        buyer_has_opportunities: {
          vi: "Buyer này vẫn có cơ hội. Vui lòng xóa tất cả cơ hội trước khi xóa buyer.",
          en: "This buyer still has opportunities. Please delete all opportunities first.",
        },
        permission_denied: {
          vi: "Bạn không có quyền xóa buyer",
          en: "You don't have permission to delete this buyer",
        },
      }

      const msg = errorMessages[result.error]
      setError(msg ? msg[locale] : result.error)
      setIsLoading(false)
      return
    }

    setIsOpen(false)
    onDeleted?.()
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        title={locale === "vi" ? "Xóa buyer" : "Delete buyer"}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {locale === "vi" ? "Xóa Buyer" : "Delete Buyer"}
            </DialogTitle>
            <DialogDescription>
              {locale === "vi"
                ? `Bạn sắp xóa "${buyerName || "Buyer"}" khỏi hệ thống. Hành động này không thể hoàn tác.`
                : `You are about to delete "${buyerName || "Buyer"}" from the system. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              {locale === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {locale === "vi" ? "Đang xóa..." : "Deleting..."}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {locale === "vi" ? "Xóa Buyer" : "Delete Buyer"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
