import { NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { toCsv, csvResponseHeaders, type CsvColumn } from "@/lib/export/csv"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Deliberately excludes `unsubscribe_token`: it is a bearer secret, not an
// exportable buyer attribute. All other buyer profile fields are included.
type BuyerExportRow = Omit<Database["public"]["Tables"]["leads"]["Row"], "unsubscribe_token">

type AdminClient = NonNullable<Awaited<ReturnType<typeof getCurrentRole>>>["admin"]

const PAGE_SIZE = 1000
const BUYER_FIELDS = `
  id,
  company_name,
  contact_person,
  contact_title,
  contact_email,
  contact_phone,
  linkedin_url,
  website,
  industry,
  region,
  country,
  import_address,
  notes,
  source,
  source_ref,
  enriched_data,
  created_by,
  created_at,
  total_shipments,
  last_shipment_date,
  avg_teu_per_month,
  top_peak_months,
  top_low_months,
  hs_code,
  main_product,
  secondary_hs_codes,
  top_suppliers,
  main_import_countries,
  competitors,
  origin_ports,
  destination_ports,
  container_types,
  bol_description,
  purchase_history,
  priority_rating,
  has_active_inquiry,
  inquiry_products,
  inquiry_quantity,
  inquiry_target_price,
  inquiry_timeline,
  inquiry_channel,
  inquiry_notes,
  inquiry_received_at,
  email_hard_bounced_at,
  email_complained_at,
  email_suppression_note,
  email_unsubscribed,
  email_unsubscribed_at,
  buyer_analysis,
  buyer_strategy,
  buyer_analysis_at,
  buyer_analysis_model
`

function jsonCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

const COLUMNS: CsvColumn<BuyerExportRow>[] = [
  { header: "Buyer ID", value: (r) => r.id },
  { header: "Company name", value: (r) => r.company_name },
  { header: "Contact person", value: (r) => r.contact_person },
  { header: "Contact title", value: (r) => r.contact_title },
  { header: "Contact email", value: (r) => r.contact_email },
  { header: "Contact phone", value: (r) => r.contact_phone },
  { header: "LinkedIn URL", value: (r) => r.linkedin_url },
  { header: "Website", value: (r) => r.website },
  { header: "Industry", value: (r) => r.industry },
  { header: "Region", value: (r) => r.region },
  { header: "Country", value: (r) => r.country },
  { header: "Import address", value: (r) => r.import_address },
  { header: "Notes", value: (r) => r.notes },
  { header: "Source", value: (r) => r.source },
  { header: "Source reference", value: (r) => r.source_ref },
  { header: "Enriched data (JSON)", value: (r) => jsonCell(r.enriched_data) },
  { header: "Created by", value: (r) => r.created_by },
  { header: "Created at", value: (r) => r.created_at },
  { header: "Total shipments", value: (r) => r.total_shipments },
  { header: "Last shipment date", value: (r) => r.last_shipment_date },
  { header: "Average TEU per month", value: (r) => r.avg_teu_per_month },
  { header: "Peak months", value: (r) => r.top_peak_months },
  { header: "Low months", value: (r) => r.top_low_months },
  { header: "HS code", value: (r) => r.hs_code },
  { header: "Main product", value: (r) => r.main_product },
  { header: "Secondary HS codes", value: (r) => r.secondary_hs_codes },
  { header: "Top suppliers (JSON)", value: (r) => jsonCell(r.top_suppliers) },
  { header: "Main import countries", value: (r) => r.main_import_countries },
  { header: "Competitors", value: (r) => r.competitors },
  { header: "Origin ports", value: (r) => r.origin_ports },
  { header: "Destination ports", value: (r) => r.destination_ports },
  { header: "Container types", value: (r) => r.container_types },
  { header: "BOL description", value: (r) => r.bol_description },
  { header: "Purchase history", value: (r) => r.purchase_history },
  { header: "Priority rating", value: (r) => r.priority_rating },
  { header: "Has active inquiry", value: (r) => r.has_active_inquiry },
  { header: "Inquiry products", value: (r) => r.inquiry_products },
  { header: "Inquiry quantity", value: (r) => r.inquiry_quantity },
  { header: "Inquiry target price", value: (r) => r.inquiry_target_price },
  { header: "Inquiry timeline", value: (r) => r.inquiry_timeline },
  { header: "Inquiry channel", value: (r) => r.inquiry_channel },
  { header: "Inquiry notes", value: (r) => r.inquiry_notes },
  { header: "Inquiry received at", value: (r) => r.inquiry_received_at },
  { header: "Email hard bounced at", value: (r) => r.email_hard_bounced_at },
  { header: "Email complained at", value: (r) => r.email_complained_at },
  { header: "Email suppression note", value: (r) => r.email_suppression_note },
  { header: "Email unsubscribed", value: (r) => r.email_unsubscribed },
  { header: "Email unsubscribed at", value: (r) => r.email_unsubscribed_at },
  { header: "Buyer analysis (JSON)", value: (r) => jsonCell(r.buyer_analysis) },
  { header: "Buyer strategy (JSON)", value: (r) => jsonCell(r.buyer_strategy) },
  { header: "Buyer analysis at", value: (r) => r.buyer_analysis_at },
  { header: "Buyer analysis model", value: (r) => r.buyer_analysis_model },
]

async function listOwnedBuyerIds(
  admin: AdminClient,
  userId: string,
): Promise<string[]> {
  const ids = new Set<string>()
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("opportunities")
      .select("id, lead_id")
      .eq("account_manager_id", userId)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error

    const rows = (data ?? []) as Array<{ id: string; lead_id: string | null }>
    for (const row of rows) {
      if (row.lead_id) ids.add(row.lead_id)
    }
    if (rows.length < PAGE_SIZE) return Array.from(ids)
  }
}

async function loadAllBuyers(
  admin: AdminClient,
  allowedLeadIds: string[] | null,
): Promise<BuyerExportRow[]> {
  const buyers: BuyerExportRow[] = []

  if (allowedLeadIds !== null) {
    // Keep each IN filter small; this path mirrors the AE/staff directory scope.
    for (let start = 0; start < allowedLeadIds.length; start += 100) {
      const ids = allowedLeadIds.slice(start, start + 100)
      const { data, error } = await admin
        .from("leads")
        .select(BUYER_FIELDS)
        .in("id", ids)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
      if (error) throw error
      buyers.push(...((data ?? []) as BuyerExportRow[]))
    }
    return buyers.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("leads")
      .select(BUYER_FIELDS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error

    const rows = (data ?? []) as BuyerExportRow[]
    buyers.push(...rows)
    if (rows.length < PAGE_SIZE) return buyers
  }
}

export async function GET() {
  const current = await getCurrentRole()
  if (!current) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  // The file contains contact details and internal buyer intelligence, so only
  // users already permitted to see unmasked buyer PII may download it.
  if (!can(current.role, CAPS.BUYER_VIEW) || !can(current.role, CAPS.BUYER_PII_VIEW)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const isOwnershipScoped = current.role === "account_executive" || current.role === "staff"
    const allowedLeadIds = isOwnershipScoped
      ? await listOwnedBuyerIds(current.admin, current.userId)
      : null
    const buyers = await loadAllBuyers(current.admin, allowedLeadIds)
    const csv = toCsv(buyers, COLUMNS)
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: csvResponseHeaders(`vexim-buyers-${date}.csv`),
    })
  } catch (error) {
    console.error("[export/buyers] failed:", error)
    return NextResponse.json({ error: "export_failed" }, { status: 500 })
  }
}
