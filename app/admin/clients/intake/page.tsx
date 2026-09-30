import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"
import { ScopeBanner } from "@/components/admin/scope-banner"
import { IntakeReviewList, type IntakeSubmissionRow } from "@/components/admin/intake-review-list"

export const dynamic = "force-dynamic"

export default async function ClientIntakeQueuePage() {
  const { locale } = await getDictionary()
  const current = await getCurrentRole()
  if (!current) return null
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)

  let q = admin
    .from("client_intake_submissions")
    .select(
      "id, status, company_name, contact_name, email, phone, industries, submitted_at, created_at, expires_at, ae_id, rejection_reason, profiles!client_intake_submissions_ae_id_fkey(full_name, email)",
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (scope.kind === "owned") {
    q = q.eq("ae_id", scope.userId)
  }

  // Hide unused expired links immediately; the daily cron removes them from DB.
  q = q.or(`status.neq.pending,expires_at.gt.${new Date().toISOString()}`)

  const { data } = await q

  const rows = (data ?? []) as unknown as IntakeSubmissionRow[]

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {locale === "vi" ? "Hồ sơ chờ duyệt" : "Pending Profiles"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {locale === "vi"
            ? "Hồ sơ do khách hàng tự điền qua liên kết mời. Xem xét, bổ sung thông tin thiếu, sau đó xác nhận để tạo tài khoản hoặc từ chối."
            : "Profiles filled in by clients through invite links. Review, add any missing info, then approve to create the account or reject."}
        </p>
        {scope.kind === "owned" && (
          <ScopeBanner
            locale={locale}
            count={rows.length}
            entityVi="hồ sơ"
            entityEn="profiles"
          />
        )}
      </div>
      <IntakeReviewList rows={rows} locale={locale} />
    </div>
  )
}
