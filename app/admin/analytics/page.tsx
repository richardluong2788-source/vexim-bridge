import { redirect } from "next/navigation"
import { BarChart3, Info } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { parsePeriod, resolvePeriod } from "@/lib/analytics/constants"
import type { ClientScope } from "@/lib/analytics/queries"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PeriodSelector } from "@/components/admin/analytics/period-selector"
import { AnalyticsTabsNav, parseTab } from "@/components/admin/analytics/tabs-nav"
import { OverviewTab } from "@/components/admin/analytics/overview-tab"
import { ByClientTab } from "@/components/admin/analytics/by-client-tab"
import { BottleneckTab } from "@/components/admin/analytics/bottleneck-tab"
import { LostTab } from "@/components/admin/analytics/lost-tab"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ tab?: string; period?: string }>
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const tab = parseTab(sp.tab)
  const periodValue = parsePeriod(sp.period)
  const period = resolvePeriod(periodValue, "vi")

  // ---- Auth & scope ----
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  const seeAll = can(current.role, CAPS.ANALYTICS_VIEW_ALL)
  const seeOwn = can(current.role, CAPS.ANALYTICS_VIEW_OWN)
  if (!seeAll && !seeOwn) redirect("/admin")

  const scope: ClientScope = seeAll
    ? { kind: "all" }
    : { kind: "owned", managerId: current.userId }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-balance flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Phân tích & Báo cáo
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            Theo dõi lịch sử pipeline, win rate, deal đang tắc và phân tích
            thất bại theo từng client / kỳ thời gian.
          </p>
        </div>
        <PeriodSelector value={periodValue} />
      </div>

      {/* Scope notice for AE / researcher */}
      {!seeAll && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Phạm vi: chỉ khách hàng được giao cho bạn</AlertTitle>
          <AlertDescription>
            Bạn đang xem dữ liệu của các client mà admin đã gán cho bạn làm
            account manager. Liên hệ admin nếu bạn cần truy cập thêm.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <AnalyticsTabsNav current={tab} period={periodValue} />

      {/* Tab content */}
      {tab === "overview" && <OverviewTab scope={scope} period={period} />}
      {tab === "clients" && <ByClientTab scope={scope} period={period} />}
      {tab === "bottleneck" && <BottleneckTab scope={scope} />}
      {tab === "lost" && <LostTab scope={scope} period={period} />}
    </div>
  )
}
