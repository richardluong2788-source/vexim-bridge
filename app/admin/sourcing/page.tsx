import { redirect } from "next/navigation"
import Link from "next/link"
import { Boxes, Building2, Flame, PlusCircle, Star, TrendingUp, Users } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { getDictionary } from "@/lib/i18n/server"
import { can, CAPS } from "@/lib/auth/permissions"
import { getDemandSupplyBoard, getBuyerDemandList } from "@/lib/sourcing/demand-supply"
import { BuyerDemandTable } from "@/components/admin/buyer-demand-table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * /admin/sourcing — Demand ↔ Supply board.
 *
 * The Supplier Researcher's main working view (also visible to anyone with
 * CLIENT_VIEW: admin / AE). Shows, per industry:
 *   - DEMAND  : buyer leads researched by LR (has_active_inquiry = real
 *               demand from Section 7) — AGGREGATE ONLY, no buyer PII.
 *   - SUPPLY  : suppliers (clients) covering that industry.
 *   - THE GAP : industries with active demand but zero suppliers are the
 *               SR's sourcing priority list.
 */
export default async function SourcingBoardPage() {
  const { locale } = await getDictionary()
  const vi = locale === "vi"

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.CLIENT_VIEW)) redirect("/admin")

  const board = await getDemandSupplyBoard(current.admin)
  const demandList = await getBuyerDemandList(current.admin)
  const canAddSupplier = can(current.role, CAPS.CLIENT_WRITE)

  // The SR's assigned patch (admin-managed via /admin/users -> industries).
  // Empty array = unassigned -> sees the full cross-industry board.
  let focusIndustries: string[] = []
  if (current.role === "supplier_researcher") {
    const { data: me } = await current.admin
      .from("profiles")
      .select("industries")
      .eq("id", current.userId)
      .single<{ industries: string[] | null }>()
    focusIndustries = me?.industries ?? []
  }

  const summary = [
    {
      label: vi ? "Buyer đã nghiên cứu" : "Buyers researched",
      value: board.totalBuyers,
      icon: Users,
      className: "text-foreground",
    },
    {
      label: vi ? "Nhu cầu thực (đang hỏi hàng)" : "Active inquiries",
      value: board.totalActiveInquiries,
      icon: Flame,
      className: "text-orange-600 dark:text-orange-400",
    },
    {
      label: vi ? "Supplier trong hệ thống" : "Suppliers in pool",
      value: board.totalSuppliers,
      icon: Building2,
      className: "text-foreground",
    },
    {
      label: vi ? "Ngành cần tìm supplier gấp" : "Industries needing supply",
      value: board.urgentIndustries,
      icon: TrendingUp,
      className:
        board.urgentIndustries > 0
          ? "text-destructive"
          : "text-emerald-600 dark:text-emerald-400",
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Boxes className="h-6 w-6 text-primary" />
            {vi ? "Nhu cầu & Nguồn cung" : "Demand & Supply"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {vi
              ? "So sánh nhu cầu buyer (do Lead Researcher đổ vào) với nguồn cung supplier trong hệ thống — ưu tiên tìm supplier cho các ngành có nhu cầu thực mà chưa có ai phục vụ."
              : "Compare buyer demand (sourced by Lead Researcher) against the supplier pool — prioritise sourcing for industries with real demand and no supplier yet."}
          </p>
        </div>
        {canAddSupplier && (
          <Button asChild>
            <Link href="/admin/clients/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              {vi ? "Thêm supplier" : "Add supplier"}
            </Link>
          </Button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={cn("h-5 w-5 shrink-0", s.className)} />
              <div className="min-w-0">
                <p className={cn("text-2xl font-semibold leading-none", s.className)}>
                  {s.value}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {s.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Buyer demand list — the SR's live work queue */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {vi ? "Buyer đang cần gì" : "What buyers need"}
          </h2>
          <Link
            href="/admin/buyers"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {vi ? "Xem tất cả buyer →" : "View all buyers →"}
          </Link>
        </div>
        <div className="p-3">
          <BuyerDemandTable rows={demandList} locale={locale} focusIndustries={focusIndustries} />
        </div>
      </div>

      {/* Demand vs supply table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">
                {vi ? "Ngành hàng" : "Industry"}
              </th>
              <th className="px-4 py-3 font-medium">
                {vi ? "Buyer" : "Buyers"}
              </th>
              <th className="px-4 py-3 font-medium">
                {vi ? "Nhu cầu thực" : "Active inquiries"}
              </th>
              <th className="px-4 py-3 font-medium">
                {vi ? "Supplier" : "Suppliers"}
              </th>
              <th className="px-4 py-3 font-medium">
                {vi ? "Sản phẩm buyer đang hỏi" : "Products buyers ask for"}
              </th>
              <th className="px-4 py-3 font-medium">
                {vi ? "Đánh giá" : "Status"}
              </th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => {
              const urgent = row.activeInquiries > 0 && row.suppliers === 0
              const missing = !urgent && row.buyers > 0 && row.suppliers === 0
              const hasBoth = row.activeInquiries > 0 && row.suppliers > 0
              return (
                <tr
                  key={row.industry}
                  className={cn(
                    "border-t border-border",
                    urgent && "bg-destructive/5",
                    !urgent && focusIndustries.includes(row.industry) && "bg-primary/[0.06]",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {focusIndustries.includes(row.industry) && (
                        <Star
                          className="h-3 w-3 fill-primary text-primary"
                          aria-label={vi ? "Ngành bạn phụ trách" : "Your industry"}
                        />
                      )}
                      {row.industry}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.buyers}</td>
                  <td className="px-4 py-3">
                    {row.activeInquiries > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400">
                        <Flame className="h-3.5 w-3.5" />
                        {row.activeInquiries}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.suppliers}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    {row.requestedProducts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.requestedProducts.map((p) => (
                          <Badge
                            key={p}
                            variant="secondary"
                            className="max-w-56 truncate font-normal"
                            title={p}
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {urgent ? (
                      <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
                        {vi ? "Cần tìm supplier gấp" : "Urgent — no supplier"}
                      </Badge>
                    ) : missing ? (
                      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
                        {vi ? "Chưa có supplier" : "No supplier yet"}
                      </Badge>
                    ) : hasBoth ? (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        {vi ? "Có thể match" : "Ready to match"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {vi ? "Không có nhu cầu" : "No demand"}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {vi
          ? "Buyer có nhu cầu thực (🔥) xếp trên cùng. Thông tin liên hệ của buyer luôn ẩn (che mask) — SR thấy buyer CẦN gì, liên hệ buyer là việc của AE. Nguồn: leads (demand) + profiles role=client (supply)."
          : "Buyers with a real inquiry (🔥) sort first. Buyer contact details stay masked — SR sees WHAT buyers need; reaching out is the AE's job. Sources: leads (demand) + client profiles (supply)."}
      </p>
    </div>
  )
}
