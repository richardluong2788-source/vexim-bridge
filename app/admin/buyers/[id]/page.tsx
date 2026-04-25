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
  type AssignableClient,
} from "@/components/admin/buyer-detail-view"
import { BuyerPerformanceCard } from "@/components/admin/analytics/buyer-performance-card"
import { canAny } from "@/lib/auth/permissions"

export const dynamic = "force-dynamic"

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

  // --- 2) Opportunities attached to this buyer ---------------------------
  const { data: opps } = await current.admin
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
        fda_expires_at
      )
    `,
    )
    .eq("lead_id", id)
    .order("last_updated", { ascending: false })

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
            o.profiles.company_name ?? o.profiles.full_name ?? "—",
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

  // --- 4) Clients eligible to be assigned this buyer ---------------------
  // We only include clients with a non-empty FDA registration number. The
  // expiry check happens server-side inside assignBuyerToClient, but we
  // still expose the expiry date so the dialog can warn eagerly.
  const { data: rawClients } = await current.admin
    .from("profiles")
    .select("id, full_name, company_name, fda_registration_number, fda_expires_at")
    .eq("role", "client")
    .order("company_name", { ascending: true })

  // Mark clients already attached to this buyer so the dialog can disable
  // them (prevents accidental duplicate assignment, UNIQUE constraint
  // violations, and confusion in the pipeline).
  const attachedClientIds = new Set(
    oppRows.map((o) => o.client?.id).filter((x): x is string => !!x),
  )

  const clients: AssignableClient[] = (rawClients ?? []).map((c: any) => ({
    id: c.id,
    name: c.company_name ?? c.full_name ?? "—",
    fdaRegistrationNumber: c.fda_registration_number,
    fdaExpiresAt: c.fda_expires_at,
    alreadyAttached: attachedClientIds.has(c.id),
  }))

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
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
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
        clients={clients}
        locale={locale}
        canWrite={canWrite}
        canViewPII={canViewPII}
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
