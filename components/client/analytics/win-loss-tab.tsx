/**
 * Win/Loss tab — sample-restricted segment breakdown.
 *
 * Per the audit decision, this analysis ONLY counts deals that ever
 * reached `price_agreed` or beyond. Earlier-stage opportunities are
 * deliberately excluded for two reasons:
 *
 *   1. Sample quality — win-rate over all-time-cold-leads is statistically
 *      meaningless; clients need the rate over deals that "got serious".
 *   2. Privacy — ESH would otherwise be exposing the buyer industry/region
 *      mix it's currently prospecting on behalf of competing clients.
 */
import { Info, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { getClientWinLoss, type SegmentRow } from "@/lib/analytics/client-queries"
import type { PeriodWindow } from "@/lib/analytics/constants"
import { getDictionary } from "@/lib/i18n/server"

interface Props {
  period: PeriodWindow
}

export async function ClientWinLossTab({ period }: Props) {
  const { t } = await getDictionary()
  const a = t.client.analytics
  const phaseLabels = t.client.leads.phase

  const data = await getClientWinLoss(period)

  if (data.totalAnalysed === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{a.winLoss.sampleNoteTitle}</AlertTitle>
          <AlertDescription>{a.winLoss.sampleNote}</AlertDescription>
        </Alert>
        <Card className="border-border p-10">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{a.winLoss.notEnoughTitle}</EmptyTitle>
              <EmptyDescription>{a.winLoss.notEnough}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{a.winLoss.sampleNoteTitle}</AlertTitle>
        <AlertDescription>
          {a.winLoss.sampleNote}{" "}
          <span className="font-medium text-foreground">
            {a.winLoss.sampleSize.replace("{n}", String(data.totalAnalysed))}
          </span>
          .
        </AlertDescription>
      </Alert>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">
              {a.winLoss.summaryWon}
            </div>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {data.totalWon}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">
              {a.winLoss.summaryLost}
            </div>
            <div className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {data.totalLost}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">
              {a.winLoss.summaryRate}
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {data.totalAnalysed > 0
                ? `${Math.round((data.totalWon / data.totalAnalysed) * 100)}%`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By industry / by region side-by-side on lg */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SegmentCard
          title={a.winLoss.byIndustryTitle}
          subtitle={a.winLoss.byIndustryDesc.replace(
            "{n}",
            String(data.byIndustry.length),
          )}
          rows={data.byIndustry}
          empty={a.winLoss.notEnough}
          colLabels={a.winLoss.cols}
        />
        <SegmentCard
          title={a.winLoss.byRegionTitle}
          subtitle={a.winLoss.byRegionDesc.replace(
            "{n}",
            String(data.byRegion.length),
          )}
          rows={data.byRegion}
          empty={a.winLoss.notEnough}
          colLabels={a.winLoss.cols}
        />
      </div>

      {/* Lost from which phase */}
      {data.byLostPhase.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              {a.winLoss.droppedTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {a.winLoss.droppedDesc}
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5">
              {data.byLostPhase.map((row) => {
                const max = data.byLostPhase[0]?.count ?? 1
                const pct = (row.count / max) * 100
                return (
                  <li key={row.phase} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-muted-foreground shrink-0 truncate">
                      {phaseLabels[row.phase]}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium tabular-nums text-foreground">
                      {row.count}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface SegmentCardProps {
  title: string
  subtitle: string
  rows: SegmentRow[]
  empty: string
  colLabels: { segment: string; won: string; lost: string; winRate: string }
}

function SegmentCard({ title, subtitle, rows, empty, colLabels }: SegmentCardProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium pb-2">
                  {colLabels.segment}
                </th>
                <th className="text-right font-medium pb-2">{colLabels.won}</th>
                <th className="text-right font-medium pb-2">{colLabels.lost}</th>
                <th className="text-right font-medium pb-2">
                  {colLabels.winRate}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const wrColor =
                  r.winRate >= 50
                    ? "text-emerald-600 dark:text-emerald-400"
                    : r.winRate >= 25
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                return (
                  <tr key={r.key}>
                    <td className="py-2 truncate max-w-[180px]">{r.key}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {r.won}
                    </td>
                    <td className="py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {r.lost}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums font-medium ${wrColor}`}
                    >
                      {r.winRate}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
