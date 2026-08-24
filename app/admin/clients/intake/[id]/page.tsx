import { notFound } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor } from "@/lib/auth/scope"
import {
  IntakeReviewDetail,
  type IntakeSubmissionDetail,
} from "@/components/admin/intake-review-detail"

export const dynamic = "force-dynamic"

export default async function ClientIntakeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { locale } = await getDictionary()
  const current = await getCurrentRole()
  if (!current) return null
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)

  let q = admin
    .from("client_intake_submissions")
    .select(
      "*, profiles!client_intake_submissions_ae_id_fkey(full_name, email)",
    )
    .eq("id", id)

  if (scope.kind === "owned") {
    q = q.eq("ae_id", scope.userId)
  }

  const { data } = await q.maybeSingle()

  if (!data) notFound()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <IntakeReviewDetail
        submission={data as unknown as IntakeSubmissionDetail}
        locale={locale}
        canReview={data.status === "submitted"}
      />
    </div>
  )
}
