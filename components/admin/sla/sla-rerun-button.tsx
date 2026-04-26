"use client"

import { useState, useTransition } from "react"
import { RefreshCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { triggerSlaEvaluation } from "@/app/admin/sla/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface SlaRerunButtonProps {
  periodMonth: string
}

/**
 * Triggers the SLA evaluator for the given period_month from the admin UI.
 * Wraps the server action with a small popover so the user can opt into
 * `force=true` (drops the prior run row first).
 */
export function SlaRerunButton({ periodMonth }: SlaRerunButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [force, setForce] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleRun() {
    startTransition(async () => {
      const res = await triggerSlaEvaluation({ periodMonth, force })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể chạy đánh giá SLA")
        return
      }
      const inserted = res.data?.violations_inserted ?? 0
      const scanned = res.data?.scanned_clients ?? 0
      toast.success(
        `Đánh giá xong — ${scanned} client, +${inserted} vi phạm mới`,
      )
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          Chạy lại đánh giá
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">
              Re-evaluate tháng {periodMonth.slice(0, 7)}
            </h4>
            <p className="text-xs text-muted-foreground">
              Chạy bộ đánh giá SLA cho toàn bộ client. Vi phạm trùng đã ghi
              trước đó sẽ KHÔNG bị tạo lại nhờ unique index — bạn có thể chạy
              an toàn nhiều lần.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="sla-force"
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
              disabled={isPending}
            />
            <div className="grid gap-0.5">
              <Label
                htmlFor="sla-force"
                className="text-xs font-medium cursor-pointer"
              >
                Force (xóa run cũ)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Dùng khi run trước bị fail giữa chừng. Không xóa
                <code className="mx-1 rounded bg-muted px-1">sla_violations</code>
                — chỉ xóa marker idempotency.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Huỷ
            </Button>
            <Button size="sm" onClick={handleRun} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Chạy
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
