import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ClipboardList } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { createClient } from "@/lib/supabase/server"
import { EngagementList } from "@/app/admin/ae-inbox/engagement-list"
import { getMyEngagements } from "@/app/admin/ae-inbox/engagement-actions"

export const dynamic = "force-dynamic"

/**
 * "Đang xử lý" (In progress) — every buyer an AE has claimed and is
 * gathering requirements from, BEFORE a client/supplier has been picked
 * and an opportunity created. Buyer replies received during this window
 * (via the Resend inbound webhook, matched against buyer_engagements
 * rather than an opportunity) surface here — this used to be a dead end
 * where replies were silently dropped.
 *
 * Was previously a section embedded in /admin/ae-inbox; split out to its
 * own sidebar destination so it's not buried under the AI match queue.
 */
export default async function EngagementsPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  const allowedRoles = ["admin", "super_admin", "account_executive"]
  if (!allowedRoles.includes(current.role)) {
    redirect("/admin")
  }

  const { locale } = await getDictionary()
  const supabase = await createClient()

  let clientsQuery = supabase
    .from("profiles")
    .select("id, full_name, company_name, fda_expires_at")
    .eq("role", "client")
    .order("company_name")

  if (current.role === "account_executive") {
    clientsQuery = clientsQuery.eq("account_manager_id", current.userId)
  }

  const { data: clients } = await clientsQuery

  const validClients = (clients || []).filter((c) => {
    if (!c.fda_expires_at) return false
    return new Date(c.fda_expires_at) > new Date()
  })

  const engagementsResult = await getMyEngagements()
  const engagements = engagementsResult.ok ? engagementsResult.data : []

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground text-balance">
            {locale === "vi" ? "Đang xử lý" : "In progress"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl text-pretty">
          {locale === "vi"
            ? "Tất cả buyer bạn đã nhận và đang hỏi nhu cầu, trước khi gán client/supplier. Phản hồi của buyer trong giai đoạn này hiển thị trực tiếp trong từng thẻ."
            : "Every buyer you've claimed and are gathering requirements from, before a client/supplier is assigned. Buyer replies during this stage show up directly on each card."}
        </p>
      </div>

      {engagements.length > 0 ? (
        <Suspense>
          <EngagementList engagements={engagements as any} clients={validClients} locale={locale} />
        </Suspense>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {locale === "vi"
            ? "Chưa có buyer nào đang xử lý. Nhận buyer từ trang \"Buyer của tôi\" để bắt đầu."
            : "No buyers in progress yet. Claim a buyer from \"My Buyers\" to get started."}
        </div>
      )}
    </div>
  )
}
