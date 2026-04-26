/**
 * Compact 7-tile strip showing per-metric violation counts for the period
 * across the entire portfolio. Drives quick "where is fire today" glance.
 */
import {
  Activity,
  Calendar,
  Clock,
  FileText,
  Mail,
  ShieldQuestion,
  Users,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SLA_METRIC_KEYS, SLA_METRIC_META, type SlaMetricKey } from "@/lib/sla/types"

interface Props {
  totalsByMetric: Record<SlaMetricKey, number>
  /** Total number of clients tracked — for context in the hint. */
  totalClients: number
}

const METRIC_ICONS: Record<SlaMetricKey, typeof Activity> = {
  pipeline_update_response: Activity,
  monthly_qualified_leads: Users,
  monthly_email_outreach: Mail,
  client_request_response: Clock,
  swift_verification_lag: ShieldQuestion,
  fda_renewal_alert: Calendar,
  monthly_status_report: FileText,
}

export function SlaMetricTiles({ totalsByMetric, totalClients }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {SLA_METRIC_KEYS.map((key) => {
        const meta = SLA_METRIC_META[key]
        const violations = totalsByMetric[key] ?? 0
        const Icon = METRIC_ICONS[key]
        const tone =
          violations === 0
            ? "text-emerald-600 dark:text-emerald-400"
            : violations <= 2
              ? "text-amber-600 dark:text-amber-400"
              : "text-rose-600 dark:text-rose-400"
        const dotTone =
          violations === 0
            ? "bg-emerald-500"
            : violations <= 2
              ? "bg-amber-500"
              : "bg-rose-500"
        return (
          <Card key={key} className="border-border">
            <CardContent className="p-3 flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground line-clamp-2 leading-tight">
                  {meta.labelVi}
                </span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-semibold tabular-nums ${tone}`}>
                  {violations}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  vi phạm
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${dotTone}`} />
                {totalClients} client
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
