"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus, Trash2, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Empty, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { addSlaHoliday, removeSlaHoliday } from "@/app/admin/sla/actions"

interface Holiday {
  holiday_date: string
  label: string
  country: string
}

interface Props {
  holidays: Holiday[]
  /** Read-only mode — non-admin staff just see the list. */
  canWrite: boolean
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function SlaHolidayManager({ holidays, canWrite }: Props) {
  const [date, setDate] = useState("")
  const [label, setLabel] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    if (!date || !label.trim()) {
      toast.error("Nhập đầy đủ ngày và mô tả")
      return
    }
    startTransition(async () => {
      const res = await addSlaHoliday({
        holiday_date: date,
        label: label.trim(),
      })
      if (!res.ok) {
        toast.error(res.error ?? "Không thể thêm")
        return
      }
      toast.success("Đã thêm ngày nghỉ")
      setDate("")
      setLabel("")
      router.refresh()
    })
  }

  function remove(d: string) {
    startTransition(async () => {
      const res = await removeSlaHoliday(d)
      if (!res.ok) {
        toast.error(res.error ?? "Không thể xóa")
        return
      }
      toast.success("Đã xóa")
      router.refresh()
    })
  }

  // Group by year for cleaner reading.
  const grouped = new Map<string, Holiday[]>()
  for (const h of holidays) {
    const y = h.holiday_date.slice(0, 4)
    if (!grouped.has(y)) grouped.set(y, [])
    grouped.get(y)!.push(h)
  }
  const years = Array.from(grouped.keys()).sort()

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
      {canWrite && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Thêm ngày nghỉ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Ngày</FieldLabel>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel>Mô tả</FieldLabel>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="VD: Quốc khánh"
                  maxLength={80}
                  disabled={isPending}
                />
              </Field>
              <Button onClick={submit} disabled={isPending} className="w-full">
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Lịch ngày nghỉ ({holidays.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {holidays.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyTitle>Chưa có ngày nghỉ nào</EmptyTitle>
              <EmptyDescription>
                Hệ thống evaluator sẽ coi mọi ngày trong tuần (T2-T6) là ngày
                làm việc cho đến khi bạn thêm ngày nghỉ.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="divide-y divide-border">
              {years.map((year) => (
                <div key={year}>
                  <div className="px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {year}
                  </div>
                  <ul className="divide-y divide-border">
                    {grouped
                      .get(year)!
                      .sort((a, b) =>
                        a.holiday_date.localeCompare(b.holiday_date),
                      )
                      .map((h) => (
                        <li
                          key={h.holiday_date}
                          className="px-4 py-2.5 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {h.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(h.holiday_date)}
                            </div>
                          </div>
                          {canWrite && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                              onClick={() => remove(h.holiday_date)}
                              disabled={isPending}
                              aria-label={`Xóa ${h.label}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
