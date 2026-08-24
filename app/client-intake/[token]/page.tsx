import { TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ClientIntakeForm } from "@/components/client-intake/client-intake-form"
import { siteConfig } from "@/lib/site-config"
import type { Industry } from "@/lib/constants/industries"

interface IntakeSubmissionRow {
  id: string
  status: string
  ae_full_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  industries: Industry[] | null
  country: string | null
  address: string | null
  website: string | null
  tax_code: string | null
  tagline: string | null
  company_description: string | null
  main_products: string | null
  production_capacity: string | null
  moq: string | null
  lead_time_days: string | null
  usp_points: { icon: string; title: string }[] | null
  logo_url: string | null
  cover_image_url: string | null
  factory_image_urls: string[] | null
  video_url: string | null
  certifications: string[] | null
  certifications_other: string | null
  quality_systems: string[] | null
  quality_systems_other: string | null
  oem_odm: string[] | null
  company_scale: string | null
  export_since_year: number | null
  export_markets: string[] | null
  export_markets_other: string | null
  traceability: string[] | null
  fda_status: string | null
  fda_number: string | null
  fda_expires_at: string | null
  staff_engineers_count: number | null
  staff_workers_count: number | null
  work_hours_start: string | null
  work_hours_end: string | null
  work_days_per_week: number | null
  food_safety_training_regular: boolean | null
  equipment_calibration_regular: boolean | null
  water_source: string[] | null
  water_source_other: string | null
  water_testing: boolean | null
  near_pollution_source: boolean | null
  pollution_source_note: string | null
  audit_readiness: string[] | null
  audit_owner: string | null
  incoterms: string[] | null
  payment_policy: string | null
  oem_policy: string | null
  odm_policy: string | null
  has_export_dept: boolean | null
  has_english_staff: boolean | null
  pricing_decision_maker: string | null
  commitments: string[] | null
  project_priority: string | null
}

export default async function ClientIntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .rpc("get_intake_submission_by_token", { p_token: token })
    .maybeSingle<IntakeSubmissionRow>()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">
              {siteConfig.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {siteConfig.tagline}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {data ? (
          <ClientIntakeForm token={token} initial={data} />
        ) : (
          <InvalidLinkNotice />
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-6 pb-10 text-center text-xs text-muted-foreground">
        {siteConfig.legalName} &middot; {siteConfig.contact.email}
      </footer>
    </div>
  )
}

function InvalidLinkNotice() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        Liên kết không hợp lệ hoặc đã hết hạn
      </h1>
      <p className="text-sm text-muted-foreground">
        Liên kết này có thể đã được sử dụng, đã hết hạn, hoặc không còn hiệu
        lực. Vui lòng liên hệ với nhân viên kinh doanh đã gửi form cho bạn để
        nhận liên kết mới.
      </p>
    </div>
  )
}
