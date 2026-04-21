"use client"

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { upsertCountryRisk, deleteCountryRisk } from "@/app/admin/country-risk/actions"

export type CountryRiskRow = {
  country_code: string
  country_name: string
  risk_level: "low" | "medium" | "high"
  requires_verified_swift: boolean
  notes: string | null
  updated_at: string | null
}

type DraftRow = {
  country_code: string
  country_name: string
  risk_level: "low" | "medium" | "high"
  requires_verified_swift: boolean
  notes: string
}

const EMPTY_DRAFT: DraftRow = {
  country_code: "",
  country_name: "",
  risk_level: "medium",
  requires_verified_swift: true,
  notes: "",
}

const LEVEL_VARIANT: Record<CountryRiskRow["risk_level"], "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "secondary",
  low: "default",
}

const LEVEL_LABEL_VI: Record<CountryRiskRow["risk_level"], string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
}

export function CountryRiskManager({ initialRows }: { initialRows: CountryRiskRow[] }) {
  const [rows, setRows] = useState<CountryRiskRow[]>(initialRows)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null) // country_code being edited, or "__new__"
  const [draft, setDraft] = useState<DraftRow>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== "all" && r.risk_level !== filter) return false
      if (!q) return true
      return (
        r.country_code.toLowerCase().includes(q) ||
        r.country_name.toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q)
      )
    })
  }, [rows, filter, search])

  const stats = useMemo(
    () => ({
      total: rows.length,
      high: rows.filter((r) => r.risk_level === "high").length,
      medium: rows.filter((r) => r.risk_level === "medium").length,
      low: rows.filter((r) => r.risk_level === "low").length,
    }),
    [rows],
  )

  function beginEdit(row: CountryRiskRow) {
    setError(null)
    setEditing(row.country_code)
    setDraft({
      country_code: row.country_code,
      country_name: row.country_name,
      risk_level: row.risk_level,
      requires_verified_swift: row.requires_verified_swift,
      notes: row.notes ?? "",
    })
  }

  function beginNew() {
    setError(null)
    setEditing("__new__")
    setDraft(EMPTY_DRAFT)
  }

  function cancelEdit() {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  function handleSubmit() {
    setError(null)
    const code = draft.country_code.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(code)) {
      setError("Mã quốc gia phải là 2 chữ cái theo chuẩn ISO 3166-1 alpha-2 (ví dụ: US, PK, NG).")
      return
    }
    if (!draft.country_name.trim()) {
      setError("Tên quốc gia không được để trống.")
      return
    }

    startTransition(async () => {
      const result = await upsertCountryRisk({
        country_code: code,
        country_name: draft.country_name.trim(),
        risk_level: draft.risk_level,
        requires_verified_swift: draft.requires_verified_swift,
        notes: draft.notes.trim() || null,
      })

      if (!result.ok) {
        setError(
          result.error === "unauthorized"
            ? "Bạn không có quyền chỉnh sửa danh mục này."
            : result.error === "invalid"
              ? "Dữ liệu nhập không hợp lệ."
              : "Không lưu được. Vui lòng thử lại.",
        )
        return
      }

      setRows((prev) => {
        const without = prev.filter((r) => r.country_code !== code)
        return [
          ...without,
          {
            country_code: code,
            country_name: draft.country_name.trim(),
            risk_level: draft.risk_level,
            requires_verified_swift: draft.requires_verified_swift,
            notes: draft.notes.trim() || null,
            updated_at: new Date().toISOString(),
          },
        ].sort((a, b) => {
          const order: Record<CountryRiskRow["risk_level"], number> = {
            high: 0,
            medium: 1,
            low: 2,
          }
          if (order[a.risk_level] !== order[b.risk_level]) {
            return order[a.risk_level] - order[b.risk_level]
          }
          return a.country_code.localeCompare(b.country_code)
        })
      })
      cancelEdit()
    })
  }

  function handleDelete(code: string) {
    if (
      !confirm(
        `Xóa quốc gia ${code} khỏi danh mục rủi ro? Thao tác này sẽ khiến cơ hội ` +
          `gán vào quốc gia này quay về mức mặc định "trung bình".`,
      )
    )
      return

    startTransition(async () => {
      const result = await deleteCountryRisk(code)
      if (!result.ok) {
        setError("Không xóa được. Vui lòng thử lại.")
        return
      }
      setRows((prev) => prev.filter((r) => r.country_code !== code))
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tổng số" value={stats.total} />
        <StatCard label="Rủi ro cao" value={stats.high} tone="destructive" />
        <StatCard label="Trung bình" value={stats.medium} tone="secondary" />
        <StatCard label="Thấp" value={stats.low} tone="chart-4" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 min-w-56">
            <Label htmlFor="risk-search" className="text-xs text-muted-foreground">
              Tìm kiếm
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="risk-search"
                placeholder="Mã, tên quốc gia, ghi chú…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-36">
            <Label htmlFor="risk-filter" className="text-xs text-muted-foreground">
              Mức rủi ro
            </Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger id="risk-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="high">Cao</SelectItem>
                <SelectItem value="medium">Trung bình</SelectItem>
                <SelectItem value="low">Thấp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={beginNew} disabled={editing !== null} className="gap-2">
          <Plus className="h-4 w-4" />
          Thêm quốc gia
        </Button>
      </div>

      {/* New-row card, rendered above the table */}
      {editing === "__new__" && (
        <EditorCard
          title="Thêm quốc gia mới"
          draft={draft}
          setDraft={setDraft}
          onCancel={cancelEdit}
          onSubmit={handleSubmit}
          pending={pending}
          error={error}
          isNew
        />
      )}

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Danh sách quốc gia</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filteredRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Không tìm thấy quốc gia nào khớp điều kiện.
              </div>
            ) : (
              filteredRows.map((row) =>
                editing === row.country_code ? (
                  <div key={row.country_code} className="p-4">
                    <EditorCard
                      title={`Chỉnh sửa ${row.country_code} · ${row.country_name}`}
                      draft={draft}
                      setDraft={setDraft}
                      onCancel={cancelEdit}
                      onSubmit={handleSubmit}
                      pending={pending}
                      error={error}
                      lockCode
                    />
                  </div>
                ) : (
                  <div
                    key={row.country_code}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold shrink-0">
                        {row.country_code}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {row.country_name}
                        </span>
                        {row.notes && (
                          <span className="text-xs text-muted-foreground text-pretty">
                            {row.notes}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={LEVEL_VARIANT[row.risk_level]} className="text-xs">
                            {LEVEL_LABEL_VI[row.risk_level]}
                          </Badge>
                          {row.requires_verified_swift && (
                            <Badge variant="outline" className="text-xs font-normal gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Bắt buộc Swift
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => beginEdit(row)}
                        disabled={editing !== null}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Chỉnh sửa</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(row.country_code)}
                        disabled={pending || editing !== null}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Xóa</span>
                      </Button>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "destructive" | "secondary" | "chart-4"
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "secondary"
        ? "text-chart-5"
        : tone === "chart-4"
          ? "text-chart-4"
          : "text-foreground"
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-2xl font-semibold ${toneClass}`}>{value}</span>
      </CardContent>
    </Card>
  )
}

function EditorCard({
  title,
  draft,
  setDraft,
  onCancel,
  onSubmit,
  pending,
  error,
  isNew,
  lockCode,
}: {
  title: string
  draft: DraftRow
  setDraft: (d: DraftRow) => void
  onCancel: () => void
  onSubmit: () => void
  pending: boolean
  error: string | null
  isNew?: boolean
  lockCode?: boolean
}) {
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          <X className="h-4 w-4" />
          <span className="sr-only">Đóng</span>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cr-code">
              Mã ISO <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cr-code"
              placeholder="US"
              value={draft.country_code}
              onChange={(e) =>
                setDraft({ ...draft, country_code: e.target.value.toUpperCase() })
              }
              maxLength={2}
              disabled={lockCode}
              className="font-mono uppercase"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="cr-name">
              Tên quốc gia <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cr-name"
              placeholder="United States"
              value={draft.country_name}
              onChange={(e) => setDraft({ ...draft, country_name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cr-level">Mức rủi ro</Label>
            <Select
              value={draft.risk_level}
              onValueChange={(v) =>
                setDraft({ ...draft, risk_level: v as DraftRow["risk_level"] })
              }
            >
              <SelectTrigger id="cr-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Cao</SelectItem>
                <SelectItem value="medium">Trung bình</SelectItem>
                <SelectItem value="low">Thấp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 md:col-span-2 pt-6">
            <Checkbox
              id="cr-swift"
              checked={draft.requires_verified_swift}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, requires_verified_swift: checked === true })
              }
            />
            <Label
              htmlFor="cr-swift"
              className="text-sm font-normal cursor-pointer text-pretty"
            >
              Bắt buộc xác minh Swift trước khi chuyển sang sản xuất / giao hàng
            </Label>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-notes">Ghi chú</Label>
          <Input
            id="cr-notes"
            placeholder="Ví dụ: FATF grey list, lệnh cấm vận, biến động tỷ giá…"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            maxLength={500}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/30">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Hủy
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isNew ? "Thêm" : "Lưu thay đổi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
