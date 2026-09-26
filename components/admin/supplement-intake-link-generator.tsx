"use client"

// Link bổ sung hồ sơ doanh nghiệp (form /client-intake/[token]) cho client
// ĐÃ có tài khoản — sinh lại bất cứ lúc nào từ trang chi tiết client.
//
// Fix 27/09/2026: trước đây link này chỉ sinh được một lần ở panel success
// của /admin/clients/new ("Tạo link bổ sung hồ sơ") — lỡ đóng trang là không
// còn cách nào gửi form doanh nghiệp cho client nữa, trong khi link nhập
// SẢN PHẨM thì luôn sẵn ở tab Sản phẩm. Component này cân bằng lại.

import { useEffect, useState } from "react"
import { Link2, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  createSupplementLinkForClient,
  listSupplementIntakeLinks,
  type SupplementIntakeLinkRow,
} from "@/app/admin/clients/new/actions"

export function SupplementIntakeLinkGenerator({ clientId }: { clientId: string }) {
  const [links, setLinks] = useState<SupplementIntakeLinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function load() {
    setLoading(true)
    const res = await listSupplementIntakeLinks(clientId)
    if (res.ok) setLinks(res.data ?? [])
    setLoading(false)
  }

  async function handleCreate() {
    setCreating(true)
    const res = await createSupplementLinkForClient(clientId)
    setCreating(false)
    if (res.ok && res.url) {
      toast.success("Đã tạo link bổ sung hồ sơ — copy gửi cho client")
      load()
    } else {
      toast.error(res.error === "forbidden" ? "Bạn không có quyền tạo link hồ sơ" : "Tạo link thất bại")
    }
  }

  async function copy(url: string, id: string) {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Form thông tin doanh nghiệp (link bổ sung hồ sơ)</CardTitle>
        <CardDescription>
          Client điền: Giới thiệu doanh nghiệp · Năng lực &amp; Chứng nhận · Đánh giá nhà máy (không gồm Liên hệ
          &amp; Đăng ký vì tài khoản đã có). Mỗi link dùng một lần, hết hạn sau 14 ngày. Sau khi client submit,
          submission nằm ở &quot;Hồ sơ chờ duyệt&quot; (/admin/clients/intake).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
          Tạo link mới
        </Button>

        {loading ? (
          <p className="text-xs text-muted-foreground">Đang tải…</p>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Chưa có link nào cho client này. Bấm &quot;Tạo link mới&quot; rồi gửi cho client qua chat/email.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((l) => {
              const used = !!l.usedAt
              const expired = l.expiresAt ? new Date(l.expiresAt) < new Date() : false
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <Input readOnly value={l.url} className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copy(l.url, l.id)} disabled={used}>
                    {copiedId === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {used
                      ? `đã dùng ${new Date(l.usedAt!).toLocaleDateString("vi-VN")}`
                      : expired
                        ? `hết hạn ${new Date(l.expiresAt!).toLocaleDateString("vi-VN")}`
                        : `hết hạn ${l.expiresAt ? new Date(l.expiresAt).toLocaleDateString("vi-VN") : "—"}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
