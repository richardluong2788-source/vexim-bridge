// BuyerContext builder (spec §10) — cổng DUY NHẤT cấp dữ liệu cho AI.
//
// Nguyên tắc §2.3: backend quyết định context nào được đưa vào AI; AI không
// được query database tùy ý. Mọi trường không có dữ liệu phải là "UNKNOWN" —
// generator sẽ cấm AI tự điền (spec §20).

import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { MAX_EMAIL_WORDS } from "./constants"
import { loadInboundReplies, loadOutboundEmails } from "./interactions"
import type { BuyerContext, CampaignEnrollmentRow, CampaignStepRow } from "./types"

interface LeadFields {
  id: string
  company_name: string | null
  contact_person: string | null
  contact_email: string | null
  contact_title: string | null
  country: string | null
  industry: string | null
  website: string | null
  hs_code: string | null
  hs_codes: string[] | null
  purchase_history: string | null
  top_suppliers: unknown | null
  customs_shipment_count: number | null
  peak_months: string | null
  buyer_analysis: Record<string, unknown> | null
  buyer_strategy: Record<string, unknown> | null
  buyer_analysis_at: string | null
}

function unknownIfEmpty(value: string | null | undefined): string | "UNKNOWN" {
  const v = value?.trim()
  return v ? v : "UNKNOWN"
}

/** VN supplier detection từ top_suppliers JSONB (ImportYeti) — FACT only. */
function detectVietnamSupplier(topSuppliers: unknown): string | "UNKNOWN" {
  if (!Array.isArray(topSuppliers) || topSuppliers.length === 0) return "UNKNOWN"
  const names = topSuppliers
    .map((s) => {
      if (typeof s !== "object" || s === null) return null
      const rec = s as Record<string, unknown>
      const name = typeof rec.supplier_name === "string" ? rec.supplier_name : typeof rec.name === "string" ? rec.name : null
      const country = typeof rec.country === "string" ? rec.country : null
      return { name, country }
    })
    .filter((x): x is { name: string; country: string | null } => !!x?.name)
  const vn = names.find(
    (n) => n.country?.toLowerCase().includes("viet") || /viet\s*nam|vietnam|\(vn\)/i.test(n.name),
  )
  return vn ? `yes (${vn.name})` : names.length > 0 ? "no (suppliers on file are not Vietnamese)" : "UNKNOWN"
}

export async function buildBuyerContext(
  enrollment: CampaignEnrollmentRow,
  step: CampaignStepRow,
): Promise<BuyerContext> {
  const admin = createAdminClient()

  const { data: lead, error } = await admin
    .from("leads")
    .select(
      `id, company_name, contact_person, contact_email, contact_title, country, industry,
       website, hs_code, hs_codes, purchase_history, top_suppliers,
       customs_shipment_count, peak_months, buyer_analysis, buyer_strategy,
       buyer_analysis_at`,
    )
    .eq("id", enrollment.lead_id)
    .single()

  if (error || !lead) {
    throw new Error(`buildBuyerContext: lead ${enrollment.lead_id} lookup failed: ${error?.message ?? "not found"}`)
  }
  // Cast qua unknown: generated types chưa có hs_codes dù cột tồn tại từ migration 032.
  const l = lead as unknown as LeadFields

  const [previousEmails, replies, campaignRes] = await Promise.all([
    loadOutboundEmails(enrollment.id),
    loadInboundReplies(enrollment.id),
    (admin.from("campaigns") as any)
      .select("name, description, target_segment, product_category")
      .eq("id", enrollment.campaign_id)
      .single(),
  ])
  const campaign = (campaignRes.data ?? {}) as {
    name?: string; description?: string | null
    target_segment?: string | null; product_category?: string | null
  }

  const hsCodes = Array.isArray(l.hs_codes) && l.hs_codes.length > 0
    ? l.hs_codes
    : l.hs_code?.trim()
      ? [l.hs_code.trim()]
      : "UNKNOWN" as const

  const analysisAgeDays =
    l.buyer_analysis_at
      ? Math.floor((Date.now() - new Date(l.buyer_analysis_at).getTime()) / 86400000)
      : "UNKNOWN"

  return {
    buyer: {
      company_name: l.company_name,
      country: l.country,
      industry: l.industry,
      website: l.website,
      contact_name: l.contact_person,
      contact_email: l.contact_email,
      contact_title: l.contact_title,
    },
    import_data: {
      hs_codes: hsCodes === "UNKNOWN" ? ("UNKNOWN" as const) : hsCodes,
      main_products: unknownIfEmpty(l.industry),
      purchase_history: unknownIfEmpty(l.purchase_history),
      vietnam_supplier_exists: detectVietnamSupplier(l.top_suppliers),
      shipment_count: typeof l.customs_shipment_count === "number" ? l.customs_shipment_count : "UNKNOWN",
      peak_months: unknownIfEmpty(l.peak_months),
    },
    campaign: {
      name: campaign.name ?? "unknown",
      description: campaign.description ?? null,
      target_segment: campaign.target_segment ?? null,
      product_category: campaign.product_category ?? null,
    },
    research: {
      buyer_analysis: (l.buyer_analysis && typeof l.buyer_analysis === "object" ? l.buyer_analysis : "UNKNOWN") as
        | Record<string, unknown>
        | "UNKNOWN",
      buyer_strategy: (l.buyer_strategy && typeof l.buyer_strategy === "object" ? l.buyer_strategy : "UNKNOWN") as
        | Record<string, unknown>
        | "UNKNOWN",
      analysis_age_days: analysisAgeDays,
    },
    crm: {
      stage: enrollment.state,
      campaign_step: step.step_number,
      step_objective: step.objective,
      followup_count: enrollment.followup_count,
      previous_emails: previousEmails.map((e) => ({
        step: e.step,
        sent_at: e.sent_at,
        subject: e.subject,
        content: e.content,
      })),
      replies: replies.map((r) => ({
        received_at: r.received_at,
        content: r.content,
        intent: r.intent,
      })),
    },
    business_rules: {
      max_words: MAX_EMAIL_WORDS,
      no_links: true,
      no_attachments: true,
      opt_out_line_required: step.step_number >= 2,
    },
  }
}
