"use client"

import { useState, useEffect, useTransition } from "react"
import { Link2, Copy, Check, Search, Package, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"

interface ClientProduct {
  id: string
  product_name: string
  category: string | null
  status: string
}

interface Props {
  /** The opportunity ID to embed in the tracking link */
  opportunityId: string
  /** The client ID to fetch products from */
  clientId?: string | null
  disabled?: boolean
}

/**
 * Allows AE to pick a product and copy its tracking link.
 * The link includes a `ref` param so when buyer submits a quote,
 * it links back to the existing opportunity.
 */
export function ProductLinkPicker({ opportunityId, clientId, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<ClientProduct[]>([])
  const [loading, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Fetch products when popover opens
  useEffect(() => {
    if (open && clientId) {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/admin/client-products?clientId=${clientId}`)
          if (res.ok) {
            const data = await res.json()
            setProducts(data.products || [])
          }
        } catch {
          // Ignore errors
        }
      })
    }
  }, [open, clientId])

  const filteredProducts = products.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  )

  function generateTrackingLink(productId: string): string {
    // Encode opportunityId to base64 for cleaner URLs
    const ref = btoa(opportunityId)
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://veximtrade.com"
    return `${baseUrl}/products/${productId}?ref=${ref}`
  }

  async function handleCopy(productId: string) {
    const link = generateTrackingLink(productId)
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(productId)
      toast.success("Đã copy link sản phẩm")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("Không thể copy link")
    }
  }

  if (!clientId) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          Chèn link sản phẩm
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <p className="text-sm font-medium mb-2">Chọn sản phẩm để gửi cho buyer</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? "Không tìm thấy sản phẩm" : "Chưa có sản phẩm nào"}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filteredProducts.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {product.product_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.category && (
                        <span className="text-xs text-muted-foreground">
                          {product.category}
                        </span>
                      )}
                      <Badge
                        variant={product.status === "active" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {product.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleCopy(product.id)}
                    >
                      {copiedId === product.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a
                        href={generateTrackingLink(product.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-2 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground text-center">
            Link sẽ có tracking để liên kết buyer response với deal này
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
