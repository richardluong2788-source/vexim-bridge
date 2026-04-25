/**
 * Pipeline tab — 5-phase distribution + median time spent in each phase
 * + the "Awaiting buyer response" list (deliberately reframed from the
 * admin "Stuck deals" tab to avoid imposing internal SLAs on the client UI).
 */
import { Layers, Clock4, Inbox } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  getClientPhaseDistribution,
  getClientAvgTimePerPhase,
  getClientAwaitingDeals,
} from "@/lib/analytics/client-queries"
import { CLIENT_PHASE_ORDER } from "@/lib/pipeline/phases"
import { getDictionary } from "@/lib/i18n/server"
import { ClientPhaseFunnel } from "./phase-funnel"

export async function ClientPipelineTab() {
  const { t } = await getDictionary()
  const a = t.client.analytics
  const phaseLabels = t.client.leads.phase

  const [phases, avgTime, awaiting] = await Promise.all([
    getClientPhaseDistribution(),
    getClientAvgTimePerPhase(),
    getClientAwaitingDeals(),
  ])

  const fmtDays = (n: number | null) => {
    if (n === null) return "—"
    if (n === 0) return a.kpis.daysZero
    return a.kpis.daysSuffix.replace("{n}", String(n))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Phase distribution */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {a.pipeline.distributionTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {a.pipeline.distributionDesc}
          </p>
        </CardHeader>
        <CardContent>
          <ClientPhaseFunnel data={phases} />
        </CardContent>
      </Card>

      {/* Avg time per phase */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock4 className="h-4 w-4 text-muted-foreground" />
            {a.pipeline.avgTimeTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {a.pipeline.avgTimeDesc}
          </p>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5">
            {CLIENT_PHASE_ORDER.map((phase) => {
              const row = avgTime.find((r) => r.phase === phase)
              return (
                <li key={phase} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-muted-foreground shrink-0 truncate">
                    {phaseLabels[phase]}
                  </span>
                  <div className="flex-1 text-xs text-muted-foreground">
                    {row && row.sampleSize > 0
                      ? a.pipeline.avgTimeSample.replace(
                          "{n}",
                          String(row.sampleSize),
                        )
                      : a.pipeline.avgTimeNoSample}
                  </div>
                  <span className="w-24 text-right text-sm font-medium tabular-nums text-foreground">
                    {fmtDays(row?.medianDays ?? null)}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Awaiting buyer response — NOT "stuck deals" */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            {a.pipeline.awaitingTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {a.pipeline.awaitingDesc}
          </p>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{a.pipeline.awaitingEmptyTitle}</EmptyTitle>
                <EmptyDescription>
                  {a.pipeline.awaitingEmptyDesc}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {awaiting.map((d) => (
                <div
                  key={d.opportunityId}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {d.buyerLabel}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[d.industry, d.region].filter(Boolean).join(" · ") ||
                        "—"}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {phaseLabels[d.phase]}
                  </Badge>
                  <span className="text-sm font-medium text-foreground tabular-nums shrink-0 w-20 text-right">
                    {a.kpis.daysSuffix.replace(
                      "{n}",
                      String(d.daysAtPhase),
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
