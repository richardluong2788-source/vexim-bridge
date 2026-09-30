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
      "id,status,contact_name,email,phone,company_name,industries,country,address,website,tax_code,tagline,company_description,main_products,production_capacity,moq,lead_time_days,usp_points,logo_url,cover_image_url,factory_image_urls,video_url,certifications,certifications_other,certification_image_urls,submitted_at,created_client_id,review_notes,rejection_reason,quality_systems,quality_systems_other,oem_odm,company_scale,export_since_year,export_markets,export_markets_other,traceability,fda_status,fda_number,fda_expires_at,fda_certificate_url,audit_readiness,audit_owner,incoterms,payment_policy,oem_policy,odm_policy,has_export_dept,has_english_staff,pricing_decision_maker,commitments,project_priority,profiles!client_intake_submissions_ae_id_fkey(full_name,email)",
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
