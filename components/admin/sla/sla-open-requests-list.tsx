/**
 * Live list of open / in-progress client_requests with the running SLA
 * timer. Drives the "fire alarm" surface on the admin SLA dashboard.
 */
import Link from "next/link"
import { Inbox, Phone, Mail, MessageCircle, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { SlaRespondDialog } from "./sla-respond-dialog"
import { cn } from "@/lib/utils"

interface RequestRow {
  id: string
  client_id: string
  subject: string
  received_at: string
  first_response_at: string | null
  priority: string
  channel: string
  status: string
  company_name: string | null
  full_name: string | null
}

interface Props {
  requests: RequestRow[]
  /** Target hours from sla_targets (M4). Drives the threshold tone. */
  responseTargetHours: number
}

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  zalo: MessageCircle,
  phone: Phone,
  whatsapp: MessageCircle,
  portal: Globe,
  other: Inbox,
}

const PRIORITY_TONE: Record<string, string> = {
  low: "border-muted text-muted-foreground",
  normal: "border-border text-foreground",
  high: "border-amber-500/50 text-amber-700 dark:text-amber-300",
  urgent: "border-rose-500/60 text-rose-700 dark:text-rose-300",
}

function ageHours(receivedIso: string): number {
  return Math.round((Date.now() - new Date(receivedIso).getTime()) / 3_600_000)
}

function timerTone(age: number, target: number): string {
  if (age >= target) return "text-rose-600 dark:text-rose-400 font-semibold"
  if (age >= target * 0.75) return "text-amber-600 dark:text-amber-400 font-semibold"
  return "text-muted-foreground"
}

export function SlaOpenRequestsList({
  requests,
  responseTargetHours,
}: Props) {
  return (
    <Card className="border-border">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            Yêu cầu đang mở
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Đếm ngược tới target {responseTargetHours}h theo SLA M4
          </p>
        </div>
        <Badge variant="outline" className="text-xs tabular-nums">
          {requests.length}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {requests.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyTitle className="text-sm">Sạch hộp thư</EmptyTitle>
            <EmptyDescription className="text-xs">
              Không có yêu cầu nào đang chờ phản hồi.
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => {
              const ChannelIcon = CHANNEL_ICON[r.channel] ?? Inbox
              const age = ageHours(r.received_at)
              const tone = timerTone(age, responseTargetHours)
              const responded = r.first_response_at != null
              const name =
                r.company_name ??
                r.full_name ??
                r.client_id.slice(0, 8)
              return (
                <li
                  key={r.id}
                  className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ChannelIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/clients/${r.client_id}`}
                        className="text-xs font-medium text-muted-foreground hover:underline truncate"
                      >
                        {name}
                      </Link>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wide px-1.5 py-0 rounded border",
                          PRIORITY_TONE[r.priority] ?? PRIORITY_TONE.normal,
                        )}
                      >
                        {r.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate mt-0.5">
                      {r.subject}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className={cn("tabular-nums", tone)}>
                        {responded ? "Đã phản hồi" : `${age}h trôi qua`}
                      </span>
                      <span className="text-muted-foreground">
                        target {responseTargetHours}h
                      </span>
                      <span className="text-muted-foreground capitalize">
                        {r.status === "open" ? "Mở" : "Đang xử lý"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <SlaRespondDialog
                      requestId={r.id}
                      alreadyResponded={responded}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
