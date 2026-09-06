"use client"

/**
 * Multi-industry picker for Account Executives.
 *
 * Why a separate component (vs. the old single <Select>):
 *   1. The AI matching hard-filter gates AEs on the FULL `profiles.industries`
 *      array (migration 018), so an AE can cover several industries at once.
 *   2. The old single-column update (profiles.industry) was silently
 *      reverted by the profiles_sync_primary_industry trigger — see
 *      app/admin/users/actions.ts → updateUserIndustries for the fix.
 *
 * Labels intentionally show the SHORT CANONICAL ENGLISH value only
 * (e.g. "Seafood", "Food & Beverage") — the bilingual
 * "EN · Tiếng Việt (giải thích dài)" format made the table row unreadable.
 */

import { useState } from "react"
import { ChevronsUpDown, Star, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"

interface AeIndustryPickerProps {
  /** Ordered list — value[0] is the PRIMARY industry used by AI matching. */
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  locale?: "vi" | "en"
  id?: string
}

export function AeIndustryPicker({
  value,
  onChange,
  disabled,
  locale = "vi",
  id,
}: AeIndustryPickerProps) {
  const [open, setOpen] = useState(false)
  const vi = locale === "vi"

  function toggle(ind: Industry) {
    onChange(
      value.includes(ind) ? value.filter((v) => v !== ind) : [...value, ind],
    )
  }

  function promote(ind: string) {
    onChange([ind, ...value.filter((v) => v !== ind)])
  }

  const summary =
    value.length === 0
      ? vi
        ? "Chưa đặt"
        : "Not set"
      : value.length === 1
        ? value[0]
        : `${value[0]} +${value.length - 1}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          id={id}
          disabled={disabled}
          className="h-8 w-full justify-between font-normal"
        >
          <span className="truncate">{summary}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-1">
          {INDUSTRIES.map((ind) => {
            const checked = value.includes(ind)
            return (
              <label
                key={ind}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(ind)}
                  disabled={disabled}
                  aria-label={ind}
                />
                <span className="flex-1 truncate text-foreground">{ind}</span>
                {checked && value[0] === ind && (
                  <Star className="h-3 w-3 fill-primary text-primary" aria-label="primary" />
                )}
              </label>
            )
          })}
        </div>

        {value.length > 1 && (
          <div className="border-t border-border p-2">
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              {vi
                ? "★ Ngành đầu tiên là ngành chính (dùng cho AI matching)"
                : "★ First item is the primary industry (AI matching)"}
            </p>
            <div className="flex flex-wrap gap-1">
              {value.map((ind, i) => (
                <span
                  key={ind}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                    i === 0
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground",
                  )}
                >
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => promote(ind)}
                      className="text-muted-foreground transition-colors hover:text-primary"
                      aria-label={vi ? `Đặt ${ind} làm ngành chính` : `Set ${ind} as primary`}
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  <span className="max-w-28 truncate">{ind}</span>
                  <button
                    type="button"
                    onClick={() => toggle(ind as Industry)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={vi ? `Bỏ ${ind}` : `Remove ${ind}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
