"use client"

import { useState, useTransition } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { updateSlaTarget } from "@/app/admin/sla/actions"
import { SLA_METRIC_META, type SlaTarget } from "@/lib/sla/types"

interface Props {
  target: SlaTarget
  /** False = read-only display (no save button). */
  canWrite: boolean
}

function unitLabel(metricKey: keyof typeof SLA_METRIC_META): string {
  switch (SLA_METRIC_META[metricKey].unit) {
    case "hours":
      return "giờ làm việc"
    case "business_days":
      return "ngày làm việc"
    case "days":
      return "ngày"
    case "count":
      return "lượt"
    case "boolean":
      return "1=bắt buộc, 0=không"
  }
}

export function SlaTargetForm({ target, canWrite }: Props) {
  const meta = SLA_METRIC_META[target.metric_key]
  const [value, setValue] = useState(String(target.target_value))
  const [weight, setWeight] = useState(String(target.weight))
  const [notes, setNotes] = useState(target.notes ?? "")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function save() {
    const v = Number(value)
    const w = Number(weight)
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Target không hợp lệ")
      return
    }
    if (!Number.isFinite(w) || w < 0 || w > 1) {
      toast.error("Weight phải trong khoảng 0-1")
      return
    }
    startTransition(async () => {
      const res = await updateSlaTarget({
        id: target.id,
        target_value: v,
        weight: w,
        notes: notes.trim() || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể lưu")
        return
      }
      toast.success(`Đã lưu ${meta.labelVi}`)
      router.refresh()
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">
              {meta.labelVi}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {meta.descVi}
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] shrink-0">
            {target.billing_plan_id == null ? "Mặc định" : "Tuỳ chỉnh"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Target ({unitLabel(target.metric_key)})</FieldLabel>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={!canWrite || isPending}
            />
          </Field>
          <Field>
            <FieldLabel>Weight (0-1)</FieldLabel>
            <Input
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={!canWrite || isPending}
            />
            <FieldDescription>
              Trọng số trong Health Score
            </FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel>Ghi chú</FieldLabel>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Tham chiếu điều khoản hoặc lý do điều chỉnh"
            disabled={!canWrite || isPending}
          />
        </Field>

        {canWrite && (
          <Button
            onClick={save}
            disabled={isPending}
            size="sm"
            className="w-full gap-1.5"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Lưu
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
