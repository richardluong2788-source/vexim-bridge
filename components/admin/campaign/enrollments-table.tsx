"use client"

// Bảng enrollment + hành động: pause / resume / stop / resolve review.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pause, Play, Square, UserCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { STATE_LABELS, TERMINAL_STATES, type EnrollmentState } from "@/lib/campaign/constants"
import {
  pauseEnrollmentAction,
  resumeEnrollmentAction,
  stopEnrollmentAction,
  resolveReviewAction,
} from "@/app/admin/campaigns/actions"

export interface EnrollmentRowView {
  id: string
  state: EnrollmentState
  current_step_number: number
  followup_count: number
  next_action_at: string | null
  next_action_type: string | null
  last_contact_at: string | null
  last_reply_at: string | null
  needs_human_review: boolean
  human_review_reason: string | null
  handoff_engagement_id: string | null
  stopped_reason: string | null
  owner_id: string | null
  updated_at: string
  lead: {
    id: string
    company_name: string | null
    contact_person: string | null
    contact_email: string | null
    country: string | null
    industry: string | null
  } | null
}

const TERMINAL = TERMINAL_STATES as readonly string[]

export function CampaignEnrollmentsTable({
  enrollments,
  canManage,
  isAE,
  currentUserId,
}: {
  enrollments: EnrollmentRowView[]
  canManage: boolean
  isAE: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>, id: string) {
    setBusyId(id)
    const res = await fn()
    setBusyId(null)
    if (res.ok) router.refresh()
    else toast.error(res.message ?? "Hành động thất bại")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Buyer trong campaign ({enrollments.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Chưa có enrollment. Dùng &ldquo;Enroll buyer pilot&rdquo; để chọn 50–100 buyer có tín hiệu rõ.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Công ty</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Contacted / Reply</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => {
                const isTerminal = TERMINAL.includes(e.state)
                const canAct = canManage && (!isAE || e.owner_id === currentUserId) && !isTerminal
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.lead?.company_name ?? "(?)"}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.lead?.contact_person ?? "—"} · {e.lead?.country ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={isTerminal ? "text-muted-foreground" : ""}>
                        {STATE_LABELS[e.state]?.vi ?? e.state}
                      </Badge>
                      {e.needs_human_review && (
                        <Badge variant="outline" className="ml-1 border-amber-400 text-amber-600">
                          <UserCheck className="mr-1 h-3 w-3" /> Review
                        </Badge>
                      )}
                      {e.stopped_reason && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{e.stopped_reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      #{e.current_step_number} · {e.followup_count} FU
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.next_action_at ? new Date(e.next_action_at).toLocaleString("vi-VN") : "—"}
                      <div className="text-muted-foreground">{e.next_action_type ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.last_contact_at ? new Date(e.last_contact_at).toLocaleDateString("vi-VN") : "—"}
                      {" / "}
                      {e.last_reply_at ? new Date(e.last_reply_at).toLocaleDateString("vi-VN") : "chưa"}
                    </TableCell>
                    <TableCell className="text-right">
                      {canAct && (
                        <div className="flex justify-end gap-1">
                          {e.needs_human_review ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === e.id}
                                onClick={() => run(() => resolveReviewAction(e.id, "resume"), e.id)}
                              >
                                {busyId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                Tiếp tục
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === e.id}
                                onClick={() => run(() => resolveReviewAction(e.id, "stop"), e.id)}
                              >
                                <Square className="h-3 w-3" /> Dừng
                              </Button>
                            </>
                          ) : e.state === "paused" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === e.id}
                              onClick={() => run(() => resumeEnrollmentAction(e.id), e.id)}
                            >
                              <Play className="mr-1 h-3 w-3" /> Resume
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === e.id}
                                title="Pause 14 ngày"
                                onClick={() => run(() => pauseEnrollmentAction(e.id, 14), e.id)}
                              >
                                <Pause className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === e.id}
                                title="Stop"
                                onClick={() => run(() => stopEnrollmentAction(e.id, "manual_stop_by_ae"), e.id)}
                              >
                                <Square className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
