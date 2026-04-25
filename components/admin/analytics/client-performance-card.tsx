/**
 * Performance card embedded inside /admin/clients/[id].
 *
 * Server component — fetches a single-client KPI roll-up plus the
 * per-month win/lost/created trend, then renders a period selector
 * via querystring (?perfPeriod=...).
 *
 * The selector uses a separate query key (`perfPeriod`) so it does not
 * collide with the pipeline's own filters when this card is later
 * embedded into other detail pages.
 */
import Link from "next/link"
import { TrendingUp, ArrowRight } from "lucide-react"
import {
  parsePeriod,
  resolvePeriod,
  STAGE_LABEL_VI,
  type PeriodValue,
  type Stage,
} from "@/lib/analytics/constants"
import { getSingleClientMetrics } from "@/lib/analytics/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MonthlyTrendChart } from "./monthly-trend-chart"
import { PerfPeriodSelector } from "./perf-period-selector"

const KPI_TILES: Array<{
  key:
    | "newOpportunities"
    | "wonInPeriod"
    | "lostInPeriod"
    | "winRate"
    | "inProgressCount"
    | "commissionEarned"
  label: string
  hint?: string
  format: "int" | "pct" | "currency"
}> = [
  { key: "newOpportunities", label: "Đơn mới trong kỳ", format: "int" },
  { key: "wonInPeriod",      label: "Chốt thành công",  format: "int" },
  { key: "lostInPeriod",     label: "Thất bại",         format: "int" },
  { key: "winRate",          label: "Tỉ lệ thắng",      format: "pct" },
  { key: "inProgressCount",  label: "Đang chạy",        hint: "snapshot", format: "int" },
  { key: "commissionEarned", label: "Hoa hồng (USD)",   format: "currency" },
]

function fmt(value: number, kind: "int" | "pct" | "currency"): string {
  if (kind === "pct") return `${value}%`
  if (kind === "currency")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value)
  return new Intl.NumberFormat("en-US").format(value)
}

interface Props {
  clientId: string
  /** Already-parsed querystring value, e.g. searchParams.perfPeriod */
  perfPeriodRaw: string | undefined
  /** Path to navigate the period selector to (preserves other params). */
  basePath: string
}

export async function ClientPerformanceCard({
  clientId,
  perfPeriodRaw,
  basePath,
}: Props) {
  const periodValue = parsePeriod(perfPeriodRaw)
  const period = resolvePeriod(periodValue, "vi")
  const m = await getSingleClientMetrics(clientId, period)

  const inProgressTotal = m.stageDistribution
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((acc, s) => acc + s.count, 0)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Hiệu suất ({period.label})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Lịch sử đơn hàng, win/lost và phân bố pipeline của khách hàng này.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PerfPeriodSelector value={periodValue} basePath={basePath} />
          <Link
            href={`/admin/analytics?tab=clients&period=${periodValue}`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Xem toàn cảnh <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {KPI_TILES.map((tile) => (
            <div
              key={tile.key}
              className="rounded-md border border-border p-3 flex flex-col gap-1"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {tile.label}
                {tile.hint ? (
                  <span className="ml-1 text-muted-foreground/60">
                    ({tile.hint})
                  </span>
                ) : null}
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {fmt(m[tile.key] as number, tile.format)}
              </p>
            </div>
          ))}
        </div>

        {/* Stage distribution snapshot */}
        <div>
          <p className="text-sm font-medium mb-2">
            Đang nằm ở stage nào{" "}
            <span className="text-muted-foreground font-normal">
              · tổng {inProgressTotal} đơn
            </span>
          </p>
          {inProgressTotal === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có đơn nào đang chạy.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {m.stageDistribution
                .filter(
                  (s) =>
                    s.stage !== "won" &&
                    s.stage !== "lost" &&
                    s.count > 0,
                )
                .map((s) => (
                  <Badge
                    key={s.stage}
                    variant="secondary"
                    className="font-normal"
                  >
                    {STAGE_LABEL_VI[s.stage as Stage]}: {s.count}
                  </Badge>
                ))}
            </div>
          )}
        </div>

        {/* Monthly trend */}
        <div>
          <p className="text-sm font-medium mb-2">Xu hướng theo tháng</p>
          <MonthlyTrendChart data={m.monthly} />
        </div>
      </CardContent>
    </Card>
  )
}

export type { PeriodValue }
