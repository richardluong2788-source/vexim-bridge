"use client"

/**
 * "Buyer đang cần gì" table for /admin/sourcing — the Supplier Researcher's
 * live work queue, with Excel-style column filters (multi-select via
 * ColumnFilter) and a free-text search across buyer / products / HS code.
 *
 * Server data comes in pre-sorted (real inquiries first). All filtering is
 * client-side — the list is capped server-side and small enough.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Flame, Search, X } from "lucide-react"
import { ColumnFilter, type FilterOption } from "@/components/admin/column-filter"
import type { BuyerDemandItem } from "@/lib/sourcing/demand-supply"

interface Props {
  rows: BuyerDemandItem[]
  locale: "vi" | "en"
  /**
   * The current SR's assigned industries (admin-managed on /admin/users).
   * When non-empty the table STARTS filtered to these — each SR sees their
   * own patch instead of the whole cross-industry demand list — with a
   * one-click toggle to view every industry.
   */
  focusIndustries?: string[]
}

interface Filters {
  country: string[]
  industry: string[]
  hs: string[]
  inquiry: string[]
}

const NONE = "—"

export function BuyerDemandTable({ rows, locale, focusIndustries = [] }: Props) {
  const vi = locale === "vi"
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<Filters>({
    country: [],
    // Default to the SR's patch so equipment and food demand never mix in
    // one queue; cleared with the "view all industries" toggle below.
    industry: focusIndustries.length > 0 ? [...focusIndustries] : [],
    hs: [],
    inquiry: [],
  })

  // Is the focus filter currently active (i.e. the industry filter is
  // exactly the SR's assigned set)?
  const focusActive =
    focusIndustries.length > 0 &&
    filters.industry.length === focusIndustries.length &&
    focusIndustries.every((v) => filters.industry.includes(v))

  // Distinct values per filterable column, with counts (from ALL rows so the
  // option list stays stable while other filters narrow the table).
  const options = useMemo(() => {
    const build = (get: (r: BuyerDemandItem) => string | null): FilterOption[] => {
      const map = new Map<string, number>()
      for (const r of rows) {
        const v = (get(r) ?? "").trim() || NONE
        map.set(v, (map.get(v) ?? 0) + 1)
      }
      return Array.from(map.entries())
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    }
    return {
      country: build((r) => r.country),
      industry: build((r) => r.industry),
      hs: build((r) => r.hsCode),
      inquiry: [
        {
          value: "active",
          label: vi ? "🔥 Nhu cầu thực" : "🔥 Active inquiry",
          count: rows.filter((r) => r.hasActiveInquiry).length,
        },
        {
          value: "none",
          label: vi ? "Chưa có nhu cầu thực" : "No active inquiry",
          count: rows.filter((r) => !r.hasActiveInquiry).length,
        },
      ].filter((o) => o.count > 0),
    }
  }, [rows, vi])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filters.country.length && !filters.country.includes(r.country?.trim() || NONE)) {
        return false
      }
      if (filters.industry.length && !filters.industry.includes(r.industry?.trim() || NONE)) {
        return false
      }
      if (filters.hs.length && !filters.hs.includes(r.hsCode?.trim() || NONE)) {
        return false
      }
      if (
        filters.inquiry.length &&
        !filters.inquiry.includes(r.hasActiveInquiry ? "active" : "none")
      ) {
        return false
      }
      if (q) {
        const hay = [r.companyName, r.products, r.mainProduct, r.hsCode]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filters, search])

  const hasAnyFilter =
    search.trim() !== "" ||
    filters.country.length > 0 ||
    filters.industry.length > 0 ||
    filters.hs.length > 0 ||
    filters.inquiry.length > 0

  const setFilter = (key: keyof Filters) => (next: string[]) =>
    setFilters((f) => ({ ...f, [key]: next }))

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(vi ? "vi-VN" : "en-US", {
          day: "numeric",
          month: "short",
        })
      : "—"

  return (
    <div className="flex flex-col gap-3">
      {/* Focus banner — SR assigned industries */}
      {focusIndustries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
          <span className="font-medium text-primary">
            {focusActive
              ? vi
                ? `Đang xem ${focusIndustries.length} ngành bạn phụ trách`
                : `Showing your ${focusIndustries.length} assigned industries`
              : vi
                ? "Đang xem tất cả ngành hàng"
                : "Showing all industries"}
          </span>
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                industry: focusActive ? [] : [...focusIndustries],
              }))
            }
            className="rounded-full bg-background px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
          >
            {focusActive
              ? vi
                ? "Xem tất cả ngành"
                : "View all industries"
              : vi
                ? "Chỉ ngành tôi phụ trách"
                : "Only my industries"}
          </button>
        </div>
      )}

      {/* Search + result count */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vi ? "Tìm buyer, sản phẩm, mã HS..." : "Search buyer, product, HS code..."}
            className="h-9 w-72 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {vi
            ? `Hiển thị ${filtered.length}/${rows.length} buyer`
            : `Showing ${filtered.length}/${rows.length} buyers`}
        </span>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => {
              setSearch("")
              setFilters({
                country: [],
                industry: focusIndustries.length > 0 ? [...focusIndustries] : [],
                hs: [],
                inquiry: [],
              })
            }}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/70"
          >
            <X className="h-3 w-3" />
            {vi ? "Xóa bộ lọc" : "Clear filters"}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {vi ? "Buyer" : "Buyer"}
                    <ColumnFilter
                      options={options.inquiry}
                      selected={filters.inquiry}
                      onChange={setFilter("inquiry")}
                      locale={locale}
                    />
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {vi ? "Quốc gia" : "Country"}
                    <ColumnFilter
                      options={options.country}
                      selected={filters.country}
                      onChange={setFilter("country")}
                      locale={locale}
                    />
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {vi ? "Ngành" : "Industry"}
                    <ColumnFilter
                      options={options.industry}
                      selected={filters.industry}
                      onChange={setFilter("industry")}
                      locale={locale}
                    />
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {vi ? "Mã HS" : "HS code"}
                    <ColumnFilter
                      options={options.hs}
                      selected={filters.hs}
                      onChange={setFilter("hs")}
                      locale={locale}
                    />
                  </span>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {vi ? "Sản phẩm đang hỏi" : "Products"}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {vi ? "SL / Giá mục tiêu" : "Qty / Target price"}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {vi ? "Nhận nhu cầu" : "Received"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                  <td className="max-w-44 px-4 py-2.5">
                    <Link
                      href={`/admin/buyers/${b.id}`}
                      className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {b.hasActiveInquiry && (
                        <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                      )}
                      <span className="truncate">{b.companyName}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {b.country ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {b.industry ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {b.hsCode ? (
                      <span
                        className="inline-block max-w-24 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground"
                        title={
                          b.secondaryHsCodes
                            ? `${vi ? "Mã HS phụ" : "Secondary HS"}: ${b.secondaryHsCodes}`
                            : b.hsCode
                        }
                      >
                        {b.hsCode}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-64 px-4 py-2.5">
                    {b.products || b.mainProduct ? (
                      <span
                        className="line-clamp-2 text-foreground"
                        title={b.products ?? b.mainProduct ?? undefined}
                      >
                        {b.products ?? b.mainProduct}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {[b.quantity, b.targetPrice].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {fmtDate(b.receivedAt ?? b.createdAt)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && rows.length > 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {vi
                      ? "Không có buyer nào khớp bộ lọc — thử xóa bớt điều kiện."
                      : "No buyers match the filters — try clearing some."}
                  </td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {vi
                      ? "Chưa có buyer nào trong hệ thống — Lead Researcher chưa nhập buyer."
                      : "No buyers in the system yet — the Lead Researcher has not imported any."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
