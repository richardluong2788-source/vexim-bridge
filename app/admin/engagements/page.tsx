import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ClipboardList } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { createClient } from "@/lib/supabase/server"
import { EngagementList } from "@/app/admin/ae-inbox/engagement-list"
import { getMyEngagements } from "@/app/admin/ae-inbox/engagement-actions"
import { loadAssignableClients } from "@/lib/buyers/engagement-queries"

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

  // Active clients only (FDA in date) — the shortlist builder must not offer a
  // supplier the buyer cannot import from. Shared with the buyer profile so the
  // two screens offer the same set.
  const validClients = await loadAssignableClients(supabase, {
    accountManagerId: current.role === "account_executive" ? current.userId : null,
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
