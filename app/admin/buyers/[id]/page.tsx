import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import {
  BuyerDetailView,
  type BuyerDetailData,
  type BuyerOpportunity,
  type BuyerReply,
} from "@/components/admin/buyer-detail-view"
import type { EngagementActionTarget } from "@/components/admin/engagement-action-bar"
import { BuyerPerformanceCard } from "@/components/admin/analytics/buyer-performance-card"
import { canAny } from "@/lib/auth/permissions"
import { listContacts } from "@/lib/buyers/contacts-actions"
import type { BuyerContact } from "@/lib/supabase/types"
// Type-only imports — this is a server component and must not drag the `ai`
// package (pulled in by buyer-strategy-generator) into its runtime graph.
import type { BuyerAnalysisResult } from "@/lib/ai/buyer-analyzer"
import type { BuyerStrategy } from "@/lib/ai/buyer-strategy-generator"

export const dynamic = "force-dynamic"

/**
 * Narrow the opaque JSONB snapshot back to its domain shape.
 *
 * `leads.buyer_analysis` / `buyer_strategy` are declared as
 * `Record<string, unknown>` in lib/supabase/types.ts because the DB column is
 * schemaless JSONB (migration 079). A snapshot that does not at least carry
 * the three numeric scores is treated as absent, so the "Phân tích" tab falls
 * back to the heuristic card rather than rendering a half-broken analysis.
 */
function readAnalysisSnapshot(
  analysis: Record<string, unknown> | null,
  strategy: Record<string, unknown> | null,
): { analysis: BuyerAnalysisResult | null; strategy: BuyerStrategy | null } {
  if (!analysis || typeof analysis !== "object") {
    return { analysis: null, strategy: null }
  }
  const scores = [
    analysis.healthScore,
    analysis.loyaltyScore,
    analysis.vietnamReadiness,
  ]
  if (scores.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    return { analysis: null, strategy: null }
  }
  return {
    analysis: analysis as unknown as BuyerAnalysisResult,
    // Optional: the LLM call may have fallen back to generateFallbackStrategy,
    // or the LR may have submitted before it finished. BuyerAnalysisCard
    // renders scores-only when this is null.
    strategy: strategy
      ? (strategy as unknown as BuyerStrategy)
      : null,
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BuyerDetailPage({ params }: PageProps) {
  const { id } = await params

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.BUYER_VIEW)) redirect("/admin")

  const { locale } = await getDictionary()
  const canWrite = can(current.role, CAPS.BUYER_WRITE)
  const canViewPII = can(current.role, CAPS.BUYER_PII_VIEW)

  // --- 1) Buyer row -------------------------------------------------------
  const { data: buyer } = await current.admin
    .from("leads")
    .select("*")
    .eq("id", id)
    .single()

  if (!buyer) notFound()

  const analysisSnapshot = readAnalysisSnapshot(
    buyer.buyer_analysis,
    buyer.buyer_strategy,
  )

  // --- 1b) Contacts (multi-contact directory for this buyer company) -----
  const contactsResult = await listContacts(id)
  const contacts: BuyerContact[] = contactsResult.success ? contactsResult.data ?? [] : []

  // --- 1c) Open pre-opportunity engagement, if this buyer is claimed ------
  // Feeds the action bar at the top of the "Phân tích" tab: which stage the
  // buyer is in, how long they have been there, and a deep link to the next
  // action (which lives with the inbox card that owns the dialogs).
  //
  // Only passed down when the viewer can actually act on it — the owning AE, or
  // an admin. For anyone else the deep link would open an inbox that does not
  // list this buyer, so they get no bar at all rather than a broken promise.
  const roleCanWorkEngagements =
    current.role === "account_executive" ||
    current.role === "admin" ||
    current.role === "super_admin"

  type OpenEngagementRow = {
    id: string
    account_manager_id: string
    stage: string
    updated_at: string
    buyer_engagement_shortlist_versions:
      | Array<{
          version_number: number | null
          status: string | null
          buyer_engagement_shortlist_items:
            | Array<{ buyer_interested: boolean | null }>
            | null
        }>
      | null
  }

  let engagement: EngagementActionTarget | null = null
  if (roleCanWorkEngagements) {
    const { data: engagementRaw } = await current.admin
      .from("buyer_engagements")
      .select(
        `
        id,
        account_manager_id,
        stage,
        updated_at,
        buyer_engagement_shortlist_versions (
          version_number,
          status,
          buyer_engagement_shortlist_items ( buyer_interested )
        )
      `,
      )
      .eq("lead_id", id)
      .not("stage", "in", "(converted,dropped)")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const row = engagementRaw as unknown as OpenEngagementRow | null
    const isOwner = row?.account_manager_id === current.userId
    const isAdmin = current.role === "admin" || current.role === "super_admin"

    if (row && (isOwner || isAdmin)) {
      engagement = {
        id: row.id,
        account_manager_id: row.account_manager_id,
        stage: row.stage,
        updated_at: row.updated_at,
        // Only what the stage map needs: which versions exist and how many of
        // the buyer's items are flagged interested.
        buyer_engagement_shortlist_versions: (row.buyer_engagement_shortlist_versions ?? []).map(
          (version) => ({
            version_number: version.version_number,
            status: version.status,
            buyer_engagement_shortlist_items: version.buyer_engagement_shortlist_items ?? [],
          }),
        ),
      }
    }
  }

  // --- 2) Opportunities attached to this buyer ---------------------------
  // DEAL_VIEW gate: roles without the capability (lead_researcher,
  // supplier_researcher) must not see deal stages/values on the buyer
  // profile — they see the research + demand sections only. Replies are
  // joined off opportunity ids, so they resolve to empty automatically.
  const canSeeDeals = can(current.role, CAPS.DEAL_VIEW)
  const { data: opps } = canSeeDeals
    ? await current.admin
        .from("opportunities")
        .select(
          `
      id,
      stage,
      potential_value,
      target_close_date,
      last_updated,
      created_at,
      products_interested,
      next_step,
      client_action_required,
      profiles:client_id (
        id,
        full_name,
        company_name,
        fda_registration_number,
        fda_expires_at,
        client_profiles(display_name)
      )
    `,
    )
    .eq("lead_id", id)
    .order("last_updated", { ascending: false })
    : { data: null }

  const oppRows: BuyerOpportunity[] = (opps ?? []).map((o: any) => ({
    id: o.id,
    stage: o.stage,
    potential_value: o.potential_value,
    target_close_date: o.target_close_date,
    last_updated: o.last_updated,
    created_at: o.created_at,
    products_interested: o.products_interested,
    next_step: o.next_step,
    client_action_required: o.client_action_required,
    client: o.profiles
      ? {
          id: o.profiles.id,
          name:
            (o.profiles.client_profiles as Array<{ display_name: string | null }> | undefined)?.[0]?.display_name ??
            o.profiles.company_name ??
            o.profiles.full_name ??
            "—",
          fdaRegistrationNumber: o.profiles.fda_registration_number,
          fdaExpiresAt: o.profiles.fda_expires_at,
        }
      : null,
  }))

  // --- 3) Buyer replies across all those opportunities -------------------
  const oppIds = oppRows.map((o) => o.id)
  let replies: BuyerReply[] = []
  if (oppIds.length > 0) {
    const { data: rawReplies } = await current.admin
      .from("buyer_replies")
      .select(
        `
        id,
        opportunity_id,
        received_at,
        ai_intent,
        ai_summary,
        ai_confidence,
        translated_vi,
        raw_content
      `,
      )
      .in("opportunity_id", oppIds)
      .order("received_at", { ascending: false })
      .limit(50)

    const oppToClient = new Map(
      oppRows.map((o) => [o.id, o.client?.name ?? "—"]),
    )
    replies = (rawReplies ?? []).map((r: any) => ({
      id: r.id,
      opportunityId: r.opportunity_id,
      clientName: oppToClient.get(r.opportunity_id) ?? "—",
      receivedAt: r.received_at,
      intent: r.ai_intent,
      summary: r.ai_summary,
      confidence: r.ai_confidence,
      translatedVi: r.translated_vi,
      rawContent: r.raw_content,
    }))
  }

  const data: BuyerDetailData = {
    id: buyer.id,
    company_name: buyer.company_name,
    contact_person: buyer.contact_person,
    contact_email: buyer.contact_email,
    contact_phone: buyer.contact_phone,
    country: buyer.country,
    industry: buyer.industry,
    website: buyer.website,
    linkedin_url: buyer.linkedin_url,
    notes: buyer.notes,
    created_at: buyer.created_at,
    // Section 1: THONG TIN DINH DANH
    import_address: buyer.import_address ?? null,
    source_ref: buyer.source_ref ?? null,
    contact_title: buyer.contact_title ?? null,
    // Section 2: DU LIEU DINH LUONG
    total_shipments: buyer.total_shipments ?? null,
    last_shipment_date: buyer.last_shipment_date ?? null,
    avg_teu_per_month: buyer.avg_teu_per_month ?? null,
    top_peak_months: buyer.top_peak_months ?? null,
    top_low_months: buyer.top_low_months ?? null,
    peak_months_data_year: buyer.peak_months_data_year ?? null,
    import_trend: buyer.import_trend ?? null,
    // Section 3: MA HS & SAN PHAM
    hs_code: buyer.hs_code ?? null,
    main_product: buyer.main_product ?? null,
    secondary_hs_codes: buyer.secondary_hs_codes ?? null,
    // Section 4: CHUOI CUNG UNG
    top_suppliers: buyer.top_suppliers ?? null,
    main_import_countries: buyer.main_import_countries ?? null,
    competitors: buyer.competitors ?? null,
    // Section 5: LOGISTICS
    origin_ports: buyer.origin_ports ?? null,
    destination_ports: buyer.destination_ports ?? null,
    container_types: buyer.container_types ?? null,
    // Section 6: GHI CHU CHO AI
    bol_description: buyer.bol_description ?? null,
    purchase_history: buyer.purchase_history ?? null,
    priority_rating: buyer.priority_rating ?? null,
    // Section 7: NHU CAU THUC TE (direct inquiry — migration 068)
    has_active_inquiry: buyer.has_active_inquiry ?? false,
    inquiry_products: buyer.inquiry_products ?? null,
    inquiry_quantity: buyer.inquiry_quantity ?? null,
    inquiry_target_price: buyer.inquiry_target_price ?? null,
    inquiry_timeline: buyer.inquiry_timeline ?? null,
    inquiry_channel: buyer.inquiry_channel ?? null,
    inquiry_notes: buyer.inquiry_notes ?? null,
    inquiry_received_at: buyer.inquiry_received_at ?? null,
    // Email suppression (migration 077)
    email_hard_bounced_at: buyer.email_hard_bounced_at ?? null,
    email_complained_at: buyer.email_complained_at ?? null,
    email_suppression_note: buyer.email_suppression_note ?? null,
    // AI buyer analysis snapshot (migration 079)
    buyer_analysis: analysisSnapshot.analysis,
    buyer_strategy: analysisSnapshot.strategy,
    buyer_analysis_at: analysisSnapshot.analysis
      ? (buyer.buyer_analysis_at ?? null)
      : null,
  }

  const canAssignBuyer = can(current.role, CAPS.BUYER_ASSIGN)

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/admin/buyers">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {locale === "vi" ? "Quay lại danh sách" : "Back to list"}
          </Link>
        </Button>
      </div>

      <BuyerDetailView
        buyer={data}
        opportunities={oppRows}
        replies={replies}
        contacts={contacts}
        locale={locale}
        canWrite={canWrite}
        canViewPII={canViewPII}
        canLiftSuppression={current.role === "admin" || current.role === "super_admin"}
        currentRole={current.role}
        canAssignAE={canAssignBuyer}
        engagement={engagement}
      />

      {/* Aggregate buyer KPIs across all clients — gated by analytics caps.
          Note: AE / Researcher already see ANALYTICS_VIEW_OWN, but at the
          buyer level there is no client filter to apply (buyer cuts across
          clients), so we show this whenever the user has ANY analytics cap.
          The numbers do not reveal cost prices, only deal counts. */}
      {canAny(current.role, [CAPS.ANALYTICS_VIEW_ALL, CAPS.ANALYTICS_VIEW_OWN]) && (
        <BuyerPerformanceCard leadId={buyer.id} />
      )}
    </div>
  )
}
