'use client'

import { useEffect, useState } from 'react'
import { Link2, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { createProductIntakeLink, listProductIntakeLinks } from '@/app/admin/clients/product-intake-actions'

interface Props {
  clientId: string
  clientName: string
}

interface LinkRow {
  id: string
  token: string
  url: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export function ProductIntakeLinkGenerator({ clientId, clientName }: Props) {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [clientId])

  const load = async () => {
    setLoading(true)
    try {
      const res = await listProductIntakeLinks(clientId)
      if (res.ok) {
        setLinks(res.data as any)
      }
    } catch {}
    setLoading(false)
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await createProductIntakeLink(clientId)
      if (res.ok && res.url) {
        toast.success(`Đã tạo link điền sản phẩm cho ${clientName}`)
        await load()
        // copy to clipboard
        await navigator.clipboard.writeText(res.url)
        toast.success('Đã copy link vào clipboard')
      } else {
        toast.error(res.error || 'Không tạo được link')
      }
    } catch (e) {
      toast.error('Lỗi hệ thống')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    toast.success('Đã copy link')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Link cho supplier tự điền sản phẩm
        </CardTitle>
        <CardDescription className="text-xs">
          AE tạo link gửi cho supplier sau khi tạo tài khoản. Supplier mở link không cần đăng nhập, điền sản phẩm kèm cam kết giá. Sản phẩm sẽ ở trạng thái chờ duyệt (inactive) để AE kiểm tra trước khi public.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={creating} size="sm">
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Tạo link mới
          </Button>
          <p className="text-xs text-muted-foreground self-center">Hạn 30 ngày, dùng nhiều lần</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có link nào. Bấm &quot;Tạo link mới&quot; để tạo.</p>
        ) : (
          <div className="space-y-2">
            {links.map((l) => {
              const expired = new Date(l.expires_at) < new Date()
              return (
                <div key={l.id} className={`flex items-center gap-2 rounded-md border p-2 ${expired ? 'opacity-50 bg-muted' : 'bg-card'}`}>
                  <Input value={l.url} readOnly className="flex-1 text-xs h-8" />
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleCopy(l.url)}>
                    {copied === l.url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {expired ? 'Hết hạn' : `Hết hạn ${new Date(l.expires_at).toLocaleDateString('vi-VN')}`}
                    {l.used_at && <span className="ml-1">· Đã dùng</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
