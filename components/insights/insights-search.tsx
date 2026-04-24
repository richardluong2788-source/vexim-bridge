"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

/**
 * Debounced search input wired to the `q` query param. Keeps the URL as
 * the source of truth so deep-linking / sharing search results works.
 */
export function InsightsSearch({
  placeholder = "Tìm bài viết...",
  activeCategory,
}: {
  placeholder?: string
  activeCategory?: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const initial = sp.get("q") ?? ""
  const [value, setValue] = useState(initial)
  const [, startTransition] = useTransition()

  // Keep local state in sync if the URL changes externally (e.g. pagination).
  useEffect(() => {
    setValue(sp.get("q") ?? "")
  }, [sp])

  useEffect(() => {
    const trimmed = value.trim()
    const current = sp.get("q") ?? ""
    if (trimmed === current) return

    const handle = setTimeout(() => {
      const params = new URLSearchParams()
      if (activeCategory) params.set("category", activeCategory)
      if (trimmed) params.set("q", trimmed)
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `/insights?${qs}` : "/insights", { scroll: false })
      })
    }, 300)

    return () => clearTimeout(handle)
    // We purposely avoid depending on `sp` here — the effect above owns sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, activeCategory, router])

  return (
    <InputGroup className="max-w-lg">
      <InputGroupAddon>
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setValue("")}
            aria-label="Xoá từ khoá"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
