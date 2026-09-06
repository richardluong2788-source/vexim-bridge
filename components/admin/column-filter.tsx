"use client"

/**
 * Excel-style column header filter.
 *
 * Click the funnel icon on a table header → popover with a search box +
 * "select all" + a checkbox list of the column's distinct values (with
 * counts). Multiple values can be checked at once (OR within a column);
 * multiple columns compose with AND.
 *
 * Semantics (mirrors Excel's AutoFilter):
 *   - `selected === []` means NO filter (everything shown, all checked).
 *   - Unchecking an item while "all" is active excludes just that item.
 *   - Re-checking everything collapses back to the empty (no-filter) state.
 */

import { useMemo, useState } from "react"
import { Filter } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export interface FilterOption {
  /** Canonical value to match against (use "—" for null). */
  value: string
  /** Display label (may differ from value). */
  label: string
  count: number
}

interface ColumnFilterProps {
  options: FilterOption[]
  /** Empty array = no filter (all selected). */
  selected: string[]
  onChange: (next: string[]) => void
  locale: "vi" | "en"
  align?: "start" | "center" | "end"
}

export function ColumnFilter({
  options,
  selected,
  onChange,
  locale,
  align = "start",
}: ColumnFilterProps) {
  const vi = locale === "vi"
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const noFilter = selected.length === 0
  const isChecked = (value: string) => noFilter || selected.includes(value)

  function toggle(value: string) {
    // Start from the effective "current" selection (all when unfiltered),
    // so the first uncheck excludes just that item — like Excel.
    const current = noFilter ? options.map((o) => o.value) : selected
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    // Everything checked again → collapse to the no-filter state.
    onChange(next.length === options.length ? [] : next)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={vi ? "Lọc cột này" : "Filter this column"}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors",
            !noFilter
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
          )}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-60 p-0">
        <div className="border-b border-border p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={vi ? "Tìm trong danh sách..." : "Search items..."}
            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => onChange([])}
          >
            {vi ? "Chọn tất cả" : "Select all"}
          </button>
          {!noFilter && (
            <button
              type="button"
              className="text-xs text-destructive transition-colors hover:underline"
              onClick={() => onChange([])}
            >
              {vi ? "Bỏ lọc cột này" : "Clear filter"}
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {visibleOptions.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={isChecked(o.value)}
                onCheckedChange={() => toggle(o.value)}
                aria-label={o.label}
              />
              <span className="min-w-0 flex-1 truncate text-foreground" title={o.label}>
                {o.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{o.count}</span>
            </label>
          ))}
          {visibleOptions.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {vi ? "Không có mục nào khớp" : "No matching items"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
