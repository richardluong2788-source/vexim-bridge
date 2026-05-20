"use server"

/**
 * Server actions for Commercial Intelligence
 * Allows Lead Researcher and Account Executive to manage CI data
 */

import { createClient } from "@/lib/supabase/server"
import type { CommercialIntelligence } from "@/lib/supabase/types"

export async function getCIByOpportunityId(
  opportunityId: string
): Promise<{ 
  ok: true; 
  ci: CommercialIntelligence | null;
  leadData?: {
    // Basic info
    hs_code: string | null;
    purchase_history: string | null;
    competitors: string | null;
    peak_months: string | null;
    // Extended data for full trade intelligence display
    main_product: string | null;
    secondary_hs_codes: string | null;
    bol_description: string | null;
    top_suppliers: { name: string; country: string | null }[] | null;
    main_import_countries: string | null;
    origin_ports: string | null;
    destination_ports: string | null;
    container_types: string | null;
    priority_rating: number | null;
    total_shipments: number | null;
    avg_teu_per_month: number | null;
    top_low_months: string | null;
  } | null;
} | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    
    // 1. Check existing CI record
    const { data: ci, error } = await supabase
      .from("commercial_intelligence")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (error) throw error

    // 2. If no CI exists, fetch lead data to pre-fill
    let leadData = null
    if (!ci) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("lead_id")
        .eq("id", opportunityId)
        .single()

      if (opp?.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select(`
            hs_code, 
            purchase_history, 
            competitors, 
            peak_months,
            main_product,
            secondary_hs_codes,
            bol_description,
            top_suppliers,
            main_import_countries,
            origin_ports,
            destination_ports,
            container_types,
            priority_rating,
            total_shipments,
            avg_teu_per_month,
            top_low_months
          `)
          .eq("id", opp.lead_id)
          .single()

        if (lead) {
          leadData = {
            hs_code: lead.hs_code,
            purchase_history: lead.purchase_history,
            competitors: lead.competitors,
            peak_months: lead.peak_months,
            main_product: lead.main_product,
            secondary_hs_codes: lead.secondary_hs_codes,
            bol_description: lead.bol_description,
            top_suppliers: lead.top_suppliers as { name: string; country: string | null }[] | null,
            main_import_countries: lead.main_import_countries,
            origin_ports: lead.origin_ports,
            destination_ports: lead.destination_ports,
            container_types: lead.container_types,
            priority_rating: lead.priority_rating,
            total_shipments: lead.total_shipments,
            avg_teu_per_month: lead.avg_teu_per_month,
            top_low_months: lead.top_low_months,
          }
        }
      }
    }

    return { ok: true, ci, leadData }
  } catch (err) {
    console.error("[CI] Error fetching CI:", err)
    return { ok: false, error: "fetch_failed" }
  }
}

export async function createOrUpdateCI({
  opportunityId,
  main_hs_code,
  import_history_summary,
  main_competitors,
}: {
  opportunityId: string
  main_hs_code: string | null
  import_history_summary: string | null
  main_competitors: string | null
}): Promise<
  { ok: true; ci: CommercialIntelligence }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient()
    const { data: user } = await supabase.auth.getUser()

    if (!user?.user) {
      return { ok: false, error: "unauthorized" }
    }

    // Try to get existing CI record
    const { data: existing } = await supabase
      .from("commercial_intelligence")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (existing) {
      // UPDATE
      const { data, error } = await supabase
        .from("commercial_intelligence")
        .update({
          main_hs_code,
          import_history_summary,
          main_competitors,
          updated_by: user.user.id,
        })
        .eq("opportunity_id", opportunityId)
        .select()
        .single()

      if (error) throw error
      return { ok: true, ci: data }
    } else {
      // INSERT
      const { data, error } = await supabase
        .from("commercial_intelligence")
        .insert({
          opportunity_id: opportunityId,
          main_hs_code,
          import_history_summary,
          main_competitors,
          created_by: user.user.id,
        })
        .select()
        .single()

      if (error) throw error
      return { ok: true, ci: data }
    }
  } catch (err) {
    console.error("[CI] Error saving CI:", err)
    return { ok: false, error: "save_failed" }
  }
}
