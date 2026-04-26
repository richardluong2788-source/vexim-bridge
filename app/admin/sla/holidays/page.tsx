/**
 * /admin/sla/holidays — public-holiday calendar manager (v2 B.1).
 *
 * Used by the SLA evaluator to skip Sat/Sun + holiday days when computing
 * business hours / business days. Only super_admin and admin can write.
 */
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CalendarDays } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { createAdminClient } from "@/lib/supabase/admin"
import { SlaHolidayManager } from "@/components/admin/sla/sla-holiday-manager"
import type { SlaHoliday } from "@/lib/sla/types"

export const dynamic = "force-dynamic"

export default async function SlaHolidaysPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  const seeAll = can(current.role, CAPS.SLA_VIEW_ALL)
  if (!seeAll) redirect("/admin/sla")
  const canWrite = can(current.role, CAPS.SLA_HOLIDAY_WRITE)

  const admin = createAdminClient()
  const { data } = await admin
    .from("sla_holidays" as never)
    .select("holiday_date, label, country")
    .order("holiday_date", { ascending: true })
    .returns<SlaHoliday[]>()

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1100px] mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-3">
            <Link href="/admin/sla">
              <ArrowLeft className="h-3.5 w-3.5" />
              SLA Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-balance">
            <CalendarDays className="h-6 w-6 text-primary" />
            Lịch ngày nghỉ Việt Nam
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            Evaluator SLA sẽ bỏ qua các ngày trong danh sách này khi tính giờ
            làm việc cho M1 (Pipeline) và M4 (Phản hồi), cũng như ngày làm
            việc cho M5 (Swift).
          </p>
        </div>
      </div>

      <SlaHolidayManager holidays={data ?? []} canWrite={canWrite} />
    </div>
  )
}
