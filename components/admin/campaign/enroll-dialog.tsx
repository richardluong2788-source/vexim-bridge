"use client"

// Enroll buyer pilot (quyết định §3): preview bộ lọc (food importer + VN signal
// + contact hợp lệ) → chọn ≤100 lead → chọn AE owner → enroll.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  enrollLeadsAction,
  listAeAction,
  previewPilotCandidatesAction,
  type PilotCandidate,
} from "@/app/admin/campaigns/actions"

export function EnrollDialog({
  campaignId,
  campaignStatus,
  canManage,
}: {
  campaignId: string
  campaignStatus: string
  canManage: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<PilotCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [ownerId, setOwnerId] = useState<string>("unassigned")
  const [enrolling, setEnrolling] = useState(false)

  if (!canManage) return null
  const disabled = campaignStatus !== "draft" && campaignStatus !== "active"

  async function load() {
    setLoading(true)
    const res = await previewPilotCandidatesAction()
    setLoading(false)
    if (res.ok) {
      setCandidates(res.candidates)
      // Default chọn tối đa 100 buyer đầu (shipment count desc = ưu tiên).
      setSelected(new Set(res.candidates.slice(0, 100).map((c) => c.leadId)))
    } else {
      toast.error(res.message ?? "Không load được danh sách lead")
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 100) next.add(id)
      else toast.error("Pilot giới hạn 100 buyer mỗi lần")
      return next
    })
  }

  async function enroll() {
    if (selected.size === 0) {
      toast.error("Chọn ít nhất 1 buyer")
      return
    }
    setEnrolling(true)
    const res = await enrollLeadsAction({
      campaignId,
      leadIds: [...selected],
      ownerId: ownerId === "unassigned" ? null : ownerId,
    })
    setEnrolling(false)
    if (res.ok) {
      toast.success(`Đã enroll ${res.enrolled} buyer${res.skipped.length ? `, bỏ qua ${res.skipped.length}` : ""}`)
      setOpen(false)
      router.refresh()
    } else {
      toast.error(res.message ?? "Enroll thất bại")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o && candidates.length === 0) load()
      }}
    >
      <DialogTrigger asChild>
        <Button variant={disabled ? "outline" : "default"} disabled={disabled}>
          <Sparkles className="mr-2 h-4 w-4" /> Enroll buyer pilot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enroll buyer pilot</DialogTitle>
          <DialogDescription>
            Bộ lọc: food importer + có tín hiệu sourcing từ Vietnam + contact hợp lệ, chưa
            suppress. Shipment count chỉ dùng sắp xếp ưu tiên. Tối đa 100/lần. Bỏ chọn AE →
            fallback là người tạo campaign khi handoff.
            {disabled && " — Campaign phải ở trạng thái draft/active."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {candidates.length} lead đạt bộ lọc · đã chọn <strong>{selected.size}</strong>
              </div>
              <div className="w-56">
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="AE sở hữu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">— Chưa gán AE —</SelectItem>
                    <AeOptions open={open} />
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="h-80 rounded-md border">
              <div className="divide-y">
                {candidates.map((c) => (
                  <label key={c.leadId} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                    <Checkbox checked={selected.has(c.leadId)} onCheckedChange={() => toggle(c.leadId)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.companyName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.industry ?? "—"} · {c.country ?? "—"} · {c.contactEmail ?? "no email"} · VN signal: {c.vietnamSignal}
                        {c.shipmentCount != null ? ` · ${c.shipmentCount} shipments` : ""}
                      </div>
                    </div>
                  </label>
                ))}
                {candidates.length === 0 && (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Không có lead nào đạt bộ lọc pilot.
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Label className="mr-auto text-xs text-muted-foreground">
            Enrollment trùng sẽ tự bỏ qua (unique constraint).
          </Label>
          <Button onClick={enroll} disabled={enrolling || loading || selected.size === 0 || disabled}>
            {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enroll {selected.size} buyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Danh sách AE cho owner select — load qua server action khi dialog mở. */
function AeOptions({ open }: { open: boolean }) {
  const [aeList, setAeList] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!open || aeList.length > 0) return
    listAeAction().then((res) => {
      if (res.ok) setAeList(res.aes)
    })
  }, [open, aeList.length])

  return (
    <>
      {aeList.map((ae) => (
        <SelectItem key={ae.id} value={ae.id}>
          {ae.name}
        </SelectItem>
      ))}
    </>
  )
}
