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
      "id,status,contact_name,email,phone,company_name,industries,country,address,website,tax_code,tagline,company_description,main_products,production_capacity,moq,lead_time_days,usp_points,logo_url,cover_image_url,factory_image_urls,video_url,certifications,certifications_other,certification_image_urls,submitted_at,created_client_id,client_id,review_notes,rejection_reason,quality_systems,quality_systems_other,oem_odm,company_scale,export_since_year,export_markets,export_markets_other,traceability,fda_status,fda_number,fda_expires_at,fda_certificate_url,supplier_entity_type,manufacturing_sources,source_verification_status,source_verification_consent,source_change_acknowledged,us_sales_channel_status,us_sales_channel_notes,vexim_support_needs,vexim_support_other,audit_readiness,audit_owner,incoterms,payment_policy,oem_policy,odm_policy,has_export_dept,has_english_staff,pricing_decision_maker,commitments,project_priority,profiles!client_intake_submissions_ae_id_fkey(full_name,email)",
    )
    .eq("id", id)

  if (scope.kind === "owned") {
    q = q.eq("ae_id", scope.userId)
  }

  const { data } = await q.maybeSingle()

  if (!data) notFound()

  // Supplement links deliberately do not prefill internal facility rows, but
  // the reviewer still needs the current account-level source status so it
  // is not accidentally reset while reviewing an empty supplement.
  const accountLookup = data.client_id
    ? admin.from("profiles").select("id,source_verification_status").eq("id", data.client_id)
    : data.email
      ? admin.from("profiles").select("id,source_verification_status").eq("email", data.email.trim().toLowerCase())
      : null
  const { data: linkedProfile } = accountLookup
    ? await accountLookup.maybeSingle()
    : { data: null }
  const reviewSubmission = {
    ...data,
    source_verification_status: linkedProfile?.source_verification_status ?? data.source_verification_status,
    linked_client_profile: Boolean(linkedProfile),
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <IntakeReviewDetail
        submission={reviewSubmission as unknown as IntakeSubmissionDetail}
        locale={locale}
        canReview={data.status === "submitted"}
      />
    </div>
  )
}
