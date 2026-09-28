"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createCampaignAction } from "@/app/admin/campaigns/actions"

/**
 * Dialog tạo campaign (admin/super_admin — server action kiểm tra lại).
 * Campaign tạo ra ở status 'draft'; cần có campaign_steps (seed 090 có sẵn
 * template cho pilot) trước khi activate.
 */
export function CreateCampaignDialog({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [segment, setSegment] = useState("")
  const [category, setCategory] = useState("")
  const [limit, setLimit] = useState("20")

  if (!canCreate) return null

  async function submit() {
    if (!name.trim()) {
      toast.error("Nhập tên campaign")
      return
    }
    setBusy(true)
    const res = await createCampaignAction({
      name,
      description,
      targetSegment: segment,
      productCategory: category,
      dailySendLimit: Number(limit) || 20,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("Đã tạo campaign (status: draft)")
      setOpen(false)
      setName("")
      setDescription("")
      router.push(`/admin/campaigns/${res.campaignId}`)
    } else {
      toast.error(res.message ?? "Không tạo được campaign")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Tạo campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo campaign mới</DialogTitle>
          <DialogDescription>
            Campaign ở trạng thái nháp. Sau khi tạo, thêm sequence steps rồi mới bật
            &ldquo;Đang chạy&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Tên *</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="US Food Buyer – Vietnam Sourcing – Q4 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-desc">Mô tả</Label>
            <Textarea id="campaign-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-segment">Target segment</Label>
              <Input
                id="campaign-segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="us_food_importer_vietnam_sourced"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-category">Product category</Label>
              <Input id="campaign-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="food" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-limit">Daily send limit (spec §22)</Label>
            <Input id="campaign-limit" type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
