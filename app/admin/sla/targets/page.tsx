/**
 * /admin/sla/targets — global SLA target editor (Sprint 1).
 *
 * Sprint 1 only edits global rows (billing_plan_id IS NULL). Per-plan
 * overrides are added in Sprint 2 once finance has tuned the defaults.
 */
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Settings } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { createAdminClient } from "@/lib/supabase/admin"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SlaTargetForm } from "@/components/admin/sla/sla-target-form"
import {
  SLA_METRIC_KEYS,
  type SlaTarget,
} from "@/lib/sla/types"

export const dynamic = "force-dynamic"

export default async function SlaTargetsPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  const seeAll = can(current.role, CAPS.SLA_VIEW_ALL)
  if (!seeAll) redirect("/admin/sla")
  const canWrite = can(current.role, CAPS.SLA_TARGET_WRITE)

  const admin = createAdminClient()
  const { data } = await admin
    .from("sla_targets" as never)
    .select(
      "id, billing_plan_id, metric_key, target_value, weight, penalty_usd_cents, active, notes, created_at, updated_at",
    )
    .is("billing_plan_id", null)
    .eq("active", true)
    .returns<SlaTarget[]>()

  const targets = data ?? []
  // Compute total weight for the alert.
  const totalWeight = targets.reduce((acc, t) => acc + Number(t.weight ?? 0), 0)

  // Order by SLA_METRIC_KEYS so the cards appear in contract order.
  const orderedTargets = SLA_METRIC_KEYS
    .map((k) => targets.find((t) => t.metric_key === k))
    .filter((t): t is SlaTarget => Boolean(t))

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1200px] mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-3">
            <Link href="/admin/sla">
              <ArrowLeft className="h-3.5 w-3.5" />
              SLA Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-balance">
            <Settings className="h-6 w-6 text-primary" />
            Cấu hình ngưỡng SLA
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            Ngưỡng mặc định toàn hệ thống cho từng chỉ tiêu Điều 7.3. Override
            theo billing plan sẽ được mở ở Sprint 2.
          </p>
        </div>
      </div>

      {Math.abs(totalWeight - 1) > 0.05 && (
        <Alert>
          <AlertTitle>Tổng weight đang là {totalWeight.toFixed(3)}</AlertTitle>
          <AlertDescription>
            Health Score chuẩn hoá tự động nên kết quả vẫn đúng, nhưng giữ tổng
            weight ≈ 1 sẽ trực quan hơn khi đọc bảng.
          </AlertDescription>
        </Alert>
      )}

      {orderedTargets.length === 0 ? (
        <Alert>
          <AlertTitle>Chưa có target nào</AlertTitle>
          <AlertDescription>
            Migration 031 đã seed sẵn 7 target mặc định. Nếu bạn không thấy ở
            đây, hãy xác nhận script đã chạy và các row có{" "}
            <code className="text-xs">active = TRUE</code>.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {orderedTargets.map((t) => (
            <SlaTargetForm key={t.id} target={t} canWrite={canWrite} />
          ))}
        </div>
      )}
    </div>
  )
}
