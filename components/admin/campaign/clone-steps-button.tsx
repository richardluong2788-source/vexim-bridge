"use client"

// Clone sequence steps từ một campaign có sẵn (mặc định gợi ý campaign pilot)
// — campaign mới tạo ra không có steps nên không activate được; đây là cách
// admin dựng biến thể campaign nhanh (đổi segment/category/guidance sau).

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cloneStepsAction } from "@/app/admin/campaigns/actions"

export function CloneStepsButton({
  campaignId,
  sources,
}: {
  campaignId: string
  sources: Array<{ id: string; name: string; stepCount: number }>
}) {
  const router = useRouter()
  const withSteps = sources.filter((s) => s.id !== campaignId && s.stepCount > 0)
  const [sourceId, setSourceId] = useState<string>(withSteps[0]?.id ?? "")
  const [busy, setBusy] = useState(false)

  if (withSteps.length === 0) return null

  async function clone() {
    if (!sourceId) return
    setBusy(true)
    const res = await cloneStepsAction(sourceId, campaignId)
    setBusy(false)
    if (res.ok) {
      toast.success(`Đã copy ${res.copied} steps — chỉnh guidance rồi Kích hoạt`)
      router.refresh()
    } else {
      toast.error(res.message ?? "Copy thất bại")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={sourceId} onValueChange={setSourceId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Chọn campaign nguồn" />
        </SelectTrigger>
        <SelectContent>
          {withSteps.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} ({s.stepCount} steps)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={clone} disabled={busy || !sourceId}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
        Copy sequence
      </Button>
    </div>
  )
}
