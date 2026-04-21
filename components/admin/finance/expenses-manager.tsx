"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatDate, formatUsd, formatVnd } from "@/lib/finance/format"
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance/types"
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
  type ExpenseInput,
} from "@/app/admin/finance/expenses/actions"
import type { ExpenseCategory, OperatingExpense } from "@/lib/supabase/types"

interface Props {
  initial: OperatingExpense[]
  defaultFxRate: number
}

type Draft = {
  id: string | null
  expense_date: string
  category: ExpenseCategory
  vendor: string
  description: string
  amount_usd: string
  fx_rate_vnd_per_usd: string
  is_recurring: boolean
  recurring_frequency: "monthly" | "quarterly" | "yearly"
  notes: string
}

const FREQ_LABEL: Record<Draft["recurring_frequency"], string> = {
  monthly: "Hàng tháng",
  quarterly: "Hàng quý",
  yearly: "Hàng năm",
}

function freshDraft(fxRate: number): Draft {
  return {
    id: null,
    expense_date: new Date().toISOString().slice(0, 10),
    category: "tools",
    vendor: "",
    description: "",
    amount_usd: "",
    fx_rate_vnd_per_usd: String(fxRate),
    is_recurring: false,
    recurring_frequency: "monthly",
    notes: "",
  }
}

export function ExpensesManager({ initial, defaultFxRate }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editor, setEditor] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all")

  const filtered = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((r) => r.category === filter),
    [rows, filter],
  )

  const stats = useMemo(() => {
    const thisMonth = new Date()
    thisMonth.setUTCDate(1)
    const monthStartIso = thisMonth.toISOString().slice(0, 10)

    const monthTotal = rows
      .filter((r) => r.expense_date >= monthStartIso)
      .reduce((sum, r) => sum + (Number(r.amount_usd) || 0), 0)

    const recurringMonthly = rows
      .filter((r) => r.is_recurring)
      .reduce((sum, r) => {
        const amount = Number(r.amount_usd) || 0
        if (r.recurring_frequency === "monthly") return sum + amount
        if (r.recurring_frequency === "quarterly") return sum + amount / 3
        if (r.recurring_frequency === "yearly") return sum + amount / 12
        return sum
      }, 0)

    return { monthTotal, recurringMonthly, total: rows.length }
  }, [rows])

  function submit() {
    if (!editor) return
    setError(null)
    const amount = Number(editor.amount_usd)
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Số tiền không hợp lệ.")
      return
    }

    const input: ExpenseInput = {
      expense_date: editor.expense_date,
      category: editor.category,
      vendor: editor.vendor.trim() || null,
      description: editor.description.trim() || null,
      amount_usd: amount,
      fx_rate_vnd_per_usd: Number(editor.fx_rate_vnd_per_usd) || null,
      is_recurring: editor.is_recurring,
      recurring_frequency: editor.is_recurring
        ? editor.recurring_frequency
        : null,
      notes: editor.notes.trim() || null,
    }

    startTransition(async () => {
      const result = editor.id
        ? await updateExpenseAction(editor.id, input)
        : await createExpenseAction(input)
      if (!result.ok) {
        setError("Không lưu được. Vui lòng thử lại.")
        return
      }
      router.refresh()
      setEditor(null)
    })
  }

  function remove(id: string) {
    if (!confirm("Xóa khoản chi này khỏi sổ?")) return
    startTransition(async () => {
      const result = await deleteExpenseAction(id)
      if (!result.ok) {
        setError("Không xóa được.")
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Chi tháng này" value={formatUsd(stats.monthTotal)} />
        <Stat
          label="Recurring bình quân/tháng"
          value={formatUsd(stats.recurringMonthly)}
        />
        <Stat label="Tổng bản ghi" value={String(stats.total)} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-48">
          <Label htmlFor="exp-filter" className="text-xs text-muted-foreground">
            Lọc theo danh mục
          </Label>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as ExpenseCategory | "all")}
          >
            <SelectTrigger id="exp-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map(
                (k) => (
                  <SelectItem key={k} value={k}>
                    {EXPENSE_CATEGORY_LABELS[k].vi}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setEditor(freshDraft(defaultFxRate))}
          disabled={editor !== null || pending}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Thêm khoản chi
        </Button>
      </div>

      {editor && (
        <EditorCard
          draft={editor}
          setDraft={setEditor}
          onCancel={() => {
            setEditor(null)
            setError(null)
          }}
          onSubmit={submit}
          pending={pending}
          error={error}
        />
      )}

      {filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Repeat className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>Chưa ghi nhận khoản chi nào</EmptyTitle>
                <EmptyDescription>
                  Thêm các chi phí vận hành như lương, công cụ, marketing để theo
                  dõi điểm hòa vốn.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {row.vendor ?? row.description ?? "Khoản chi"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {EXPENSE_CATEGORY_LABELS[row.category].vi}
                      </Badge>
                      {row.is_recurring && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Repeat className="h-3 w-3" />
                          {row.recurring_frequency
                            ? FREQ_LABEL[row.recurring_frequency]
                            : ""}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(row.expense_date, "vi")}
                      {row.description && row.vendor
                        ? ` · ${row.description}`
                        : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-foreground">
                        {formatUsd(Number(row.amount_usd))}
                      </span>
                      {row.fx_rate_vnd_per_usd && (
                        <span className="text-xs text-muted-foreground">
                          ≈{" "}
                          {formatVnd(
                            Number(row.amount_usd) *
                              Number(row.fx_rate_vnd_per_usd),
                          )}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={editor !== null}
                      onClick={() =>
                        setEditor({
                          id: row.id,
                          expense_date: row.expense_date,
                          category: row.category,
                          vendor: row.vendor ?? "",
                          description: row.description ?? "",
                          amount_usd: String(row.amount_usd),
                          fx_rate_vnd_per_usd: row.fx_rate_vnd_per_usd
                            ? String(row.fx_rate_vnd_per_usd)
                            : String(defaultFxRate),
                          is_recurring: row.is_recurring,
                          recurring_frequency:
                            row.recurring_frequency ?? "monthly",
                          notes: row.notes ?? "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Sửa</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || editor !== null}
                      onClick={() => remove(row.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Xóa</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </CardContent>
    </Card>
  )
}

function EditorCard({
  draft,
  setDraft,
  onCancel,
  onSubmit,
  pending,
  error,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onCancel: () => void
  onSubmit: () => void
  pending: boolean
  error: string | null
}) {
  const amountNum = Number(draft.amount_usd)
  const fxNum = Number(draft.fx_rate_vnd_per_usd)
  const vndPreview =
    Number.isFinite(amountNum) && amountNum > 0 && fxNum > 0
      ? amountNum * fxNum
      : null

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">
          {draft.id ? "Chỉnh sửa khoản chi" : "Thêm khoản chi"}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Đóng</span>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-date">Ngày chi</Label>
            <Input
              id="exp-date"
              type="date"
              value={draft.expense_date}
              onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-cat">Danh mục</Label>
            <Select
              value={draft.category}
              onValueChange={(v) =>
                setDraft({ ...draft, category: v as ExpenseCategory })
              }
            >
              <SelectTrigger id="exp-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {EXPENSE_CATEGORY_LABELS[k].vi}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-vendor">Đơn vị thụ hưởng</Label>
            <Input
              id="exp-vendor"
              value={draft.vendor}
              onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
              placeholder="VD: Vercel, Apollo, Nguyễn Văn A"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-amount">Số tiền (USD)</Label>
            <Input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0"
              value={draft.amount_usd}
              onChange={(e) => setDraft({ ...draft, amount_usd: e.target.value })}
            />
            {vndPreview != null && (
              <span className="text-xs text-muted-foreground">
                ≈ {formatVnd(vndPreview)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-fx">Tỷ giá VND/USD</Label>
            <Input
              id="exp-fx"
              type="number"
              step="1"
              min="0"
              value={draft.fx_rate_vnd_per_usd}
              onChange={(e) =>
                setDraft({ ...draft, fx_rate_vnd_per_usd: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-desc">Mô tả ngắn</Label>
            <Input
              id="exp-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="VD: Hosting tháng 01"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="exp-recurring"
              checked={draft.is_recurring}
              onCheckedChange={(v) =>
                setDraft({ ...draft, is_recurring: v === true })
              }
            />
            <Label htmlFor="exp-recurring" className="text-sm font-normal cursor-pointer">
              Khoản chi định kỳ — sẽ được cộng vào run-rate hàng tháng
            </Label>
          </div>
          {draft.is_recurring && (
            <div className="flex flex-col gap-1.5 max-w-xs">
              <Label htmlFor="exp-freq">Tần suất</Label>
              <Select
                value={draft.recurring_frequency}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    recurring_frequency: v as Draft["recurring_frequency"],
                  })
                }
              >
                <SelectTrigger id="exp-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["monthly", "quarterly", "yearly"] as const).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQ_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="exp-notes">Ghi chú</Label>
          <Textarea
            id="exp-notes"
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/30">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Hủy
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {draft.id ? "Lưu thay đổi" : "Thêm"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
