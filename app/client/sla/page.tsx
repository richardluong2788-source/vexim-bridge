/**
 * /client/sla — client portal SLA scorecard.
 *
 * Shows the client:
 *   - Current month Health Score + per-metric breakdown vs targets
 *   - 6-month trend
 *   - Their own client_requests (open + history)
 *   - A form to submit a new portal request (channel='portal')
 */
import { redirect } from "next/navigation"
import { ShieldCheck, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isAdminShellRole, normaliseRole } from "@/lib/auth/permissions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  loadClientOwnRequests,
  loadClientSlaHistory,
} from "@/lib/sla/queries"
import { ClientSlaScorecard } from "@/components/client/sla/client-sla-scorecard"
import { ClientRequestForm } from "@/components/client/sla/client-request-form"
import { ClientRequestList } from "@/components/client/sla/client-request-list"

export const dynamic = "force-dynamic"

export default async function ClientSlaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Defense-in-depth: layout already filters but verify the role here.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const role = normaliseRole(profile?.role)
  if (isAdminShellRole(role)) redirect("/admin/sla")

  const [{ points, targets }, requests] = await Promise.all([
    loadClientSlaHistory(user.id, { monthsBack: 6 }),
    loadClientOwnRequests(user.id, 30),
  ])

  // Latest month is the last point we generated.
  const current = points[points.length - 1]

  const responseTarget = Number(
    targets.find((t) => t.metric_key === "client_request_response")
      ?.target_value ?? 24,
  )

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1300px] mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-balance">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            SLA &amp; Yêu cầu hỗ trợ
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty max-w-2xl">
            Theo dõi cam kết dịch vụ Vexim Bridge — gồm 7 chỉ tiêu Điều 7.3
            hợp đồng và lịch sử các yêu cầu bạn đã gửi.
          </p>
        </div>
      </div>

      {!current ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Chưa có dữ liệu SLA</AlertTitle>
          <AlertDescription>
            Đánh giá SLA chạy tự động vào ngày 1 hàng tháng. Bạn vẫn có thể
            gửi yêu cầu hỗ trợ ở phần bên dưới.
          </AlertDescription>
        </Alert>
      ) : (
        <ClientSlaScorecard
          current={current}
          history={points}
          targets={targets}
        />
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        <ClientRequestForm responseTargetHours={responseTarget} />
        <ClientRequestList
          requests={requests}
          responseTargetHours={responseTarget}
        />
      </div>
    </div>
  )
}
