"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Search,
  Globe2,
  Building2,
  ExternalLink,
  Filter,
  Sparkles,
  UserCircle2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { assessCountryRisk, type RiskLevel } from "@/lib/risk/country-risk"
import { maskEmail, maskPhone } from "@/lib/buyers/mask"
import { RunAIMatchButton } from "@/components/admin/run-ai-match-button"
import { DeleteBuyerButton } from "@/components/admin/delete-buyer-button"
import type { Stage } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Shared row shape — page.tsx builds these on the server.
// ---------------------------------------------------------------------------
export interface BuyerRow {
  id: string
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  country: string | null
  industry: string | null
  website: string | null
  linkedin_url: string | null
  created_at: string
  totalOpportunities: number
  openOpportunities: number
  wonOpportunities: number
  latestStage: Stage | null
  latestClient: { id: string; name: string } | null
  latestUpdated: string | null
  assignedAE: { id: string; name: string } | null
}

interface Props {
  rows: BuyerRow[]
  locale: "vi" | "en"
  canViewPII: boolean
  canRunMatch?: boolean
  isLeadResearcher?: boolean
  canWriteBuyer?: boolean
}

// Compact labels for the "latest stage" badge. Matches the kanban
// terminology used in lib/i18n/dictionaries — duplicated here so the
// table can render without pulling the whole dictionary client-side.
const STAGE_LABEL_VI: Record<Stage, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  sample_requested: "Yêu cầu mẫu",
  sample_sent: "Đã gửi mẫu",
  negotiation: "Đàm phán",
  price_agreed: "Đã chốt giá",
  production: "Sản xuất",
  shipped: "Đã giao",
  won: "Thành công",
  lost: "Thất bại",
}
const STAGE_LABEL_EN: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  sample_requested: "Sample requested",
  sample_sent: "Sample sent",
  negotiation: "Negotiation",
  price_agreed: "Price agreed",
  production: "Production",
  shipped: "Shipped",
  won: "Won",
  lost: "Lost",
}

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  medium: "border-chart-5/40 bg-chart-5/10 text-chart-5",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
}

const PAGE_SIZE = 20

export function BuyersTable({ rows, locale, canViewPII, canRunMatch = false, isLeadResearcher = false, canWriteBuyer = false }: Props) {
  const [search, setSearch] = useState("")
  const [countryFilter, setCountryFilter] = useState<string>("all")
  const [industryFilter, setIndustryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "has_open" | "has_any" | "never_assigned"
  >("all")
  const [page, setPage] = useState(1)

  // Build distinct filter buckets from the data so we don't hardcode them.
  const { countries, industries } = useMemo(() => {
    const c = new Set<string>()
    const i = new Set<string>()
    for (const r of rows) {
      if (r.country) c.add(r.country)
      if (r.industry) i.add(r.industry)
    }
    return {
      countries: Array.from(c).sort(),
      industries: Array.from(i).sort(),
    }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (countryFilter !== "all" && r.country !== countryFilter) return false
      if (industryFilter !== "all" && r.industry !== industryFilter) return false
      if (statusFilter === "has_open" && r.openOpportunities === 0) return false
      if (statusFilter === "has_any" && r.totalOpportunities === 0) return false
      if (statusFilter === "never_assigned" && r.totalOpportunities > 0) return false
      if (!q) return true
      return (
        r.company_name?.toLowerCase().includes(q) ||
        r.contact_person?.toLowerCase().includes(q) ||
        r.contact_email?.toLowerCase().includes(q) ||
        r.country?.toLowerCase().includes(q) ||
        r.industry?.toLowerCase().includes(q) ||
        false
      )
    })
  }, [rows, search, countryFilter, industryFilter, statusFilter])

  // Any change to search/filters can shrink the result set below the
  // current page — snap back to page 1 so the user never lands on a
  // page number that no longer has any rows.
  useEffect(() => {
    setPage(1)
  }, [search, countryFilter, industryFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  if (rows.length === 0) {
    return (
      <Card className="border-border">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {locale === "vi" ? "Chưa có buyer nào" : "No buyers yet"}
            </EmptyTitle>
            <EmptyDescription>
              {isLeadResearcher
                ? locale === "vi"
                  ? "Dùng 'Thêm Buyer' hoặc 'Import hàng loạt' để nhập buyer vào pool."
                  : "Use 'Add buyer' or 'Bulk import' to add buyers to the pool."
                : locale === "vi"
                  ? "Không có buyer nào được gán cho bạn. Hệ thống sẽ tự động gợi ý buyer phù hợp cho bạn."
                  : "No buyer has been assigned to you. The system will automatically suggest a suitable buyer for you."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  const L = locale === "vi" ? STAGE_LABEL_VI : STAGE_LABEL_EN
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="border-border p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                locale === "vi"
                  ? "Tìm theo công ty, người liên hệ, email, quốc gia..."
                  : "Search by company, contact, email, country..."
              }
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue
                  placeholder={locale === "vi" ? "Quốc gia" : "Country"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "vi" ? "Tất cả quốc gia" : "All countries"}
                </SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue
                  placeholder={locale === "vi" ? "Ngành" : "Industry"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "vi" ? "Tất cả ngành" : "All industries"}
                </SelectItem>
                {industries.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as typeof statusFilter)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {locale === "vi" ? "Mọi trạng thái" : "Any status"}
                </SelectItem>
                <SelectItem value="has_open">
                  {locale === "vi" ? "Có cơ hội đang mở" : "Has open deal"}
                </SelectItem>
                <SelectItem value="has_any">
                  {locale === "vi" ? "Đã từng gán" : "Ever assigned"}
                </SelectItem>
                <SelectItem value="never_assigned">
                  {locale === "vi" ? "Chưa gán lần nào" : "Never assigned"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length === 0
            ? locale === "vi"
              ? `Đang hiển thị 0 / ${rows.length.toLocaleString("vi-VN")} buyer`
              : `Showing 0 of ${rows.length.toLocaleString("en-US")} buyers`
            : locale === "vi"
              ? `Đang hiển thị ${((safePage - 1) * PAGE_SIZE + 1).toLocaleString("vi-VN")}–${Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString("vi-VN")} / ${filtered.length.toLocaleString("vi-VN")} buyer (tổng ${rows.length.toLocaleString("vi-VN")})`
              : `Showing ${((safePage - 1) * PAGE_SIZE + 1).toLocaleString("en-US")}–${Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString("en-US")} of ${filtered.length.toLocaleString("en-US")} buyers (${rows.length.toLocaleString("en-US")} total)`}
        </p>
      </Card>

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-medium">
                {locale === "vi" ? "Công ty" : "Company"}
              </TableHead>
              <TableHead className="font-medium">
                {locale === "vi" ? "Quốc gia" : "Country"}
              </TableHead>
              <TableHead className="font-medium">
                {locale === "vi" ? "Ngành" : "Industry"}
              </TableHead>
              <TableHead className="font-medium">
                {locale === "vi" ? "Liên hệ" : "Contact"}
              </TableHead>
              <TableHead className="font-medium text-center">
                {locale === "vi" ? "Cơ hội" : "Deals"}
              </TableHead>
              <TableHead className="font-medium">
                {locale === "vi" ? "AE quản lý" : "Assigned AE"}
              </TableHead>
              <TableHead className="font-medium">
                {locale === "vi" ? "Mới nhất" : "Latest"}
              </TableHead>
              {canRunMatch && (
                <TableHead className="font-medium text-center">
                  <span className="flex items-center justify-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {locale === "vi" ? "AI Match" : "AI Match"}
                  </span>
                </TableHead>
              )}
              <TableHead className="font-medium text-center w-12">
                {locale === "vi" ? "Thao tác" : "Actions"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {locale === "vi"
                    ? "Không có buyer nào phù hợp bộ lọc."
                    : "No buyers match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => {
                const risk = assessCountryRisk(r.country)
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30 align-top">
                    <TableCell>
                      <Link
                        href={`/admin/buyers/${r.id}`}
                        className="flex items-start gap-2 group"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors inline-flex items-center gap-1">
                            {r.company_name ?? "—"}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          {r.contact_person ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                              {r.contact_person}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.country ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm inline-flex items-center gap-1.5">
                            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {r.country}
                          </span>
                          <Badge
                            variant="outline"
                            className={`w-fit text-[10px] uppercase tracking-wide ${RISK_STYLE[risk.level]}`}
                          >
                            {risk.level === "low"
                              ? locale === "vi"
                                ? "Rủi ro thấp"
                                : "Low risk"
                              : risk.level === "medium"
                                ? locale === "vi"
                                  ? "Trung bình"
                                  : "Medium"
                                : locale === "vi"
                                  ? "Cao"
                                  : "High"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.industry ? (
                        <Badge variant="secondary" className="font-normal">
                          {r.industry}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-0.5 max-w-[220px]">
                        <span className="truncate text-foreground">
                          {canViewPII
                            ? (r.contact_email ?? "—")
                            : maskEmail(r.contact_email)}
                        </span>
                        {r.contact_phone ? (
                          <span className="text-xs text-muted-foreground">
                            {canViewPII ? r.contact_phone : maskPhone(r.contact_phone)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          {r.totalOpportunities}
                        </span>
                        {r.openOpportunities > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-chart-1/40 bg-chart-1/10 text-chart-1"
                          >
                            {r.openOpportunities}{" "}
                            {locale === "vi" ? "đang mở" : "open"}
                          </Badge>
                        ) : r.wonOpportunities > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-chart-4/40 bg-chart-4/10 text-chart-4"
                          >
                            {r.wonOpportunities}{" "}
                            {locale === "vi" ? "thắng" : "won"}
                          </Badge>
                        ) : r.totalOpportunities === 0 ? (
                          <span className="text-[10px] text-muted-foreground">
                            {locale === "vi" ? "chưa gán" : "none"}
                          </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.assignedAE ? (
                          <div className="flex items-center gap-2">
                            <UserCircle2 className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{r.assignedAE.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {locale === "vi" ? "Chưa gán AE" : "No AE assigned"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                      {r.latestStage && r.latestClient ? (
                        <div className="flex flex-col gap-1 max-w-[220px]">
                          <Badge variant="secondary" className="w-fit font-normal">
                            {L[r.latestStage]}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            {r.latestClient.name}
                          </span>
                          {r.latestUpdated ? (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(r.latestUpdated).toLocaleDateString(
                                dateLocale,
                                { month: "short", day: "numeric", year: "numeric" },
                              )}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {locale === "vi" ? "Chưa gán cho client" : "Not assigned"}
                        </span>
                      )}
                    </TableCell>
                    {canRunMatch && (
                      <TableCell className="text-center">
                        <RunAIMatchButton
                          buyerId={r.id}
                          buyerName={r.company_name || "Unknown"}
                          locale={locale}
                          variant="ghost"
                          size="sm"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">
                              {locale === "vi" ? "Mở menu" : "Open menu"}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/buyers/${r.id}`}>
                              {locale === "vi" ? "Chỉnh sửa" : "Edit"}
                            </Link>
                          </DropdownMenuItem>
                          {canWriteBuyer && (
                            <DropdownMenuItem asChild>
                              <DeleteBuyerButton
                                buyerId={r.id}
                                buyerName={r.company_name}
                                locale={locale}
                                variant="ghost"
                                size="sm"
                              />
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {locale === "vi"
              ? `Trang ${safePage} / ${totalPages}`
              : `Page ${safePage} of ${totalPages}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              {locale === "vi" ? "Trước" : "Previous"}
            </Button>
            <div className="flex items-center gap-1 px-1">
              {getPageNumbers(safePage, totalPages).map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1.5 text-xs text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === safePage ? "outline" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ),
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {locale === "vi" ? "Sau" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Builds a compact page-number list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 25,
// so the pager stays usable even with hundreds of buyers.
function getPageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  const pages: Array<number | "ellipsis"> = []
  const delta = 1
  const range = new Set<number>()
  range.add(1)
  range.add(total)
  for (let p = current - delta; p <= current + delta; p++) {
    if (p > 1 && p < total) range.add(p)
  }
  const sorted = Array.from(range).sort((a, b) => a - b)
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) pages.push("ellipsis")
    pages.push(p)
    prev = p
  }
  return pages
}
